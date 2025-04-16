import { APINodeContent } from './common';

/**
 * Creates default APINodeContent
 */
export const createDefaultApiNodeContent = (label?: string): APINodeContent => {
  return {
    label: label || 'API Node',
    url: '',
    method: 'GET',
    headers: {},
    body: '',
    queryParams: {},
    useInputAsBody: false,
    contentType: 'application/json',
    bodyFormat: 'raw',
    bodyParams: [],
    isDirty: false
  };
};

/**
 * Validates an API node's properties
 */
export const validateApiNodeContent = (content: APINodeContent): string[] => {
  const errors: string[] = [];
  
  // Validate URL
  if (!content.url || content.url.trim() === '') {
    errors.push('URL is required');
  } else {
    try {
      new URL(content.url);
    } catch (error) {
      errors.push('URL is not valid');
    }
  }
  
  // Validate method
  const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
  if (!content.method || !validMethods.includes(content.method)) {
    errors.push('HTTP method is required and must be one of: GET, POST, PUT, DELETE, PATCH');
  }
  
  // Validate content type for POST/PUT/PATCH
  if (['POST', 'PUT', 'PATCH'].includes(content.method || '') && 
      content.bodyFormat === 'raw' && 
      (!content.contentType || content.contentType.trim() === '')) {
    errors.push('Content type is required when using raw body format');
  }
  
  // Validate body parameters for key-value format
  if (content.bodyFormat === 'key-value' && content.bodyParams) {
    for (const param of content.bodyParams) {
      if (param.enabled && (!param.key || param.key.trim() === '')) {
        errors.push('All enabled body parameters must have a key');
      }
    }
  }
  
  return errors;
};

/**
 * Formats headers into the correct format
 */
export const formatApiHeaders = (headers: Record<string, string> | string | undefined): Record<string, string> => {
  if (!headers) {
    return {};
  }
  
  // If already an object, return it
  if (typeof headers === 'object') {
    return headers;
  }
  
  // If string, try to parse as JSON
  if (typeof headers === 'string') {
    try {
      return JSON.parse(headers);
    } catch (error) {
      // If can't parse, try to parse as key-value pairs
      const headerObj: Record<string, string> = {};
      const lines = headers.split('\n');
      
      for (const line of lines) {
        const [key, ...valueParts] = line.split(':');
        const value = valueParts.join(':').trim();
        
        if (key && value) {
          headerObj[key.trim()] = value;
        }
      }
      
      return headerObj;
    }
  }
  
  return {};
}; 