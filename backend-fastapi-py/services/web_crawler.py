import asyncio
import logging
from typing import Dict, Optional, Any, List, Union
from playwright.async_api import async_playwright, Error as PlaywrightError, Page, Browser, Frame
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
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7"
    }
    if headers:
        default_headers.update(headers)
        logger.info(f"Using custom headers: {list(headers.keys())}")
    else:
        logger.info("Using default headers.")
    await page.set_extra_http_headers(default_headers)

async def _navigate_and_wait(page: Page, url: str, timeout: int):
    """Navigates to the URL and waits for load states."""
    logger.info(f"Navigating to {url}")
    navigation_timeout = timeout * 0.8
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=navigation_timeout)
        logger.info(f"Navigation complete, waiting for network idle (timeout: {timeout * 0.2}ms)")
        await page.wait_for_load_state("networkidle", timeout=timeout * 0.2)
        logger.info("Network is idle.")
    except PlaywrightError as nav_err:
        if "net::ERR_ABORTED" in str(nav_err):
             logger.warning(f"Navigation request aborted, possibly due to client-side redirect or script interference. Proceeding cautiously.")
        elif "Timeout" in str(nav_err):
             logger.warning(f"Timeout during navigation or network idle wait: {str(nav_err)}")
        else:
             logger.error(f"Navigation error for {url}: {str(nav_err)}")
             raise
    except Exception as e:
        logger.error(f"Unexpected error during navigation/wait for {url}: {str(e)}")
        raise

async def _find_target_frame(page: Page, iframe_selector: Optional[str]) -> Union[Page, Frame]:
    """Finds the target iframe or returns the main page."""
    if not iframe_selector:
        logger.info("No iframe selector provided, using main page context.")
        return page

    logger.info(f"Attempting to find iframe with selector: {iframe_selector}")
    try:
        iframe_element = await page.wait_for_selector(iframe_selector, state="attached", timeout=5000)
        if iframe_element:
            frame = await iframe_element.content_frame()
            if frame:
                logger.info(f"Successfully found and switched context to iframe: {iframe_selector}")
                return frame
            else:
                logger.warning(f"Found iframe element for '{iframe_selector}', but could not get content frame.")
        else:
             logger.warning(f"Iframe element not found for selector '{iframe_selector}' within timeout.")

    except PlaywrightError as e:
        logger.warning(f"Error finding or waiting for iframe '{iframe_selector}': {str(e)}. Falling back to main page context.")
    except Exception as e:
         logger.error(f"Unexpected error getting iframe context '{iframe_selector}': {str(e)}. Falling back to main page context.")

    return page

async def _wait_for_optional_selector(context: Union[Page, Frame], selector: Optional[str], timeout: int, context_name: str = "Context"):
    """Waits for an optional selector within the given context (Page or Frame)."""
    if not selector:
        return

    logger.info(f"[{context_name}] Waiting for selector: {selector}")
    try:
        # Use a portion of the *remaining* timeout logically allocated to this step
        # This requires careful timeout management in the main function
        selector_timeout = timeout # Pass the allocated timeout directly
        await context.wait_for_selector(selector, state="visible", timeout=selector_timeout)
        logger.info(f"[{context_name}] Selector '{selector}' found and visible.")
    except PlaywrightError as pe:
        if "Timeout" in str(pe):
            logger.warning(f"[{context_name}] Selector '{selector}' did not appear or become visible within timeout ({selector_timeout}ms).")
        else:
            logger.error(f"[{context_name}] Playwright error waiting for selector '{selector}': {str(pe)}")
            # Decide if this should be a fatal error for the crawl
            # raise pe # Optional: re-raise to fail the crawl
    except Exception as e:
        logger.error(f"[{context_name}] Unexpected error waiting for selector '{selector}': {str(e)}")
        # raise e # Optional: re-raise unexpected errors

