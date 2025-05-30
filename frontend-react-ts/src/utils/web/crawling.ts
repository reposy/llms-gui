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
 * @param params.extract_element_selector Optional CSS selector to extract an element
 * @param params.output_format Optional output format for the response
 * @returns Promise resolving to the backend response object or null if failed
 */
export async function crawling({
  url,
  waitForSelectorOnPage,
  iframeSelector,
  waitForSelectorInIframe,
  timeout = 30000, // Default timeout in ms
  headers,
  extract_element_selector,
  output_format,
}: {
  url: string;
  waitForSelectorOnPage?: string;
  iframeSelector?: string;
  waitForSelectorInIframe?: string;
  timeout?: number;
  headers?: Record<string, string>; 
  extract_element_selector?: string;
  output_format?: string;
}): Promise<any | null> { 
  // ... existing code ...
} 