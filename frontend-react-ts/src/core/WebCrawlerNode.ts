import { Node } from './Node';
import { crawling } from '../utils/crawling';

/**
 * Interface for Web Crawler node properties
 */
export interface WebCrawlerNodeProperty {
  url?: string;
  label?: string;
  waitForSelector?: string;
  extractSelectors?: Record<string, string>;
  timeout?: number;
  headers?: Record<string, string>;
  includeHtml?: boolean;
  outputFormat?: 'full' | 'text' | 'extracted' | 'html';
  executionGraph?: Map<string, string[]>;
  nodes?: any[];
  edges?: any[];
  nodeFactory?: any;
}

/**
 * Web Crawler node that fetches a web page and extracts content using CSS selectors
 */
export class WebCrawlerNode extends Node {
  /**
   * Type assertion for property
   */
  declare property: WebCrawlerNodeProperty;

  /**
   * Execute the node's specific logic
   * @param input The input data that may contain URL override
   * @returns The extracted web content
   */
  async execute(input: any): Promise<any> {
    this.context.log(`WebCrawlerNode(${this.id}): Starting web crawling process`);
    
    try {
      // Determine URL (from property or input)
      let url = this.property.url;
      
      // If input is a string, use it as URL override
      if (typeof input === 'string' && input.trim().startsWith('http')) {
        url = input.trim();
        this.context.log(`WebCrawlerNode(${this.id}): Using URL from input: ${url}`);
      } 
      // If input is an object with a url property, use that
      else if (input && typeof input === 'object' && input.url && typeof input.url === 'string') {
        url = input.url;
        this.context.log(`WebCrawlerNode(${this.id}): Using URL from input object: ${url}`);
      }
      
      // Validate URL
      if (!url) {
        throw new Error('No URL specified. Please provide a URL in the node configuration or input.');
      }
      
      // Parse selectors
      const extractSelectors = this.property.extractSelectors || {};
      
      // If no selectors defined, use waitForSelector as the main selector
      const mainSelector = this.property.waitForSelector || 'body';
      
      // Prepare result object
      const result: Record<string, any> = {
        url,
        timestamp: new Date().toISOString()
      };
      
      // If we have specific extractors
      if (Object.keys(extractSelectors).length > 0) {
        this.context.log(`WebCrawlerNode(${this.id}): Extracting ${Object.keys(extractSelectors).length} selectors`);
        
        // Process each extractor
        for (const [key, selectorInfo] of Object.entries(extractSelectors)) {
          // Parse selector string which might be in format "selector:attribute" or just "selector"
          const [selector, attribute] = selectorInfo.split(':');
          
          this.context.log(`WebCrawlerNode(${this.id}): Extracting "${key}" with selector "${selector}"${attribute ? ` and attribute "${attribute}"` : ''}`);
          
          // Call the crawler utility
          const extractedValue = await crawling({
            url,
            selector,
            attribute,
            waitBeforeLoad: this.property.timeout
          });
          
          // Store the result
          result[key] = extractedValue;
        }
      } else {
        // Just extract the main selector
        this.context.log(`WebCrawlerNode(${this.id}): Extracting content with selector "${mainSelector}"`);
        
        const extractedValue = await crawling({
          url,
          selector: mainSelector,
          waitBeforeLoad: this.property.timeout
        });
        
        // For simple extraction, set the content directly
        result.content = extractedValue;
      }
      
      // Format output according to configuration
      const outputFormat = this.property.outputFormat || 'full';
      
      if (outputFormat === 'text' && result.content) {
        // Return just the text content
        this.context.log(`WebCrawlerNode(${this.id}): Returning text content`);
        return result.content;
      } else if (outputFormat === 'extracted' && Object.keys(extractSelectors).length > 0) {
        // Return just the extracted values without metadata
        const extractedData: Record<string, any> = {};
        
        for (const key of Object.keys(extractSelectors)) {
          extractedData[key] = result[key];
        }
        
        this.context.log(`WebCrawlerNode(${this.id}): Returning extracted data object`);
        return extractedData;
      } else {
        // Return the full result object
        this.context.log(`WebCrawlerNode(${this.id}): Returning full result object`);
        return result;
      }
    } catch (error) {
      this.context.log(`WebCrawlerNode(${this.id}): Error during web crawling - ${error}`);
      throw error;
    }
  }
} 