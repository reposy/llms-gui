import asyncio
import logging
from typing import Dict, Optional, Any, List
from playwright.async_api import async_playwright
import json
import re
from bs4 import BeautifulSoup

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def crawl_webpage(
    url: str,
    wait_for_selector: Optional[str] = None,
    extract_selectors: Optional[Dict[str, str]] = None,
    timeout: int = 30000,
    headers: Optional[Dict[str, str]] = None,
    include_html: bool = False
) -> Dict[str, Any]:
    """
    Crawls a webpage using Playwright and extracts content based on provided selectors
    
    Args:
        url: URL to crawl
        wait_for_selector: CSS selector to wait for before extraction
        extract_selectors: Dictionary of name:selector pairs for targeted extraction
        timeout: Timeout in milliseconds
        headers: HTTP headers to send with the request
        include_html: Whether to include the full HTML in the response
        
    Returns:
        Dictionary with extracted page data
    """
    logger.info(f"Crawling URL: {url}")
    
    result = {
        "title": "",
        "text": "",
        "status": "success",
        "extracted_data": {}
    }
    
    try:
        async with async_playwright() as p:
            # Launch browser
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()
            
            # Set default headers or override with provided headers
            default_headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            }
            
            if headers:
                default_headers.update(headers)
                
            await page.set_extra_http_headers(default_headers)
            
            # Navigate to the URL with timeout
            logger.info(f"Navigating to {url}")
            await page.goto(url, wait_until="networkidle", timeout=timeout)
            
            # Wait for specific selector if provided
            if wait_for_selector:
                logger.info(f"Waiting for selector: {wait_for_selector}")
                try:
                    await page.wait_for_selector(wait_for_selector, timeout=timeout)
                except Exception as e:
                    logger.warning(f"Selector '{wait_for_selector}' not found: {str(e)}")
            
            # Get page title
            result["title"] = await page.title()
            
            # Get page content
            content = await page.content()
            
            # Store HTML if requested
            if include_html:
                result["html"] = content
            
            # Extract page text using BeautifulSoup for better text extraction
            soup = BeautifulSoup(content, 'html.parser')
            
            # Remove script and style elements
            for script in soup(["script", "style"]):
                script.extract()
                
            # Extract text
            text = soup.get_text(separator='\n')
            
            # Clean up text: remove extra whitespace and blank lines
            lines = [line.strip() for line in text.splitlines()]
            text = '\n'.join(line for line in lines if line)
            result["text"] = text
            
            # Extract specific content using selectors if provided
            if extract_selectors:
                extracted_data = {}
                for name, selector in extract_selectors.items():
                    try:
                        elements = await page.query_selector_all(selector)
                        if elements:
                            # Multiple elements found
                            if len(elements) > 1:
                                extracted_data[name] = []
                                for element in elements:
                                    text_content = await element.text_content()
                                    extracted_data[name].append(text_content.strip())
                            # Single element found
                            else:
                                text_content = await elements[0].text_content()
                                extracted_data[name] = text_content.strip()
                        else:
                            extracted_data[name] = None
                    except Exception as e:
                        logger.error(f"Error extracting '{name}' with selector '{selector}': {str(e)}")
                        extracted_data[name] = None
                
                result["extracted_data"] = extracted_data
            
            # Clean up
            await browser.close()
            
            logger.info(f"Successfully crawled {url}")
            
    except Exception as e:
        logger.error(f"Error crawling {url}: {str(e)}")
        result["status"] = "error"
        result["error"] = str(e)
    
    return result

# Helper function to sanitize content
def sanitize_content(content: str) -> str:
    """Clean up extracted content by normalizing whitespace and removing non-printable chars"""
    # Replace multiple whitespace with a single space
    content = re.sub(r'\s+', ' ', content)
    # Strip leading/trailing whitespace
    content = content.strip()
    # Remove non-printable characters
    content = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]', '', content)
    return content

# Helper function to convert extracted content to structured JSON
def structure_content(
    extracted_data: Dict[str, Any], 
    schema: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Convert extracted data to a structured format based on optional schema
    
    Args:
        extracted_data: Dictionary of extracted data
        schema: Optional schema to structure the data (keys and types)
        
    Returns:
        Structured data following the schema
    """
    if not schema:
        return extracted_data
        
    result = {}
    
    for key, type_info in schema.items():
        if key not in extracted_data:
            result[key] = None
            continue
            
        value = extracted_data[key]
        
        # Apply type conversion based on schema
        if type_info == "string":
            result[key] = str(value) if value is not None else ""
        elif type_info == "integer":
            try:
                result[key] = int(value) if value is not None else 0
            except (ValueError, TypeError):
                result[key] = 0
        elif type_info == "float":
            try:
                result[key] = float(value) if value is not None else 0.0
            except (ValueError, TypeError):
                result[key] = 0.0
        elif type_info == "boolean":
            if isinstance(value, str):
                result[key] = value.lower() in ("yes", "true", "t", "1")
            else:
                result[key] = bool(value)
        elif type_info == "array" and isinstance(value, str):
            # Split string by commas if it's not already a list
            if not isinstance(value, list):
                result[key] = [item.strip() for item in value.split(',')]
            else:
                result[key] = value
        else:
            # Default: keep as is
            result[key] = value
    
    return result 