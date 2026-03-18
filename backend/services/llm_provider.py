import os
from abc import ABC, abstractmethod
from typing import AsyncGenerator
from dotenv import load_dotenv

load_dotenv()


class LLMProvider(ABC):
    @abstractmethod
    async def stream_chat(
        self,
        system_prompt: str,
        messages: list[dict],
        max_tokens: int = 500
    ) -> AsyncGenerator[str, None]:
        pass

    async def complete_chat(
        self,
        system_prompt: str,
        messages: list[dict],
        max_tokens: int = 1000
    ) -> str:
        result = ""
        async for chunk in self.stream_chat(system_prompt, messages, max_tokens):
            result += chunk
        return result


class ClaudeProvider(LLMProvider):
    def __init__(self):
        import anthropic
        self.client = anthropic.AsyncAnthropic(
            api_key=os.getenv("ANTHROPIC_API_KEY")
        )
        self.model = "claude-sonnet-4-20250514"

    async def stream_chat(self, system_prompt, messages, max_tokens=500):
        async with self.client.messages.stream(
            model=self.model,
            max_tokens=max_tokens,
            system=system_prompt,
            messages=messages
        ) as stream:
            async for text in stream.text_stream:
                yield text


class OpenAIProvider(LLMProvider):
    def __init__(self):
        from openai import AsyncOpenAI
        self.client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        self.model = os.getenv("OPENAI_MODEL", "gpt-4o")

    async def stream_chat(self, system_prompt, messages, max_tokens=500):
        full_messages = [{"role": "system", "content": system_prompt}] + messages
        stream = await self.client.chat.completions.create(
            model=self.model,
            messages=full_messages,
            max_tokens=max_tokens,
            stream=True
        )
        async for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta


class OllamaProvider(LLMProvider):
    def __init__(self):
        import ollama as ollama_lib
        self.base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        self.model = os.getenv("OLLAMA_MODEL", "llama3")
        self._client = None

    def _get_client(self):
        if self._client is None:
            import ollama as ollama_lib
            self._client = ollama_lib.AsyncClient(host=self.base_url)
        return self._client

    async def stream_chat(self, system_prompt, messages, max_tokens=500):
        full_messages = [{"role": "system", "content": system_prompt}] + messages
        client = self._get_client()
        try:
            response = await client.chat(
                model=self.model,
                messages=full_messages,
                stream=True,
                options={"num_predict": max_tokens}
            )
            async for chunk in response:
                content = chunk.get("message", {}).get("content", "")
                if content:
                    yield content
        except Exception as e:
            yield f"[LLM Error: {str(e)}]"


def get_llm_provider(provider_override: str = None) -> LLMProvider:
    provider = (provider_override or os.getenv("LLM_PROVIDER", "ollama")).lower()
    if provider == "claude":
        return ClaudeProvider()
    elif provider == "openai":
        return OpenAIProvider()
    elif provider == "ollama":
        return OllamaProvider()
    else:
        return OllamaProvider()


# Default singleton
_llm_instance = None

def get_default_llm() -> LLMProvider:
    global _llm_instance
    if _llm_instance is None:
        _llm_instance = get_llm_provider()
    return _llm_instance
