import { Node } from './Node';
import { FlowExecutionContext } from './FlowExecutionContext';
import { callApi } from '../services/apiService.ts';
import { useNodeContentStore } from '../store/useNodeContentStore.ts';
import { HTTPMethod, APINodeContent } from '../types/nodes.ts';

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
  declare property: APINodeContent;

  constructor(id: string, property: Record<string, any> = {}, context?: FlowExecutionContext) {
    super(id, 'api', property);
    
    // 생성자에서 context를 명시적으로 설정
    if (context) {
      this.context = context;
    }
  }

  /**
   * Execute the API request
   */
  async execute(input: any): Promise<any> {
    this._log('Executing');

    // Get the latest content directly from the store within execute
    const nodeContent = useNodeContentStore.getState().getNodeContent(this.id, this.type) as APINodeContent;
    
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
      this._log(`Using input as URL: ${targetUrl}`);
    } else if (!targetUrl) {
      const errorMsg = "URL is required for ApiNode.";
      this._log(`Error - ${errorMsg}`);
      throw new Error(errorMsg);
    }
    
    // Determine the request body
    let requestBody: any = null;
    if (useInputAsBody) {
      requestBody = input;
      this._log('Using input as request body.');
    } else if (method !== 'GET' && method !== 'DELETE') { // Only consider body for relevant methods
      if (bodyFormat === 'key-value' && Array.isArray(bodyParams)) {
        requestBody = bodyParams
          .filter(param => param.enabled && param.key)
          .reduce((obj, param) => {
            obj[param.key] = param.value;
            return obj;
          }, {} as Record<string, string>);
        this._log('Using key-value body format.');
      } else { // Default to raw body
        requestBody = rawBody;
        this._log('Using raw body format.');
      }
    }

    // Prepare headers, ensuring Content-Type is set if there's a body
    const finalHeaders = { ...headers };
    if (requestBody && !finalHeaders['Content-Type'] && !finalHeaders['content-type']) {
      finalHeaders['Content-Type'] = contentType;
      this._log(`Setting Content-Type header to ${contentType}`);
    }

    this._log(`Calling API: ${method} ${targetUrl}`);

    const result = await callApi({
      url: targetUrl,
      method: method as HTTPMethod,
      headers: finalHeaders,
      body: requestBody,
      queryParams
    });
    
    this._log(`API call successful, result type: ${typeof result}`);
    return result;
  }
} 