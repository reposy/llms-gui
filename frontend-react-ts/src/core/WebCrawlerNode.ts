import { FlowExecutionContext } from './FlowExecutionContext';
import { crawling } from '../utils/web/crawling';
import { WebCrawlerNodeContent } from '../types/nodes';
import { Node } from './Node';

/**
 * Web Crawler node implementation.
 */
export class WebCrawlerNode extends Node {
  constructor(id: string, data: WebCrawlerNodeContent, context?: FlowExecutionContext) {
    super(id, 'web-crawler', data);
    
    // 생성자에서 context를 명시적으로 설정
    if (context) {
      this.context = context;
    }
  }

  /**
   * Executes the web crawler node.
   * @param input Optional input, potentially a URL string.
   * @returns The fetched HTML content as a string, or specific element HTML, or null on error.
   */
  async execute(input: any): Promise<string | null> {
    this._log(`Executing`);
    this.context?.markNodeRunning(this.id);

    const nodeContent = this.property as WebCrawlerNodeContent;
    let targetUrl = nodeContent.url || '';

    if (typeof input === 'string' && input.trim() !== '') {
        try {
            new URL(input);
            targetUrl = input;
            this._log(`Using input string as target URL: ${targetUrl}`);
        } catch (e) {
            this._log(`Input string is not a valid URL, using node property URL.`);
        }
    }

    if (!targetUrl) {
      const errorMsg = "URL is required but not provided either in node properties or as input.";
      this._log(`Error - ${errorMsg}`);
      this.context?.markNodeError(this.id, errorMsg);
      return null;
    }

    try {
      this._log(`Calling backend crawler service for URL: ${targetUrl}`);
      
      const result = await crawling({
        url: targetUrl,
        waitForSelectorOnPage: nodeContent.waitForSelectorOnPage,
        iframeSelector: nodeContent.iframeSelector,
        waitForSelectorInIframe: nodeContent.waitForSelectorInIframe,
        timeout: nodeContent.timeout || 30000,
        headers: nodeContent.headers || {},
        extract_element_selector: nodeContent.extractElementSelector,
        output_format: nodeContent.outputFormat || 'html'
      });

      if (result === null) {
          this._log(`Frontend crawling utility failed (e.g., network error).`);
          if (typeof this.context?.getNodeState === 'function' && this.context.getNodeState(this.id)?.status !== 'error') {
              this.context?.markNodeError?.(this.id, 'Frontend API call failed');
          }
          return null;
      }

      if (result.status === 'success' && (result.extracted_content || result.html)) {
          const contentToReturn = result.extracted_content ?? result.html;
          const logMessage = result.extracted_content 
              ? `Backend crawling successful, received extracted element content (length: ${contentToReturn?.length || 0}).`
              : `Backend crawling successful, received HTML content (length: ${contentToReturn?.length || 0}).`;
          this._log(logMessage);
          this.context?.markNodeSuccess(this.id, contentToReturn);
          return contentToReturn;
      } else {
        const errorMsg = result.error || 'Backend crawling failed or did not return expected content.';
        this._log(`Backend crawling failed - ${errorMsg}`);
        this.context?.markNodeError(this.id, errorMsg);
        return null;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this._log(`Error during frontend crawl execution logic - ${errorMessage}`);
      this.context?.markNodeError(this.id, `Frontend Execution Error: ${errorMessage}`);
      return null;
    }
  }
} 