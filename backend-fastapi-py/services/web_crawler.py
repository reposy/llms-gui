import asyncio
import logging
from typing import Dict, Optional, Any, List
from playwright.async_api import async_playwright, Error as PlaywrightError
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
    timeout: int = 30000,  # Timeout now consistently in milliseconds
    headers: Optional[Dict[str, str]] = None,
    include_html: bool = False
) -> Dict[str, Any]:
    """
    Crawls a webpage using Playwright and extracts content.
    Handles dynamic content loading and provides robust error handling.
    
    Args:
        url: URL to crawl
        wait_for_selector: Optional CSS selector to wait for after network idle
        extract_selectors: Dictionary of name:selector pairs for targeted extraction
        timeout: Total timeout for the operation in milliseconds
        headers: HTTP headers to send with the request
        include_html: Whether to include the full HTML in the response
        
    Returns:
        Dictionary with page data including status and potential error.
    """
    logger.info(f"Crawling URL: {url} with timeout {timeout}ms")
    
    # Initialize result structure with default values
    result = {
        "url": url,
        "title": None,
        "text": None,
        "html": None,
        "extracted_data": {},
        "status": "success", # Assume success initially
        "error": None
    }
    
    browser = None # Define browser outside try block for cleanup
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()
            
            # Set headers
            default_headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            }
            if headers:
                default_headers.update(headers)
            await page.set_extra_http_headers(default_headers)
            
            # Navigate and wait for initial load
            logger.info(f"Navigating to {url} (waiting for domcontentloaded)")
            # Use half of the timeout for the initial navigation
            nav_timeout = timeout / 2 
            await page.goto(url, wait_until="domcontentloaded", timeout=nav_timeout)
            
            # Wait for network activity to settle
            logger.info(f"Waiting for network idle (timeout: {timeout / 2}ms)")
            try:
                # Use the remaining half of the timeout
                await page.wait_for_load_state("networkidle", timeout=timeout / 2)
                logger.info("Network is idle.")
            except PlaywrightError as net_idle_e:
                # Log warning but continue if network doesn't fully idle
                logger.warning(f"Network did not fully idle within timeout: {str(net_idle_e)}")
            except Exception as e:
                logger.warning(f"Error during network idle wait: {str(e)}")

            # Wait for specific selector if provided (after network idle attempt)
            if wait_for_selector:
                logger.info(f"Waiting for selector: {wait_for_selector}")
                try:
                    # Use a smaller portion of the original timeout for this wait
                    await page.wait_for_selector(wait_for_selector, timeout=max(5000, timeout / 5)) # e.g., 5s or 1/5th of total
                except PlaywrightError as selector_e:
                    # Log warning but proceed if selector not found
                    logger.warning(f"Selector '{wait_for_selector}' not found or timed out: {str(selector_e)}")
                except Exception as e:
                    logger.warning(f"Error waiting for selector '{wait_for_selector}': {str(e)}")

            # --- Content Extraction --- 
            # Get title (even if some waits failed)
            try:
                result["title"] = await page.title()
            except Exception as title_e:
                 logger.warning(f"Could not get page title: {str(title_e)}")

            # Get page content
            try:
                content = await page.content()
                
                # Store HTML if requested
                if include_html:
                    result["html"] = content
                
                # Extract page text using BeautifulSoup
                soup = BeautifulSoup(content, 'html.parser')
                for script in soup(["script", "style"]):
                    script.extract()
                text = soup.get_text(separator='\n')
                lines = [line.strip() for line in text.splitlines()]
                result["text"] = '\n'.join(line for line in lines if line)

            except Exception as content_e:
                logger.error(f"Error extracting main content/text: {str(content_e)}")
                # Mark status as error if core content extraction fails
                result["status"] = "error"
                result["error"] = f"Failed to extract page content: {str(content_e)}"
                # Skip further extraction if content failed
                # Close browser and return immediately
                await browser.close()
                return result

            # Extract specific content using selectors if provided
            if extract_selectors and result["status"] == "success": # Only run if no major error yet
                extracted_data = {}
                logger.info(f"Extracting specific selectors: {list(extract_selectors.keys())}")
                for name, selector in extract_selectors.items():
                    try:
                        elements = await page.query_selector_all(selector)
                        if elements:
                            element_texts = []
                            for element in elements:
                                text_content = await element.text_content()
                                element_texts.append(text_content.strip() if text_content else "")
                            
                            if len(element_texts) == 1:
                                extracted_data[name] = element_texts[0]
                            elif len(element_texts) > 1:
                                 extracted_data[name] = element_texts
                            else:
                                extracted_data[name] = None # Should not happen if elements found
                        else:
                            extracted_data[name] = None
                    except Exception as e:
                        logger.warning(f"Error extracting '{name}' with selector '{selector}': {str(e)}")
                        extracted_data[name] = None
                result["extracted_data"] = extracted_data
            
            # --- End Content Extraction --- 
            
            await browser.close() # Close browser on success
            browser = None # Mark as closed
            logger.info(f"Successfully crawled and processed {url}")
            
    except PlaywrightError as pe:
        logger.error(f"Playwright error crawling {url}: {str(pe)}")
        result["status"] = "error"
        result["error"] = f"Playwright Error: {str(pe)}"
    except Exception as e:
        logger.error(f"Generic error crawling {url}: {str(e)}", exc_info=True) # Log traceback for generic errors
        result["status"] = "error"
        result["error"] = f"Unexpected Error: {str(e)}"
    finally:
        # Ensure browser is closed even if an error occurred mid-process
        if browser and browser.is_connected():
            logger.info("Closing browser due to error or completion.")
            await browser.close()
    
    # Return the final result dictionary (includes status and error if any)
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