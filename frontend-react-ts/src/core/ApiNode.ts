import { Node } from './Node';
import { FlowExecutionContext } from './FlowExecutionContext';
import { callApi } from '../services/apiService.ts';
import { ApiNodeContent, useNodeContentStore } from '../store/useNodeContentStore.ts';
import { HTTPMethod } from '../types/nodes.ts';

/**
 * API node properties
 */
export interface ApiNodeProperty {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: string;
  queryParams?: Record<string, string>;
  useInputAsBody?: boolean;
  contentType?: string;
  bodyFormat?: 'key-value' | 'raw';
  bodyParams?: Array<{ key: string; value: string; enabled: boolean }>;
  nodeFactory?: any;
  [key: string]: any;
}

/**
 * ApiNode for making API requests
 */
export class ApiNode extends Node {
  declare property: ApiNodeContent;

  constructor(id: string, property: Record<string, any> = {}, context?: FlowExecutionContext) {
    super(id, 'api', property, context);
  }

  /**
   * Execute the API request
   */
  async execute(input: any): Promise<any> {
    this.context?.log(`${this.type}(${this.id}): Executing`);

    // Get the latest content directly from the store within execute
    const nodeContent = useNodeContentStore.getState().getNodeContent<ApiNodeContent>(this.id, this.type);
    
    const { 
      url,
      method = 'GET', // Default method
      headers = {},
      bodyFormat = 'raw', // Default body format
      body: rawBody, // Renamed from body to avoid conflict with constructed body
      bodyParams,
      queryParams = {},
      useInputAsBody = false,
      contentType = 'application/json' // Default content type
    } = nodeContent;

    // Determine the actual URL to use
    let targetUrl = url;
    if (!targetUrl && typeof input === 'string' && input.startsWith('http')) {
      targetUrl = input;
      this.context?.log(`${this.type}(${this.id}): Using input as URL: ${targetUrl}`);
    } else if (!targetUrl) {
      const errorMsg = "URL is required for ApiNode.";
      this.context?.markNodeError(this.id, errorMsg);
      this.context?.log(`${this.type}(${this.id}): Error - ${errorMsg}`);
      return null;
    }
    
    // Determine the request body
    let requestBody: any = null;
    if (useInputAsBody) {
      requestBody = input;
      this.context?.log(`${this.type}(${this.id}): Using input as request body.`);
    } else if (method !== 'GET' && method !== 'DELETE') { // Only consider body for relevant methods
      if (bodyFormat === 'key-value' && Array.isArray(bodyParams)) {
        requestBody = bodyParams
          .filter(param => param.enabled && param.key)
          .reduce((obj, param) => {
            obj[param.key] = param.value;
            return obj;
          }, {} as Record<string, string>);
        this.context?.log(`${this.type}(${this.id}): Using key-value body format.`);
      } else { // Default to raw body
        requestBody = rawBody;
        this.context?.log(`${this.type}(${this.id}): Using raw body format.`);
      }
    }

    // Prepare headers, ensuring Content-Type is set if there's a body
    const finalHeaders = { ...headers };
    if (requestBody && !finalHeaders['Content-Type'] && !finalHeaders['content-type']) {
      finalHeaders['Content-Type'] = contentType;
      this.context?.log(`${this.type}(${this.id}): Setting Content-Type header to ${contentType}`);
    }

    this.context?.log(`${this.type}(${this.id}): Calling API: ${method} ${targetUrl}`);

    try {
      const result = await callApi({
        url: targetUrl,
        method: method as HTTPMethod,
        headers: finalHeaders,
        body: requestBody,
        queryParams
      });
      
      this.context?.log(`${this.type}(${this.id}): API call successful, result type: ${typeof result}`);
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