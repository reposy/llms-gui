import { useCallback, ChangeEvent } from 'react';
import { useNodeContent, APINodeContent } from '../store/useNodeContentStore';
import { isEqual } from 'lodash';

/**
 * Custom hook to manage API node state and operations using Zustand store.
 * Centralizes logic for both APINode and APIConfig components
 */
export const useApiNodeData = ({ 
  nodeId
}: { 
  nodeId: string
}) => {
  // Use the general NodeContentStore with APINodeContent type
  const { 
    content: generalContent, 
    setContent,
    isContentDirty
  } = useNodeContent(nodeId);

  // Cast the general content to APINodeContent type
  const content = generalContent as APINodeContent;

  // Destructure content for easier access
  const url = content.url || '';
  const method = content.method || 'GET';
  const headers = content.headers || {};
  const params = content.params || {};
  const body = content.body || '';
  const queryParams = content.queryParams || {};
  const useInputAsBody = content.useInputAsBody || false;
  const contentType = content.contentType || 'application/json';
  const bodyFormat = content.bodyFormat || 'raw';
  const bodyParams = content.bodyParams || [];
  const label = content.label || 'API Node';

  /**
   * Handle URL change, supporting both direct string values and events
   * This allows the function to be used directly with onChange and for programmatic updates
   */
  const handleUrlChange = useCallback((eventOrString: ChangeEvent<HTMLInputElement> | string) => {
    const newUrl = typeof eventOrString === 'string' ? eventOrString : eventOrString.target.value;
    if (isEqual(newUrl, url)) {
      console.log(`[APINode ${nodeId}] Skipping URL update - no change (deep equal)`);
      return;
    }
    setContent({ url: newUrl });
  }, [nodeId, url, setContent]);

  /**
   * Handle method change (overloaded version that doesn't require an event)
   * Supports direct method changes without requiring an event object
   */
  const handleMethodChange = useCallback((newMethod: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH') => {
    if (isEqual(newMethod, method)) {
      console.log(`[APINode ${nodeId}] Skipping method update - no change (deep equal)`);
      return;
    }
    setContent({ method: newMethod });
  }, [nodeId, method, setContent]);

  /**
   * Handle method change from select element event
   */
  const handleMethodSelectChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
    const newMethod = event.target.value as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    setContent({ method: newMethod });
  }, [setContent]);

  /**
   * Handle headers change with deep equality check
   */
  const handleHeadersChange = useCallback((newHeaders: Record<string, string>) => {
    if (isEqual(newHeaders, headers)) {
      console.log(`[APINode ${nodeId}] Skipping headers update - no change (deep equal)`);
      return;
    }
    setContent({ headers: newHeaders });
  }, [nodeId, headers, setContent]);

  /**
   * Handle single header change
   */
  const handleHeaderChange = useCallback((key: string, value: string, oldKey?: string) => {
    const updatedHeaders = { ...headers };
    
    // If oldKey is provided and different from new key, remove the old one
    if (oldKey && oldKey !== key) {
      delete updatedHeaders[oldKey];
    }
    
    // Set the new key-value pair
    if (key) {
      updatedHeaders[key] = value;
    }
    
    setContent({ headers: updatedHeaders });
  }, [headers, setContent]);

  /**
   * Remove a header
   */
  const removeHeader = useCallback((key: string) => {
    const updatedHeaders = { ...headers };
    delete updatedHeaders[key];
    setContent({ headers: updatedHeaders });
  }, [headers, setContent]);

  /**
   * Add a new header
   */
  const addHeader = useCallback((key: string = '', value: string = '') => {
    // If key is empty, generate a default key
    const actualKey = key || `header${Object.keys(headers).length + 1}`;
    const updatedHeaders = { ...headers, [actualKey]: value };
    setContent({ headers: updatedHeaders });
  }, [headers, setContent]);

  /**
   * Handle body change with deep equality check
   */
  const handleBodyChange = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
    const newBody = event.target.value;
    if (isEqual(newBody, body)) {
      console.log(`[APINode ${nodeId}] Skipping body update - no change (deep equal)`);
      return;
    }
    setContent({ body: newBody });
  }, [nodeId, body, setContent]);

  /**
   * Handle query params change with deep equality check
   */
  const handleQueryParamsChange = useCallback((newQueryParams: Record<string, string>) => {
    if (isEqual(newQueryParams, queryParams)) {
      console.log(`[APINode ${nodeId}] Skipping query params update - no change (deep equal)`);
      return;
    }
    setContent({ queryParams: newQueryParams });
  }, [nodeId, queryParams, setContent]);

  /**
   * Toggle useInputAsBody
   */
  const toggleUseInputAsBody = useCallback((value?: boolean) => {
    const newValue = value !== undefined ? value : !useInputAsBody;
    setContent({ useInputAsBody: newValue });
  }, [useInputAsBody, setContent]);

  /**
   * Update content type
   */
  const handleContentTypeChange = useCallback((newContentType: string) => {
    setContent({ contentType: newContentType });
  }, [setContent]);

  /**
   * Change body format (raw or key-value)
   */
  const handleBodyFormatChange = useCallback((newFormat: 'raw' | 'key-value') => {
    setContent({ bodyFormat: newFormat });
  }, [setContent]);

  /**
   * Update multiple properties at once with deep equality check
   */
  const updateApiContent = useCallback((updates: Partial<APINodeContent>) => {
    // Skip update if no actual changes using deep equality
    const hasChanges = Object.entries(updates).some(([key, value]) => {
      const currentValue = content[key as keyof APINodeContent];
      return !isEqual(currentValue, value);
    });
    
    if (!hasChanges) {
      console.log(`[APINode ${nodeId}] Skipping content update - no changes in update object (deep equal)`);
      return;
    }
    
    console.log(`[APINode ${nodeId}] Updating content with:`, updates);
    setContent(updates);
  }, [nodeId, content, setContent]);

  return {
    // Data
    content,
    url,
    method,
    headers,
    params,
    queryParams,
    useInputAsBody,
    contentType,
    bodyFormat,
    bodyParams,
    label,
    isDirty: isContentDirty,
    
    // Event handlers
    handleUrlChange,
    handleMethodChange,
    handleMethodSelectChange,
    handleHeadersChange,
    handleHeaderChange,
    removeHeader,
    addHeader,
    handleBodyChange,
    handleQueryParamsChange,
    toggleUseInputAsBody,
    handleContentTypeChange,
    handleBodyFormatChange,
    updateApiContent,
  };
}; 