import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, HttpUrl
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
origins = [
    "http://localhost:5173", # Default Vite dev server port
    "http://127.0.0.1:5173",
    # Add other origins if necessary (e.g., production frontend URL)
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], # Allows all methods
    allow_headers=["*"], # Allows all headers
)

class WebCrawlerRequest(BaseModel):
    url: HttpUrl
    waitForSelectorOnPage: Optional[str] = Field(None, alias='waitForSelectorOnPage')
    iframeSelector: Optional[str] = Field(None, alias='iframeSelector')
    waitForSelectorInIframe: Optional[str] = Field(None, alias='waitForSelectorInIframe')
    timeout: int = 30000
    headers: Optional[Dict[str, str]] = None
    extract_element_selector: Optional[str] = Field(None, alias='extractElementSelector')
    output_format: Optional[str] = 'html'

class WebCrawlerResponse(BaseModel):
    url: str
    status: str
    error: Optional[str] = None
    title: Optional[str] = None
    text: Optional[str] = None
    html: Optional[str] = None
    extracted_content: Optional[str] = None
    extracted_data: Optional[Dict[str, Any]] = None

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

@app.post("/api/web-crawler/fetch", response_model=WebCrawlerResponse)
async def fetch_webpage_content(request: WebCrawlerRequest):
    logger.info(f"Received crawl request for URL: {request.url}")
    logger.info(f"Request details: iframe={request.iframeSelector}, waitPage={request.waitForSelectorOnPage}, waitIframe={request.waitForSelectorInIframe}, extractSelector={request.extract_element_selector}")
    try:
        result = await crawl_webpage(
            url=str(request.url),
            iframe_selector=request.iframeSelector,
            wait_for_selector_on_page=request.waitForSelectorOnPage,
            wait_for_selector_in_iframe=request.waitForSelectorInIframe,
            timeout=request.timeout,
            headers=request.headers,
            extract_element_selector=request.extract_element_selector
        )
        
        logger.info(f"Crawl for {request.url} finished with status: {result.get('status')}")
        return result
        
    except Exception as e:
        logger.exception(f"Unhandled exception during crawl request for {request.url}: {e}")
        return WebCrawlerResponse(
            url=str(request.url),
            status="error",
            error=f"Internal Server Error: {str(e)}",
            title=None,
            text=None,
            html=None,
            extracted_content=None,
            extracted_data=None
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