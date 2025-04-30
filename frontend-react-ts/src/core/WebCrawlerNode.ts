import { Node } from './Node';
import { FlowExecutionContext } from './FlowExecutionContext';
import { crawling } from '../utils/web/crawling.ts';
import { WebCrawlerNodeContent, useNodeContentStore } from '../store/useNodeContentStore.ts';

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

    // Get the latest content directly from the store within execute
    const nodeContent = useNodeContentStore.getState().getNodeContent<WebCrawlerNodeContent>(this.id, this.type);
    
    const { 
      url,
      waitForSelector, // Still useful to ensure page is ready
      timeout = 5000, // Frontend timeout in ms
      headers // Get headers from content
    } = nodeContent;

    // Use input as URL if url property is empty and input is a valid URL string
    let targetUrl = url;
    if (!targetUrl && typeof input === 'string' && input.startsWith('http')) {
      targetUrl = input;
      this.context?.log(`${this.type}(${this.id}): Using input as URL: ${targetUrl}`);
    } else if (!targetUrl) {
      const errorMsg = "URL is required for WebCrawlerNode.";
      this.context?.markNodeError(this.id, errorMsg);
      this.context?.log(`${this.type}(${this.id}): Error - ${errorMsg}`);
      return null;
    }

    this.context?.log(`${this.type}(${this.id}): Crawling URL: ${targetUrl} for full HTML`);

    try {
      // Call crawling utility, explicitly requesting HTML
      const result = await crawling({
        url: targetUrl,
        selector: waitForSelector, // Pass selector (for waiting)
        waitBeforeLoad: timeout, // Pass timeout in ms (util converts to seconds)
        headers: headers, // Pass headers
        include_html: true // Explicitly request HTML
      });
      
      // Log the full backend response for debugging
      // console.log('Backend response:', result); // Comment out full response log

      // Check if crawling utility returned null (network error, etc.)
      if (result === null) {
        this.context?.log(`${this.type}(${this.id}): Crawling utility failed.`);
        // Error already marked by crawling utility or within it
        // Ensure node state is error if not already set
        if (this.context?.getNodeState(this.id) !== 'error') {
          this.context?.markNodeError(this.id, "Crawling utility failed to fetch data.");
        }
        return null;
      }
      
      // Check backend status from the returned object
      if (result.status !== 'success') {
         const errorMessage = result.error || "Backend crawling failed.";
         this.context?.log(`${this.type}(${this.id}): Backend error - ${errorMessage}`);
         this.context?.markNodeError(this.id, errorMessage);
         return null;
      }
      
      // Extract HTML content from the result
      const htmlContent = result.html;
      
      if (!htmlContent) {
        this.context?.log(`${this.type}(${this.id}): Crawling successful, but no HTML content received.`);
        this.context?.markNodeError(this.id, "Crawling successful but HTML content was missing in response.");
        return null;
      }
      
      this.context?.log(`${this.type}(${this.id}): Crawling successful, received HTML content (length: ${htmlContent.length}).`);
      this.context?.storeOutput(this.id, htmlContent); // Store the raw HTML string
      return htmlContent; // Return the raw HTML string

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.context?.markNodeError(this.id, errorMessage);
      this.context?.log(`${this.type}(${this.id}): Error - ${errorMessage}`);
      return null;
    }
  }
} 