import { Node } from './Node';
import { FlowExecutionContext } from './FlowExecutionContext';
import { crawling } from '../utils/web/crawling.ts';
import { WebCrawlerNodeContent, useNodeContentStore } from '../store/useNodeContentStore.ts';

/**
 * Interface for Web Crawler node properties
 */
export interface WebCrawlerNodeProperty {
  url: string;
  waitForSelector?: string;
  extractSelectors?: Record<string, string>;
  timeout?: number;
  outputFormat?: 'full' | 'text' | 'extracted' | 'html';
  nodeFactory?: any;
  [key: string]: any;
}

/**
 * Web Crawler node that fetches a web page and extracts content using CSS selectors
 */
export class WebCrawlerNode extends Node {
  /**
   * Type assertion for property
   */
  declare property: WebCrawlerNodeContent;

  /**
   * Constructor for WebCrawlerNode
   */
  constructor(
    id: string,
    property: Record<string, any> = {},
    context?: FlowExecutionContext
  ) {
    super(id, 'web-crawler', property, context);
  }

  /**
   * Execute the node's specific logic
   * @param input The input data that may contain URL override
   * @returns The extracted web content
   */
  async execute(input: any): Promise<any> {
    this.context?.log(`${this.type}(${this.id}): Executing`);

    // Get the latest content directly from the store within execute
    const nodeContent = useNodeContentStore.getState().getNodeContent<WebCrawlerNodeContent>(this.id, this.type);
    
    const { 
      url,
      waitForSelector,
      extractSelectors,
      timeout = 5000, // Default timeout if not set
      outputFormat = 'full' // Default output format
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

    this.context?.log(`${this.type}(${this.id}): Crawling URL: ${targetUrl}`);

    try {
      const result = await crawling({
        url: targetUrl,
        selector: waitForSelector || 'body',
        waitBeforeLoad: timeout
      });
      
      this.context?.log(`${this.type}(${this.id}): Crawling successful, result type: ${typeof result}`);
      this.context?.storeOutput(this.id, result);
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.context?.markNodeError(this.id, errorMessage);
      this.context?.log(`${this.type}(${this.id}): Error - ${errorMessage}`);
      return null;
    }
  }
} 