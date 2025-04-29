import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from services.web_crawler import crawl_webpage
from services.html_parser import ExtractionRule, parse_html_content

# Configure logging (call once at the start)
logging.basicConfig(
    level=logging.INFO, # Or load from settings: settings.LOG_LEVEL
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

# Get a logger for this module if needed (optional here)
logger = logging.getLogger(__name__)

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

# HTML Parser API endpoint
class HtmlParseRequest(BaseModel):
    html_content: str
    extraction_rules: List[ExtractionRule]

class HtmlParseResponse(BaseModel):
    status: str
    data: Dict[str, Any] = None
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

@app.post("/api/html-parser/parse", response_model=HtmlParseResponse)
async def parse_html(request: HtmlParseRequest):
    """
    Parse HTML content based on provided extraction rules.
    
    This endpoint accepts HTML content and a list of extraction rules,
    then returns the extracted data according to those rules.
    """
    try:
        result = parse_html_content(request.html_content, request.extraction_rules)
        
        # Check if parsing resulted in an error
        if "error" in result:
            return HtmlParseResponse(
                status="error",
                error=result["error"]
            )
        
        return HtmlParseResponse(
            status="success",
            data=result
        )
    
    except Exception as e:
        logger.error(f"Error in HTML parsing: {str(e)}")
        return HtmlParseResponse(
            status="error",
            error=f"Failed to process request: {str(e)}"
        ) 