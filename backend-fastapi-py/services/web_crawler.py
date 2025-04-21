import asyncio
import logging
from typing import Dict, Optional, Any, List
from playwright.async_api import async_playwright, Error as PlaywrightError, Page, Browser
import json
import re
from bs4 import BeautifulSoup

# Removed basicConfig from here
# logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- Private Helper Functions --- 

async def _setup_browser_and_page(headless: bool = True) -> tuple[Browser, Page]:
    """Launches browser and creates a new page."""
    p = await async_playwright().start()
    browser = await p.chromium.launch(headless=headless)
    page = await browser.new_page()
    logger.info("Browser and page initialized.")
    return browser, page

async def _set_page_headers(page: Page, headers: Optional[Dict[str, str]]):
    """Sets extra HTTP headers for the page."""
    default_headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }
    if headers:
        default_headers.update(headers)
        logger.info(f"Using custom headers: {list(headers.keys())}")
    else:
        logger.info("Using default User-Agent header.")
    await page.set_extra_http_headers(default_headers)

async def _navigate_and_wait(page: Page, url: str, timeout: int):
    """Navigates to the URL and waits for load states."""
    logger.info(f"Navigating to {url} (waiting for domcontentloaded)")
    nav_timeout = timeout / 2 
    await page.goto(url, wait_until="domcontentloaded", timeout=nav_timeout)
    
    logger.info(f"Waiting for network idle (timeout: {timeout / 2}ms)")
    try:
        await page.wait_for_load_state("networkidle", timeout=timeout / 2)
        logger.info("Network is idle.")
    except PlaywrightError as net_idle_e:
        logger.warning(f"Network did not fully idle within timeout: {str(net_idle_e)}")
    except Exception as e:
        logger.warning(f"Error during network idle wait: {str(e)}")

async def _wait_for_optional_selector(page: Page, selector: Optional[str], timeout: int):
    """Waits for an optional selector if provided."""
    if not selector:
        return
        
    logger.info(f"Waiting for selector: {selector}")
    try:
        selector_timeout = max(5000, timeout / 5)
        await page.wait_for_selector(selector, timeout=selector_timeout)
        logger.info(f"Selector '{selector}' found.")
    except PlaywrightError as selector_e:
        logger.warning(f"Selector '{selector}' not found or timed out: {str(selector_e)}")
    except Exception as e:
        logger.warning(f"Error waiting for selector '{selector}': {str(e)}")

async def _extract_content(page: Page, include_html: bool) -> tuple[Optional[str], Optional[str], Optional[str]]:
    """Extracts page title, text content, and optionally HTML."""
    title: Optional[str] = None
    text: Optional[str] = None
    html: Optional[str] = None

    try:
        title = await page.title()
    except Exception as title_e:
        logger.warning(f"Could not get page title: {str(title_e)}")

    try:
        page_content = await page.content()
        if include_html:
            html = page_content
            logger.info(f"HTML content captured (length: {len(html)})")
        
        # Use lxml parser if installed for potentially better performance/robustness
        soup = BeautifulSoup(page_content, 'lxml' if 'lxml' in globals() else 'html.parser') 
        for script in soup(["script", "style"]):
            script.extract()
        raw_text = soup.get_text(separator='\n')
        lines = [line.strip() for line in raw_text.splitlines()]
        text = '\n'.join(line for line in lines if line)
        logger.info(f"Text content extracted (length: {len(text) if text else 0})")

    except Exception as content_e:
        logger.error(f"Error extracting main content/text: {str(content_e)}")
        # Raise the exception to be caught by the main function's handler
        raise content_e 

    return title, text, html

async def _extract_selectors_data(page: Page, selectors: Optional[Dict[str, str]]) -> Dict[str, Any]:
    """Extracts data based on specific CSS selectors."""
    if not selectors:
        return {}

    extracted_data: Dict[str, Any] = {}
    logger.info(f"Extracting specific selectors: {list(selectors.keys())}")
    for name, selector in selectors.items():
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
                    extracted_data[name] = None
            else:
                extracted_data[name] = None
                logger.warning(f"No elements found for selector '{selector}' (name: '{name}')")
        except Exception as e:
            logger.warning(f"Error extracting '{name}' with selector '{selector}': {str(e)}")
            extracted_data[name] = None
    logger.info(f"Finished extracting specific selectors. Found data for keys: {list(extracted_data.keys())}")
    return extracted_data

# --- Main Public Function --- 

async def crawl_webpage(
    url: str,
    wait_for_selector: Optional[str] = None,
    extract_selectors: Optional[Dict[str, str]] = None,
    timeout: int = 30000,  # Timeout in milliseconds
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
    
    result = {
        "url": url,
        "title": None,
        "text": None,
        "html": None,
        "extracted_data": {},
        "status": "success",
        "error": None
    }
    
    browser: Optional[Browser] = None 
    try:
        browser, page = await _setup_browser_and_page()
        await _set_page_headers(page, headers)
        await _navigate_and_wait(page, url, timeout)
        await _wait_for_optional_selector(page, wait_for_selector, timeout)
        
        # Extract content (title, text, html)
        title, text, html = await _extract_content(page, include_html)
        result["title"] = title
        result["text"] = text
        result["html"] = html # Will be None if include_html is False or error occurred

        # Extract specific selectors if requested
        extracted_data = await _extract_selectors_data(page, extract_selectors)
        result["extracted_data"] = extracted_data
            
        logger.info(f"Successfully crawled and processed {url}")
            
    except PlaywrightError as pe:
        logger.error(f"Playwright error during crawl of {url}: {str(pe)}")
        result["status"] = "error"
        result["error"] = f"Playwright Error: {str(pe)}"
    except Exception as e:
        logger.error(f"Generic error during crawl of {url}: {str(e)}", exc_info=True)
        result["status"] = "error"
        result["error"] = f"Unexpected Error: {str(e)}"
    finally:
        if browser and browser.is_connected():
            logger.info("Closing browser.")
            await browser.close()
    
    return result

# Removed unused helper functions sanitize_content and structure_content
# def sanitize_content(content: str) -> str: ...
# def structure_content(extracted_data: Dict[str, Any], schema: Optional[Dict[str, Any]] = None) -> Dict[str, Any]: ... 