async def _extract_content(context: Union[Page, Frame], include_html: bool) -> tuple[Optional[str], Optional[str], Optional[str]]:
    """Extracts page title (main page only), text content, and optionally HTML from the context."""
    title: Optional[str] = None
    text: Optional[str] = None
    html: Optional[str] = None
    context_type = "Page" if isinstance(context, Page) else f"Frame({context.name or context.url[:50]})"

    if isinstance(context, Page):
        try:
            title = await context.title()
        except Exception as title_e:
            logger.warning(f"Could not get page title: {str(title_e)}")

    try:
        page_content = await context.content()
        if include_html:
            html = page_content
            logger.info(f"[{context_type}] HTML content captured (length: {len(html)})")
        
        soup = BeautifulSoup(page_content, 'lxml' if 'lxml' in globals() else 'html.parser') 
        for script in soup(["script", "style"]):
            script.extract()
        raw_text = soup.get_text(separator='\n', strip=True)
        text = '\n'.join(line for line in raw_text.splitlines() if line.strip())
        logger.info(f"[{context_type}] Text content extracted (length: {len(text) if text else 0})")

    except Exception as content_e:
        logger.error(f"[{context_type}] Error extracting content: {str(content_e)}")

    return title, text, html

async def _extract_selectors_data(context: Union[Page, Frame], selectors: Optional[Dict[str, str]]) -> Dict[str, Any]:
    """Extracts data based on specific CSS selectors within the given context."""
    if not selectors:
        return {}

    extracted_data: Dict[str, Any] = {}
    context_type = "Page" if isinstance(context, Page) else f"Frame({context.name or context.url[:50]})"
    logger.info(f"[{context_type}] Extracting specific selectors: {list(selectors.keys())}")
    for name, selector in selectors.items():
        try:
            elements = await context.query_selector_all(selector)
            if elements:
                element_texts = []
                for element in elements:
                    text_content = await element.inner_text()
                    element_texts.append(text_content.strip() if text_content else "")
                
                if len(element_texts) == 1:
                    extracted_data[name] = element_texts[0]
                elif len(element_texts) > 1:
                    extracted_data[name] = element_texts
                else:
                    extracted_data[name] = None
            else:
                extracted_data[name] = None
                logger.warning(f"[{context_type}] No elements found for selector '{selector}' (name: '{name}')")
        except Exception as e:
            logger.warning(f"[{context_type}] Error extracting '{name}' with selector '{selector}': {str(e)}")
            extracted_data[name] = None
    logger.info(f"[{context_type}] Finished extracting specific selectors. Found data for keys: {list(extracted_data.keys())}")
    return extracted_data

# --- Main Public Function --- 

