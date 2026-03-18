"""
Voice Interview Pipeline using Pipecat framework.
Supports: Deepgram STT + Ollama/Claude/OpenAI LLM + Cartesia TTS
Falls back to text-only mode if API keys are not configured.
"""
import os
import json
import asyncio
from typing import Optional
from fastapi import WebSocket, WebSocketDisconnect
from services.prompt_builder import build_system_prompt
from services.conversation_state import ConversationState
from db.mongo import get_db
from datetime import datetime, timezone


async def run_interview_pipeline(
    websocket: WebSocket,
    session_id: str,
    session_config: dict
):
    """
    Main voice pipeline entrypoint.
    Tries to use Pipecat + Deepgram + Cartesia if keys are available.
    Falls back to Ollama-only text mode otherwise.
    """
    deepgram_key = os.getenv("DEEPGRAM_API_KEY", "")
    cartesia_key = os.getenv("CARTESIA_API_KEY", "")

    has_voice_keys = bool(deepgram_key and cartesia_key)

    if has_voice_keys:
        await run_pipecat_pipeline(websocket, session_id, session_config)
    else:
        await run_text_pipeline(websocket, session_id, session_config)


async def run_text_pipeline(
    websocket: WebSocket,
    session_id: str,
    session_config: dict
):
    """
    Text-only fallback pipeline.
    Browser sends JSON text messages, gets JSON text responses.
    Uses for testing without voice API keys.
    """
    db = get_db()
    state = ConversationState(session_config)
    system_prompt = build_system_prompt(session_config)
    messages = []

    # Update session status
    await db.interview_sessions.update_one(
        {"session_id": session_id},
        {"$set": {"status": "in_progress", "call_started_at": datetime.now(timezone.utc).isoformat()}}
    )

    # Send opening greeting
    from services.llm_provider import get_default_llm
    llm = get_default_llm()

    try:
        # Initial greeting
        opening = ""
        async for chunk in llm.stream_chat(
            system_prompt=system_prompt,
            messages=[{"role": "user", "content": "[START INTERVIEW - greet and ask first question]"}],
            max_tokens=200
        ):
            opening += chunk

        agent_turn = state.record_agent_turn(opening, "opening")
        await db.interview_sessions.update_one(
            {"session_id": session_id},
            {"$push": {"transcript": agent_turn}}
        )
        messages.append({"role": "assistant", "content": opening})

        await websocket.send_json({
            "type": "agent_message",
            "text": opening,
            "turn": agent_turn["turn"],
            "domain": agent_turn.get("domain"),
            "state": state.get_state_dict()
        })

        # Main conversation loop
        async for message in _receive_messages(websocket):
            if message.get("type") == "candidate_message":
                candidate_text = message.get("text", "").strip()
                if not candidate_text:
                    continue

                candidate_turn = state.record_candidate_turn(candidate_text)
                messages.append({"role": "user", "content": candidate_text})

                await db.interview_sessions.update_one(
                    {"session_id": session_id},
                    {"$push": {"transcript": candidate_turn}}
                )

                # Notify dashboard
                await websocket.send_json({
                    "type": "transcript_turn",
                    "speaker": "candidate",
                    "text": candidate_text,
                    "turn": candidate_turn["turn"],
                    "domain": candidate_turn.get("domain"),
                    "state": state.get_state_dict()
                })

                # Generate response
                response = ""
                async for chunk in llm.stream_chat(
                    system_prompt=system_prompt,
                    messages=messages,
                    max_tokens=200
                ):
                    response += chunk

                agent_turn = state.record_agent_turn(response)
                messages.append({"role": "assistant", "content": response})

                await db.interview_sessions.update_one(
                    {"session_id": session_id},
                    {"$push": {"transcript": agent_turn}}
                )

                await websocket.send_json({
                    "type": "agent_message",
                    "text": response,
                    "turn": agent_turn["turn"],
                    "domain": agent_turn.get("domain"),
                    "state": state.get_state_dict()
                })

                # Check if interview done
                if state.is_interview_complete() or "[INTERVIEW COMPLETE]" in response:
                    await db.interview_sessions.update_one(
                        {"session_id": session_id},
                        {"$set": {"status": "completed", "call_ended_at": datetime.now(timezone.utc).isoformat()}}
                    )
                    await websocket.send_json({"type": "interview_ended", "reason": "completed"})
                    break

            elif message.get("type") == "end_interview":
                break

    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"Pipeline error: {e}")
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except:
            pass
    finally:
        await db.interview_sessions.update_one(
            {"session_id": session_id},
            {"$set": {
                "status": "completed",
                "call_ended_at": datetime.now(timezone.utc).isoformat(),
                "state": state.get_state_dict()
            }}
        )


