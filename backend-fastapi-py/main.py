from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import os
from services.llm_service import LLMServiceFactory, LLMProvider

app = FastAPI()

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 실제 운영 환경에서는 구체적인 origin을 지정해야 합니다
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class LLMRequest(BaseModel):
    prompt: str
    model: str
    provider: LLMProvider = LLMProvider.OLLAMA
    config: Optional[dict] = None

class LLMResponse(BaseModel):
    response: str

@app.get("/")
async def root():
    return {"message": "Hello World"}

@app.post("/api/run-llm")
async def run_llm(request: LLMRequest) -> LLMResponse:
    try:
        # OpenAI API 키가 필요한 경우 환경 변수에서 가져옴
        config = request.config or {}
        if request.provider == LLMProvider.OPENAI:
            config["api_key"] = os.getenv("OPENAI_API_KEY")

        service = LLMServiceFactory.create_service(request.provider, config)
        response = await service.generate(request.prompt, request.model)
        return LLMResponse(response=response)
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/models/{provider}")
async def list_models(provider: LLMProvider):
    try:
        config = {}
        if provider == LLMProvider.OPENAI:
            config["api_key"] = os.getenv("OPENAI_API_KEY")

        service = LLMServiceFactory.create_service(provider, config)
        models = await service.list_models()
        return {"models": models}
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 