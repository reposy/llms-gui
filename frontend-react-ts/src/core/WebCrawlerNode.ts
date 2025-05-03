import { Node } from './Node';
import { FlowExecutionContext } from './FlowExecutionContext';
import { crawling } from '../utils/web/crawling.ts';
import { WebCrawlerNodeContent } from '../store/useNodeContentStore.ts';

/**
 * Web Crawler node that fetches a web page and returns its HTML content
 */
export class WebCrawlerNode extends Node {
  /**
   * Type assertion for property (now referencing the store content type)
   */
  declare property: WebCrawlerNodeContent;

  /**
   * Constructor for WebCrawlerNode
   */
  constructor(
    id: string,
    property: Record<string, any> = {}, // Keep constructor signature generic
    context?: FlowExecutionContext
  ) {
    super(id, 'web-crawler', property, context);
  }

  /**
   * Execute the node's specific logic
   * @param input The input data that may contain URL override
   * @returns The fetched HTML content as a string
   */
  async execute(input: any): Promise<string | null> {
    this.context?.log(`${this.type}(${this.id}): Executing`);
    this.context?.markNodeRunning(this.id);

    const props = this.property || {};
    let targetUrl = props.url || '';

    // If input is a string, assume it's a URL and override the node's URL property
    if (typeof input === 'string' && input.trim() !== '') {
        try {
            new URL(input); // Validate if input is a URL
            targetUrl = input;
            this.context?.log(`${this.type}(${this.id}): Using input string as target URL: ${targetUrl}`);
        } catch (e) {
            this.context?.log(`${this.type}(${this.id}): Input string is not a valid URL, using node property URL.`);
        }
    }

    if (!targetUrl) {
      const errorMsg = "URL is required but not provided either in node properties or as input.";
      this.context?.log(`${this.type}(${this.id}): Error - ${errorMsg}`);
      this.context?.markNodeError(this.id, errorMsg);
      return null;
    }

    try {
      this.context?.log(`${this.type}(${this.id}): Calling backend crawler service for URL: ${targetUrl}`);
      
      // Use the imported 'crawling' utility to call the backend API
      // Pass the parameters according to the backend request model
      const result = await crawling({
        url: targetUrl,
        waitForSelectorOnPage: props.waitForSelectorOnPage,
        iframeSelector: props.iframeSelector,
        waitForSelectorInIframe: props.waitForSelectorInIframe,
        timeout: props.timeout || 30000,
        headers: props.headers || {},
        include_html: true, // Always request HTML
      });

      // Check if the utility itself failed (e.g., network error)
      if (result === null) {
          // Assuming the `crawling` utility handles logging and marking node error on network failure
          this.context?.log(`${this.type}(${this.id}): Frontend crawling utility failed (e.g., network error).`);
          // Ensure error state is set if utility didn't
          if (this.context?.getNodeState(this.id)?.status !== 'error') {
              this.context?.markNodeError(this.id, 'Frontend API call failed');
          }
          return null;
      }

      // Check the status returned from the backend API
      if (result.status === 'success' && result.html) {
        this.context?.log(`${this.type}(${this.id}): Backend crawling successful, received HTML content (length: ${result.html.length}).`);
        this.context?.markNodeSuccess(this.id, result.html); // Store HTML as result
        return result.html;
      } else {
        const errorMsg = result.error || 'Backend crawling failed or did not return HTML content.';
        this.context?.log(`${this.type}(${this.id}): Backend crawling failed - ${errorMsg}`);
        this.context?.markNodeError(this.id, errorMsg);
        return null;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.context?.log(`${this.type}(${this.id}): Error during frontend crawl execution logic - ${errorMessage}`);
      this.context?.markNodeError(this.id, `Frontend Execution Error: ${errorMessage}`);
      return null;
    }
  }
} 