async def _receive_messages(websocket: WebSocket):
    """Async generator for WebSocket messages"""
    while True:
        try:
            data = await websocket.receive_text()
            yield json.loads(data)
        except WebSocketDisconnect:
            break
        except Exception:
            break


async def run_pipecat_pipeline(
    websocket: WebSocket,
    session_id: str,
    session_config: dict
):
    """
    Full voice pipeline using Pipecat.
    Requires: DEEPGRAM_API_KEY + CARTESIA_API_KEY
    """
    try:
        from pipecat.pipeline.pipeline import Pipeline
        from pipecat.pipeline.runner import PipelineRunner
        from pipecat.pipeline.task import PipelineParams, PipelineTask
        from pipecat.transports.network.fastapi_websocket import (
            FastAPIWebsocketTransport,
            FastAPIWebsocketParams
        )
        from pipecat.audio.vad.silero import SileroVADAnalyzer
        from pipecat.services.deepgram.stt import DeepgramSTTService
        from pipecat.services.cartesia.tts import CartesiaTTSService
        from pipecat.services.openai.llm import OpenAILLMService
        from pipecat.processors.aggregators.openai_llm_context import (
            OpenAILLMContext,
            OpenAILLMContextAggregator
        )

        transport = FastAPIWebsocketTransport(
            websocket=websocket,
            params=FastAPIWebsocketParams(
                audio_in_enabled=True,
                audio_out_enabled=True,
                add_wav_header=True,
                vad_enabled=True,
                vad_analyzer=SileroVADAnalyzer(),
                vad_audio_passthrough=True,
            )
        )

        accent = (session_config.get("config") or {}).get("accent", "us")
        from services.cartesia_voices import get_voice_id
        voice_id = get_voice_id(accent)

        stt = DeepgramSTTService(
            api_key=os.getenv("DEEPGRAM_API_KEY"),
            model="nova-2",
        )

        tts = CartesiaTTSService(
            api_key=os.getenv("CARTESIA_API_KEY"),
            voice_id=voice_id,
            model="sonic-english",
        )

        system_prompt = build_system_prompt(session_config)

        # Use Ollama via OpenAI-compatible endpoint
        ollama_base = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        ollama_model = os.getenv("OLLAMA_MODEL", "llama3")

        llm = OpenAILLMService(
            api_key="ollama",
            base_url=f"{ollama_base}/v1",
            model=ollama_model
        )

        messages = [{"role": "system", "content": system_prompt}]
        context = OpenAILLMContext(messages)
        context_agg = context.create_aggregator_pair()

        pipeline = Pipeline([
            transport.input(),
            stt,
            context_agg.user(),
            llm,
            tts,
            transport.output(),
            context_agg.assistant(),
        ])

        db = get_db()
        await db.interview_sessions.update_one(
            {"session_id": session_id},
            {"$set": {"status": "in_progress", "call_started_at": datetime.now(timezone.utc).isoformat()}}
        )

        task = PipelineTask(pipeline, PipelineParams(allow_interruptions=True))
        runner = PipelineRunner()
        await runner.run(task)

    except Exception as e:
        print(f"Pipecat pipeline error, falling back to text: {e}")
        await run_text_pipeline(websocket, session_id, session_config)
