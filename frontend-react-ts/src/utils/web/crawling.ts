/**
 * Utility function to fetch and extract data from web pages using a backend crawler service.
 * 
 * @param params Object containing crawling parameters
 * @param params.url URL to crawl
 * @param params.selector CSS selector to wait for (used by backend)
 * @param params.attribute Optional attribute to extract (handled by backend if extract_selectors is used)
 * @param params.waitBeforeLoad Optional time to wait in milliseconds (passed as timeout_ms to backend)
 * @param params.headers Optional HTTP headers to include in the request
 * @param params.include_html Whether to include the full HTML in the response
 * @returns Promise resolving to the backend response object or null if failed
 */
export async function crawling({
  url,
  selector,
  attribute, // Keep for potential backend use with extract_selectors
  waitBeforeLoad,
  headers,
  include_html = true, // Default to true as we want HTML
}: {
  url: string;
  selector?: string;
  attribute?: string;
  waitBeforeLoad?: number; // Keep as milliseconds
  headers?: Record<string, string>; 
  include_html?: boolean; // Use include_html instead of returnFormat
}): Promise<any | null> { // Return type might be the full backend response object now
  console.log(`[Crawler] Starting crawl request for URL: ${url}`);
  console.log(`[Crawler] Using selector: ${selector || 'N/A'}`);
  console.log(`[Crawler] Include HTML: ${include_html}`);
  
  // Use waitBeforeLoad directly (milliseconds)
  const timeoutMs = waitBeforeLoad !== undefined ? waitBeforeLoad : 30000; // Use default 30000ms if undefined
  console.log(`[Crawler] Timeout (ms): ${timeoutMs}`);

  if (headers && Object.keys(headers).length > 0) {
    console.log(`[Crawler] Using custom headers:`, headers);
  }
  
  try {
    // Corrected API endpoint
    const response = await fetch('http://localhost:8000/api/web-crawler/fetch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        wait_for_selector: selector, // Backend expects snake_case
        // extract_selectors: {}, // Not passing this for now, focus on HTML
        timeout: timeoutMs, // Pass timeout in milliseconds
        headers, // Pass headers
        include_html, // Pass include_html flag
        // Remove attribute and returnFormat if not directly used by this call
      }),
    });
    
    if (!response.ok) {
      // Try to get error message from response body
      let errorDetail = `HTTP status ${response.status}`;
      try {
        const errorData = await response.json();
        errorDetail = errorData.detail || errorDetail;
      } catch (e) { /* Ignore JSON parsing error */ }
      console.error(`[Crawler] Error: ${errorDetail}`);
      return null; // Indicate failure
    }
    
    const data = await response.json();
    
    // Check backend status field
    if (data.status !== 'success') {
      console.error(`[Crawler] API reported failure: ${data.error || 'Unknown error'}`);
      return null; // Indicate failure based on backend status
    }
    
    console.log(`[Crawler] Successfully fetched data from ${url}`);
    // Return the entire result object from backend, let the caller extract HTML
    return data;
  } catch (error) {
    console.error('[Crawler] Exception during crawling:', error);
    return null;
  }
} 