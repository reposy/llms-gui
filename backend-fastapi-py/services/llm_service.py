from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
import httpx
from enum import Enum

class LLMProvider(str, Enum):
    OLLAMA = "ollama"
    OPENAI = "openai"
    # 추후 다른 제공자 추가 가능
    
class LLMService(ABC):
    @abstractmethod
    async def generate(self, prompt: str, model: str, **kwargs) -> str:
        pass

    @abstractmethod
    async def list_models(self) -> list[str]:
        pass

class OllamaService(LLMService):
    def __init__(self, base_url: str = "http://localhost:11434"):
        self.base_url = base_url

    async def generate(self, prompt: str, model: str, **kwargs) -> str:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/api/generate",
                json={
                    "model": model,
                    "prompt": prompt,
                    "stream": False,
                    **kwargs
                }
            )
            response.raise_for_status()
            return response.json()["response"]

    async def list_models(self) -> list[str]:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{self.base_url}/api/tags")
            response.raise_for_status()
            return response.json()["models"]

class OpenAIService(LLMService):
    def __init__(self, api_key: str):
        self.api_key = api_key

    async def generate(self, prompt: str, model: str, **kwargs) -> str:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={
                    "model": model,
                    "messages": [{"role": "user", "content": prompt}],
                    **kwargs
                }
            )
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"]

    async def list_models(self) -> list[str]:
        return ["gpt-3.5-turbo", "gpt-4"]  # 기본 모델들

class LLMServiceFactory:
    @staticmethod
    def create_service(provider: LLMProvider, config: Optional[Dict[str, Any]] = None) -> LLMService:
        if provider == LLMProvider.OLLAMA:
            base_url = config.get("base_url", "http://localhost:11434") if config else "http://localhost:11434"
            return OllamaService(base_url=base_url)
        elif provider == LLMProvider.OPENAI:
            if not config or "api_key" not in config:
                raise ValueError("OpenAI API key is required")
            return OpenAIService(api_key=config["api_key"])
        else:
            raise ValueError(f"Unsupported LLM provider: {provider}") 