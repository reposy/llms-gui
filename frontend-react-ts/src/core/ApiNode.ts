import { Node } from './Node';
import { FlowExecutionContext } from './FlowExecutionContext';
import { callApi } from '../services/apiService';
import { HTTPMethod, APINodeProperty } from '../types/nodes';
import { extractDynamicProperty, mergeDynamicProperty, removeActualInputFromDynamic } from '../utils/dynamicPropertyUtils';

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
  declare property: APINodeProperty;

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

    // 동적 속성 추출 및 적용
    const dynamicProperty = extractDynamicProperty(input, 'api');
    const effectiveProperty = mergeDynamicProperty(this.property, dynamicProperty);
    
    // 동적 속성이 있다면 임시로 this.property 업데이트
    const originalProperty = this.property;
    if (dynamicProperty) {
      this.property = effectiveProperty as APINodeProperty;
      this._log(`Applied dynamic property: ${JSON.stringify(dynamicProperty)}`);
    }

    // 동적 속성 객체를 제거한 실제 입력 추출
    const actualInput = removeActualInputFromDynamic(input, 'api');

    try {
      // context가 있으면 context의 getNodePropertyFunc를, 없으면 effectiveProperty를 사용
      let nodeContent: APINodeProperty | undefined = undefined;
      if (this.context && typeof this.context.getNodePropertyFunc === 'function') {
        nodeContent = this.context.getNodePropertyFunc(this.id, this.type) as APINodeProperty;
      } else {
        nodeContent = effectiveProperty as APINodeProperty;
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
      
      // Determine the actual URL to use (actualInput 사용)
      let targetUrl = url;
      if (!targetUrl && typeof actualInput === 'string' && actualInput.startsWith('http')) {
        targetUrl = actualInput;
        this._log(`Using input as URL: ${targetUrl}`);
      } else if (!targetUrl) {
        const errorMsg = "URL is required for ApiNode.";
        this._log(`Error - ${errorMsg}`);
        throw new Error(errorMsg);
      }
      
      // Determine the request body (actualInput 사용)
      let requestBodyToSend: any = null;
      if (useInputAsBody) {
        requestBodyToSend = actualInput;
        this._log('Using input as request body.');
      } else if (method !== 'GET' && method !== 'DELETE') { // Only consider body for relevant methods
        if ((requestBodyType as string) === 'key-value' && Array.isArray((nodeContent as any).bodyParams)) {
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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.context?.markNodeError(this.id, errorMessage);
      this._log(`Error during API call: ${errorMessage}`);
      throw error;
    } finally {
      // 동적 속성이 있다면 원래의 property로 복원
      if (dynamicProperty) {
        this.property = originalProperty as APINodeProperty;
        this._log(`Restored original property: ${JSON.stringify(originalProperty)}`);
      }
    }
  }
} 