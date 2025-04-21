from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any
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

class WebCrawlerRequest(BaseModel):
    url: str
    wait_for_selector: Optional[str] = None
    extract_selectors: Optional[Dict[str, str]] = None
    timeout: Optional[int] = 30000 # Expect timeout in milliseconds, default 30000ms
    headers: Optional[Dict[str, str]] = None
    include_html: bool = False

class WebCrawlerResponse(BaseModel):
    url: str
    title: Optional[str] = None
    text: Optional[str] = None
    html: Optional[str] = None
    extracted_data: Optional[Dict[str, Any]] = None
    status: str
    error: Optional[str] = None

@app.get("/")
async def root():
    return {"message": "Hello World"}

@app.post("/api/web-crawler/fetch")
async def fetch_webpage(request: WebCrawlerRequest) -> WebCrawlerResponse:
    try:
        result = await crawl_webpage(
            url=request.url,
            wait_for_selector=request.wait_for_selector,
            extract_selectors=request.extract_selectors,
            timeout=request.timeout,
            headers=request.headers,
            include_html=request.include_html
        )
        return WebCrawlerResponse(**result)
    
    except Exception as e:
        # Consistent error handling for the remaining endpoint
        return WebCrawlerResponse(
            url=request.url,
            title=None,
            text=None,
            html=None,
            extracted_data=None,
            status="error",
            error=f"Unhandled exception in API handler: {str(e)}"
        ) 