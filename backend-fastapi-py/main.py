from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any, Union
import os
from services.llm_service import LLMServiceFactory, LLMProvider
from services.web_crawler import crawl_webpage

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
    
class WebCrawlerRequest(BaseModel):
    url: str
    wait_for_selector: Optional[str] = None
    extract_selectors: Optional[Dict[str, str]] = None
    timeout: Optional[int] = 30000 # Expect timeout in milliseconds, default 30000ms
    headers: Optional[Dict[str, str]] = None
    include_html: bool = False

class WebCrawlerResponse(BaseModel):
    url: str
    title: Optional[str] = None # Make fields optional for error cases
    text: Optional[str] = None
    html: Optional[str] = None
    extracted_data: Optional[Dict[str, Any]] = None
    status: str
    error: Optional[str] = None

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

@app.post("/api/web-crawler/fetch")
async def fetch_webpage(request: WebCrawlerRequest) -> WebCrawlerResponse:
    try:
        # Pass timeout directly (it's in milliseconds)
        result = await crawl_webpage(
            url=request.url,
            wait_for_selector=request.wait_for_selector,
            extract_selectors=request.extract_selectors,
            timeout=request.timeout, # Pass timeout in ms
            headers=request.headers,
            include_html=request.include_html
        )
        
        # Return based on the structure returned by crawl_webpage
        return WebCrawlerResponse(**result)
    
    except Exception as e:
        # Fallback error response if crawl_webpage itself fails unexpectedly
        return WebCrawlerResponse(
            url=request.url,
            title=None,
            text=None,
            html=None,
            extracted_data=None,
            status="error",
            error=f"Unhandled exception in API handler: {str(e)}"
        ) 