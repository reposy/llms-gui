import { Node } from 'reactflow';
import { WebCrawlerNodeData } from '../types/nodes';
import { ExecutionContext } from '../types/execution';
import axios from 'axios';

// Define the expected parameters for the executor
interface ExecuteWebCrawlerNodeParams {
  node: Node<WebCrawlerNodeData>;
  inputs: any[]; // Can contain URL overrides
  context: ExecutionContext;
  resolveTemplate?: (template: string, nodeId: string, executionInputs: any) => string;
}

interface WebCrawlerResponse {
  url: string;
  title: string;
  text: string;
  html?: string;
  extracted_data?: Record<string, any>;
  status: string;
  error?: string;
}

export async function executeWebCrawlerNode(params: ExecuteWebCrawlerNodeParams): Promise<any> {
  const { node, inputs, context, resolveTemplate } = params;
  const nodeId = node.id;
  const nodeData = node.data;
  
  console.log(`[ExecuteNode ${nodeId}] (WebCrawler) Executing with context:`, context);
  
  // Determine which URL to use (default or from input)
  let url = nodeData.url || '';
  
  // Check if we received a URL from an input
  if (inputs && inputs.length > 0) {
    const firstInput = inputs[0];
    
    // If input is a simple string, use it as URL
    if (typeof firstInput === 'string') {
      url = firstInput;
      console.log(`[ExecuteNode ${nodeId}] (WebCrawler) Using URL from input string:`, url);
    } 
    // If input is an object with a url property
    else if (firstInput && typeof firstInput === 'object' && 'url' in firstInput) {
      url = firstInput.url;
      console.log(`[ExecuteNode ${nodeId}] (WebCrawler) Using URL from input object:`, url);
    }
  }
  
  // Apply template resolution if available
  if (resolveTemplate && url) {
    url = resolveTemplate(url, nodeId, inputs);
    console.log(`[ExecuteNode ${nodeId}] (WebCrawler) Template resolved URL:`, url);
  }
  
  // Validate URL
  if (!url) {
    throw new Error("No URL provided. Please configure a URL or connect a node that provides one.");
  }
  
  try {
    // Prepare request data
    const requestData = {
      url,
      wait_for_selector: nodeData.waitForSelector,
      extract_selectors: nodeData.extractSelectors,
      timeout: nodeData.timeout || 30000,
      headers: nodeData.headers,
      include_html: nodeData.includeHtml || nodeData.outputFormat === 'html'
    };
    
    console.log(`[ExecuteNode ${nodeId}] (WebCrawler) Requesting with data:`, requestData);
    
    // Make API request to backend
    const response = await axios.post<WebCrawlerResponse>(
      '/api/web-crawler/fetch',
      requestData,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log(`[ExecuteNode ${nodeId}] (WebCrawler) Response received:`, response.data);
    
    // Check for error status in the response
    if (response.data.status === 'error') {
      throw new Error(`Crawler Error: ${response.data.error}`);
    }
    
    // Format the output based on the node's configuration
    const outputFormat = nodeData.outputFormat || 'full';
    let result;
    
    switch (outputFormat) {
      case 'text':
        result = response.data.text;
        break;
        
      case 'html':
        result = response.data.html || '';
        break;
        
      case 'extracted':
        result = response.data.extracted_data || {};
        break;
        
      case 'full':
      default:
        // Return the complete response
        result = {
          url: response.data.url,
          title: response.data.title,
          text: response.data.text,
          html: response.data.html,
          extractedData: response.data.extracted_data
        };
    }
    
    return result;
  } catch (error: any) {
    // Handle API errors
    console.error(`[ExecuteNode ${nodeId}] (WebCrawler) Error:`, error);
    
    const errorMessage = error.response?.data?.error || error.message || 'Unknown error';
    throw new Error(`Web crawler error: ${errorMessage}`);
  }
} 