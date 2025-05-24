import { Node } from './Node';
import { FlowExecutionContext } from './FlowExecutionContext';
import { callApi } from '../services/apiService.ts';
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

    // context가 있으면 context의 getNodeContentFunc를, 없으면 this.property를 사용
    let nodeContent: APINodeContent | undefined = undefined;
    if (this.context && typeof this.context.getNodeContentFunc === 'function') {
      nodeContent = this.context.getNodeContentFunc(this.id, this.type) as APINodeContent;
    } else {
      nodeContent = this.property as APINodeContent;
    }
    
    const { 
      url,
      method = 'GET', // Default method
      requestHeaders = {},
      requestBodyType = 'raw', // Default body format
      requestBody,
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
    let requestBodyToSend: any = null;
    if (useInputAsBody) {
      requestBodyToSend = input;
      this._log('Using input as request body.');
    } else if (method !== 'GET' && method !== 'DELETE') { // Only consider body for relevant methods
      if (requestBodyType === 'key-value' && Array.isArray((nodeContent as any).bodyParams)) {
        requestBodyToSend = ((nodeContent as any).bodyParams as Array<{ key: string; value: string; enabled: boolean }>)
          .filter((param: { key: string; value: string; enabled: boolean }) => param.enabled && param.key)
          .reduce((obj: Record<string, string>, param: { key: string; value: string; enabled: boolean }) => {
            obj[param.key] = param.value;
            return obj;
          }, {});
        this._log('Using key-value body format.');
      } else { // Default to raw body
        requestBodyToSend = requestBody;
        this._log('Using raw body format.');
      }
    }
    // Prepare headers, ensuring Content-Type is set if there's a body
    const finalHeaders = { ...requestHeaders };
    if (requestBodyToSend && !finalHeaders['Content-Type'] && !finalHeaders['content-type']) {
      finalHeaders['Content-Type'] = contentType;
      this._log(`Setting Content-Type header to ${contentType}`);
    }
    this._log(`Calling API: ${method} ${targetUrl}`);
    const result = await callApi({
      url: targetUrl,
      method: method as HTTPMethod,
      headers: finalHeaders,
      body: requestBodyToSend,
      queryParams
    });
    this._log(`API call successful, result type: ${typeof result}`);
    return result;
  }
} 