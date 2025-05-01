/**
 * Utility function to fetch and extract data from web pages using a backend crawler service.
 * 
 * @param params Object containing crawling parameters
 * @param params.url URL to crawl
 * @param params.waitForSelectorOnPage Optional CSS selector to wait for on the main page.
 * @param params.iframeSelector Optional CSS selector for the target iframe.
 * @param params.waitForSelectorInIframe Optional CSS selector to wait for inside the iframe.
 * @param params.timeout Optional time to wait in milliseconds (passed as timeout to backend)
 * @param params.headers Optional HTTP headers to include in the request
 * @param params.include_html Whether to include the full HTML in the response
 * @returns Promise resolving to the backend response object or null if failed
 */
export async function crawling({
  url,
  waitForSelectorOnPage,
  iframeSelector,
  waitForSelectorInIframe,
  timeout = 30000, // Default timeout in ms
  headers,
  include_html = true,
}: {
  url: string;
  waitForSelectorOnPage?: string;
  iframeSelector?: string;
  waitForSelectorInIframe?: string;
  timeout?: number;
  headers?: Record<string, string>; 
  include_html?: boolean;
}): Promise<any | null> { 
  console.log(`[Crawler] Starting crawl request for URL: ${url}`);
  console.log(`[Crawler] Page Wait Selector: ${waitForSelectorOnPage || 'N/A'}`);
  console.log(`[Crawler] IFrame Selector: ${iframeSelector || 'N/A'}`);
  console.log(`[Crawler] IFrame Wait Selector: ${waitForSelectorInIframe || 'N/A'}`);
  console.log(`[Crawler] Include HTML: ${include_html}`);
  console.log(`[Crawler] Timeout (ms): ${timeout}`);

  if (headers && Object.keys(headers).length > 0) {
    console.log(`[Crawler] Using custom headers:`, headers);
  }
  
  try {
    // Use the correct backend API endpoint URL
    const backendUrl = 'http://localhost:8000/api/web-crawler/fetch'; 
    console.log(`[Crawler] Calling backend API: ${backendUrl}`);

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        waitForSelectorOnPage: waitForSelectorOnPage,
        iframeSelector: iframeSelector,
        waitForSelectorInIframe: waitForSelectorInIframe,
        timeout: timeout, // Pass timeout in milliseconds
        headers: headers, // Pass headers
        include_html: include_html, // Pass include_html flag
      }),
    });
    
    if (!response.ok) {
      let errorDetail = `HTTP error! Status: ${response.status}`;
      try {
        // Attempt to parse backend error message
        const errorData = await response.json();
        errorDetail = errorData.error || errorData.detail || errorDetail;
      } catch (e) { 
        // If response is not JSON or empty, use status text
        errorDetail = `${errorDetail} - ${response.statusText}`;
      } 
      console.error(`[Crawler] Error fetching from backend: ${errorDetail}`);
      // Return a structured error similar to backend for consistency?
      // For now, return null to indicate frontend/network level failure
      return null; 
    }
    
    // Parse the JSON response from the backend
    const data = await response.json();
    
    // Log status regardless of success/error for visibility
    console.log(`[Crawler] Backend response status: ${data.status}`);
    if (data.status !== 'success') {
      console.error(`[Crawler] Backend API reported failure: ${data.error || 'Unknown backend error'}`);
      // Return the structured error response from backend
      return data; 
    }
    
    console.log(`[Crawler] Successfully received data from backend for ${url}`);
    // Return the entire result object from backend
    return data;

  } catch (error) {
    // Catch network errors or other exceptions during fetch
    console.error('[Crawler] Exception during fetch operation:', error);
    return null; // Indicate failure due to exception
  }
} 