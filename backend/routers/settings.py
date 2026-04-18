import os
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from db.mongo import get_db
from routers.auth import get_current_user, User
from datetime import datetime, timezone

router = APIRouter()


def mask_key(key: Optional[str]) -> Optional[str]:
    if not key or len(key) < 8:
        return None
    return key[:4] + "*" * (len(key) - 8) + key[-4:]


@router.get("")
async def get_settings(current_user: User = Depends(get_current_user)):
    db = get_db()
    doc = await db.app_settings.find_one({"key": "global"})
    if not doc:
        # Return defaults from env
        doc = {
            "llm_provider": os.getenv("LLM_PROVIDER", "ollama"),
            "ollama_base_url": os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"),
            "ollama_model": os.getenv("OLLAMA_MODEL", "llama3"),
            "openai_model": os.getenv("OPENAI_MODEL", "gpt-4o"),
            "india_telephony_provider": os.getenv("INDIA_TELEPHONY_PROVIDER", "exotel"),
            "livekit_url": os.getenv("LIVEKIT_URL", "ws://localhost:7880"),
            "aws_region": os.getenv("AWS_REGION", "ap-south-1"),
            "ozonetel_api_key": os.getenv("OZONETEL_API_KEY", ""),
            "ozonetel_username": os.getenv("OZONETEL_USERNAME", ""),
            "ozonetel_api_url": os.getenv("OZONETEL_API_URL", ""),
            "ozonetel_campaign_name": os.getenv("OZONETEL_CAMPAIGN_NAME", ""),
            "ozonetel_callback_url": os.getenv("OZONETEL_CALLBACK_URL", ""),
        }

    # Mask sensitive keys for display
    masked = dict(doc)
    sensitive_fields = [
        "anthropic_api_key", "openai_api_key", "deepgram_api_key",
        "cartesia_api_key", "telnyx_api_key", "telnyx_public_key",
        "exotel_api_key", "exotel_api_token", "livekit_api_key",
        "livekit_api_secret", "aws_access_key_id", "aws_secret_access_key",
        "ozonetel_api_key", "ozonetel_username",
    ]
    for field in sensitive_fields:
        if field in masked:
            masked[field] = mask_key(masked[field])

    masked.pop("_id", None)
    masked.pop("hashed_password", None)
    return masked


class UpdateSettingsRequest(BaseModel):
    llm_provider: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    openai_api_key: Optional[str] = None
    openai_model: Optional[str] = None
    ollama_base_url: Optional[str] = None
    ollama_model: Optional[str] = None
    deepgram_api_key: Optional[str] = None
    cartesia_api_key: Optional[str] = None
    cartesia_custom_voice_id: Optional[str] = None
    telnyx_api_key: Optional[str] = None
    telnyx_public_key: Optional[str] = None
    telnyx_did_us: Optional[str] = None
    telnyx_did_uk: Optional[str] = None
    telnyx_did_au: Optional[str] = None
    telnyx_did_ca: Optional[str] = None
    telnyx_did_uae: Optional[str] = None
    telnyx_did_eu: Optional[str] = None
    telnyx_did_sg: Optional[str] = None
    telnyx_connection_id_us: Optional[str] = None
    telnyx_connection_id_uk: Optional[str] = None
    telnyx_connection_id_au: Optional[str] = None
    telnyx_connection_id_default: Optional[str] = None
    india_telephony_provider: Optional[str] = None
    exotel_api_key: Optional[str] = None
    exotel_api_token: Optional[str] = None
    exotel_sid: Optional[str] = None
    exotel_virtual_number: Optional[str] = None
    ozonetel_api_key: Optional[str] = None
    ozonetel_did: Optional[str] = None
    ozonetel_username: Optional[str] = None
    ozonetel_api_url: Optional[str] = None
    ozonetel_campaign_name: Optional[str] = None
    ozonetel_callback_url: Optional[str] = None
    livekit_url: Optional[str] = None
    livekit_api_key: Optional[str] = None
    livekit_api_secret: Optional[str] = None
    aws_access_key_id: Optional[str] = None
    aws_secret_access_key: Optional[str] = None
    aws_region: Optional[str] = None
    s3_bucket_name: Optional[str] = None


@router.patch("")
async def update_settings(req: UpdateSettingsRequest, current_user: User = Depends(get_current_user)):
    db = get_db()
    updates = {k: v for k, v in req.model_dump().items() if v is not None}
    updates["key"] = "global"
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()

    # Don't overwrite with masked values (if user didn't change)
    await db.app_settings.update_one(
        {"key": "global"},
        {"$set": updates},
        upsert=True
    )

    # Reload LLM provider singleton if changed
    if "llm_provider" in updates:
        import services.llm_provider as llm_module
        llm_module._llm_instance = None

    return {"status": "updated", "updated_fields": list(updates.keys())}


@router.post("/test-llm")
async def test_llm(current_user: User = Depends(get_current_user)):
    try:
        from services.llm_provider import get_default_llm
        llm = get_default_llm()
        result = ""
        async for chunk in llm.stream_chat(
            system_prompt="You are a helpful assistant.",
            messages=[{"role": "user", "content": "Say 'LLM connection OK' and nothing else."}],
            max_tokens=20
        ):
            result += chunk
        return {"status": "ok", "response": result.strip()}
    except Exception as e:
        return {"status": "error", "error": str(e)}
