import logging
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field, HttpUrl
from typing import Optional, Dict, Any, List
from services.web_crawler import crawl_webpage
from services.html_parser import ExtractionRule, parse_html_content
from services.file_service import save_uploaded_file, get_file_path, file_exists, list_files

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

# 파일 업로드 API 엔드포인트
@app.post("/api/files/upload", response_model=Dict[str, Any])
async def upload_file(file: UploadFile = File(...)):
    """
    파일을 서버에 업로드합니다. 현재는 이미지 파일만 지원합니다.
    최대 파일 크기는 10MB입니다.
    """
    try:
        logger.info(f"File upload request received: {file.filename}")
        result = await save_uploaded_file(file)
        logger.info(f"File uploaded successfully: {result['filename']}")
        return result
    except HTTPException as e:
        # HTTPException은 이미 적절한 형식이므로 그대로 발생시킴
        logger.warning(f"File upload validation error: {e.detail}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error during file upload: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to upload file: {str(e)}")

@app.get("/api/files/{filename}")
async def get_file(filename: str):
    """
    업로드된 파일을 가져옵니다.
    """
    if not file_exists(filename):
        logger.warning(f"File not found: {filename}")
        raise HTTPException(status_code=404, detail="File not found")
    
    file_path = get_file_path(filename)
    logger.info(f"Serving file: {file_path}")
    return FileResponse(file_path)

@app.get("/api/files", response_model=List[Dict[str, Any]])
async def get_files(limit: Optional[int] = 100):
    """
    업로드된 파일 목록을 반환합니다.
    """
    logger.info(f"Listing files with limit: {limit}")
    return list_files(limit) 