async def crawl_webpage(
    url: str,
    iframe_selector: Optional[str] = None,
    wait_for_selector_on_page: Optional[str] = None,
    wait_for_selector_in_iframe: Optional[str] = None,
    extract_selectors: Optional[Dict[str, str]] = None,
    extract_element_selector: Optional[str] = None,
    timeout: int = 30000,
    headers: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """
    Crawls a webpage using Playwright, potentially focusing on a specific iframe,
    and extracts content. Handles dynamic content loading and provides error handling.
    
    Args:
        url: URL to crawl
        iframe_selector: Optional CSS selector for the target iframe.
        wait_for_selector_on_page: Optional CSS selector to wait for on the main page.
        wait_for_selector_in_iframe: Optional CSS selector to wait for within the target iframe.
        extract_selectors: Dictionary of name:selector pairs for targeted extraction within the context.
        extract_element_selector: Optional CSS selector to extract a specific element's HTML.
        timeout: Total timeout for the operation in milliseconds
        headers: HTTP headers to send with the request
        
    Returns:
        Dictionary with page data including status and potential error.
    """
    logger.info(f"Crawling URL: {url} with timeout {timeout}ms. Target iframe: {iframe_selector}, Extract Element: {extract_element_selector}")
    
    result = {
        "url": url,
        "title": None,
        "text": None,
        "html": None,
        "extracted_content": None,
        "extracted_data": {},
        "status": "success",
        "error": None
    }
    
    browser: Optional[Browser] = None 
    try:
        # Allocate portions of the timeout
        # Example: 60% for navigation, 10% for page wait, 5% for iframe find, 15% for iframe wait
        nav_timeout = timeout * 0.6
        page_wait_timeout = timeout * 0.1
        iframe_find_timeout = 5000 # Keep iframe find relatively short
        iframe_wait_timeout = timeout * 0.15 
        # Remaining time for extraction? Ensure total doesn't exceed original timeout.

        browser, page = await _setup_browser_and_page()
        await _set_page_headers(page, headers)
        
        # Step 1: Navigate and basic wait
        await _navigate_and_wait(page, url, int(nav_timeout)) # Pass allocated timeout
        
        # Step 2: Wait for selector on the main page
        await _wait_for_optional_selector(page, wait_for_selector_on_page, int(page_wait_timeout), context_name="Page")

        # Step 3: Find the target iframe (if specified)
        # Use a dedicated timeout for finding the frame element
        # Note: _find_target_frame uses its own internal timeout (5000ms currently)
        target_context = await _find_target_frame(page, iframe_selector)
        context_name = "Page" if isinstance(target_context, Page) else f"Frame({iframe_selector})"

        # Step 4: Wait for selector within the determined context (iframe or page)
        selector_to_wait_in_context = wait_for_selector_in_iframe if isinstance(target_context, Frame) else None
        # If context is page, wait_for_selector_on_page was already handled. 
        # If context is frame, wait using wait_for_selector_in_iframe.
        if isinstance(target_context, Frame):
             await _wait_for_optional_selector(target_context, wait_for_selector_in_iframe, int(iframe_wait_timeout), context_name=context_name)
        # else: The page context wait was done in step 2.

        # Step 5: Extract content or specific element
        if extract_element_selector:
            logger.info(f"[{context_name}] Attempting to extract element with selector: {extract_element_selector}")
            element = await target_context.query_selector(extract_element_selector)
            if element:
                # Decide whether to use inner_html or outer_html
                # inner_html excludes the element itself, outer_html includes it.
                extracted_html = await element.inner_html() # Or outer_html()
                result["extracted_content"] = extracted_html
                logger.info(f"[{context_name}] Successfully extracted element HTML (length: {len(extracted_html)}). Setting full html to None.")
                result["html"] = None # Don't include full HTML if element is extracted
                # Optionally extract text content of the specific element too? 
                # result["text"] = await element.text_content()
            else:
                error_message = f"Could not find element matching selector: {extract_element_selector}"
                logger.warning(f"[{context_name}] {error_message}")
                result["status"] = "error"
                result["error"] = error_message
                # Return early if the required element wasn't found?
                # return result # Optional: stop processing here
        else:
            # Original behavior: Extract full content if no specific element selector is given
            logger.info(f"[{context_name}] No specific element selector provided, extracting full content.")
            # Determine if full HTML is needed (might be needed for text extraction anyway)
            needs_full_html = True # Assume needed for text extraction or if requested explicitly later
            title, text, html = await _extract_content(target_context, needs_full_html)
            result["title"] = title 
            result["text"] = text
            result["html"] = html # Store the full HTML

        # Step 6: Extract specific selectors (can run even if specific element was extracted)
        # If result is already error, maybe skip this?
        if result["status"] == "success":
            result["extracted_data"] = await _extract_selectors_data(target_context, extract_selectors)

    except PlaywrightError as pe:
        error_msg = f"Playwright Error: {str(pe)}"
        logger.error(f"{error_msg} during crawl of {url}")
        result["status"] = "error"
        result["error"] = error_msg
    except Exception as e:
        error_msg = f"Unexpected Error: {str(e)}"
        logger.exception(f"{error_msg} during crawl of {url}")
        result["status"] = "error"
        result["error"] = error_msg
    finally:
        if browser:
            logger.info("Closing browser.")
            await browser.close()
            
    return result

# Removed unused helper functions sanitize_content and structure_content
# def sanitize_content(content: str) -> str: ...
# def structure_content(extracted_data: Dict[str, Any], schema: Optional[Dict[str, Any]] = None) -> Dict[str, Any]: ... 