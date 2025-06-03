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
  try {
    console.log(`[crawling] Calling backend API for URL: ${url}`);
    
    // 백엔드 API URL 설정 (환경에 따라 변경 가능)
    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
    
    // 백엔드 API 요청 본문 구성 (WebCrawlerRequest 모델에 맞춤)
    const requestBody = {
      url,
      waitForSelectorOnPage,
      iframeSelector,
      waitForSelectorInIframe,
      timeout,
      headers: headers || {},
      extractElementSelector: extract_element_selector,
      output_format: output_format || 'html'
    };

    // 백엔드 API 호출
    const response = await fetch(`${BACKEND_URL}/api/web-crawler/fetch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      console.error(`[crawling] Backend API returned status ${response.status}: ${response.statusText}`);
      return null;
    }

    const result = await response.json();
    console.log(`[crawling] Backend response status: ${result.status}`);
    
    // WebCrawlerResponse 모델에 따른 응답 처리
    return result;
    
  } catch (error) {
    console.error(`[crawling] Error during API call:`, error);
    return null;
  }
} 