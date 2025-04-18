/**
 * Utility function to fetch and extract data from web pages using a backend crawler service.
 * 
 * @param params Object containing crawling parameters
 * @param params.url URL to crawl
 * @param params.selector CSS selector to extract content
 * @param params.attribute Optional attribute to extract from the selected element (defaults to text content)
 * @param params.waitBeforeLoad Optional time to wait in milliseconds before extracting data
 * @returns Promise resolving to the extracted result or null if failed
 */
export async function crawling({
  url,
  selector,
  attribute,
  waitBeforeLoad,
}: {
  url: string;
  selector: string;
  attribute?: string;
  waitBeforeLoad?: number;
}): Promise<string | null> {
  console.log(`[Crawler] Starting crawl request for URL: ${url}`);
  console.log(`[Crawler] Using selector: ${selector}`);
  
  if (attribute) {
    console.log(`[Crawler] Extracting attribute: ${attribute}`);
  }
  
  if (waitBeforeLoad) {
    console.log(`[Crawler] Will wait ${waitBeforeLoad}ms before extraction`);
  }
  
  try {
    const response = await fetch('http://localhost:8000/api/crawl', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        selector,
        attribute,
        waitBeforeLoad,
      }),
    });
    
    if (!response.ok) {
      console.error(`[Crawler] Error: HTTP status ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (!data.success) {
      console.error(`[Crawler] API reported failure: ${data.error || 'Unknown error'}`);
      return null;
    }
    
    console.log(`[Crawler] Successfully extracted data from ${url}`);
    return data.result;
  } catch (error) {
    console.error('[Crawler] Exception during crawling:', error);
    return null;
  }
} 