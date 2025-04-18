import { Node } from './Node';
import { FlowExecutionContext } from './FlowExecutionContext';
import { getNodeContent, APINodeContent } from '../store/nodeContentStore';
import { syncNodeProperties, apiNodeSyncConfig } from '../utils/nodePropertySync';
import axios, { AxiosRequestConfig, Method, AxiosError } from 'axios';

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
  declare property: ApiNodeProperty;

  constructor(
    id: string,
    property: Record<string, any> = {},
    context?: FlowExecutionContext
  ) {
    super(id, 'api', property, context);
    
    // Initialize with default property if not provided
    this.property = {
      url: property.url || '',
      method: property.method || 'GET',
      headers: property.headers || {},
      queryParams: property.queryParams || {},
      bodyFormat: property.bodyFormat || 'raw',
      body: property.body || '',
      useInputAsBody: property.useInputAsBody || false,
      ...property
    };
  }

  /**
   * Synchronize property from Zustand store before execution
   */
  syncPropertyFromStore(): void {
    // 공통 유틸리티 사용하여 속성 동기화
    syncNodeProperties(this, apiNodeSyncConfig, 'api');
  }

  /**
   * Execute the API request
   */
  async execute(input: any): Promise<any> {
    try {
      this.context?.markNodeRunning(this.id);
      
      // Get the URL and method
      const url = this.property.url;
      const method = this.property.method as Method;
      
      // URL is required
      if (!url) {
        const errorMsg = 'URL is required for API node';
        this.context?.log(`ApiNode(${this.id}): ${errorMsg}`);
        this.context?.markNodeError(this.id, errorMsg);
        throw new Error(errorMsg);
      }
      
      // Build request config
      const config: AxiosRequestConfig = {
        url,
        method,
        headers: this.property.headers || {},
        params: this.property.queryParams || {}
      };
      
      // Handle request body based on settings
      if (method !== 'GET') {
        if (this.property.useInputAsBody && input !== undefined) {
          // Use input directly as the request body
          config.data = input;
        } else if (this.property.bodyFormat === 'key-value' && Array.isArray(this.property.bodyParams)) {
          // Build body from key-value pairs
          const bodyObj: Record<string, string> = {};
          for (const param of this.property.bodyParams) {
            if (param.enabled) {
              bodyObj[param.key] = param.value;
            }
          }
          config.data = bodyObj;
        } else {
          // Use raw body
          config.data = this.property.body || '';
        }
      }
      
      // Make the API request
      this.context?.log(`ApiNode(${this.id}): Making ${method} request to ${url}`);
      const response = await axios(config);
      
      // Log the response status
      this.context?.log(`ApiNode(${this.id}): Received response with status ${response.status}`);
      
      // Store the response data in the context
      this.context?.storeOutput(this.id, response.data);
      
      // Return the response data
      return response.data;
    } catch (error: unknown) {
      // Handle errors
      const axiosError = error as AxiosError;
      const errorMessage = axiosError.response 
        ? `API error (${axiosError.response.status}): ${JSON.stringify(axiosError.response.data)}`
        : `Request error: ${axiosError.message}`;
      
      this.context?.log(`ApiNode(${this.id}): ${errorMessage}`);
      this.context?.markNodeError(this.id, errorMessage);
      
      // Return null to indicate failure
      return null;
    }
  }
} 