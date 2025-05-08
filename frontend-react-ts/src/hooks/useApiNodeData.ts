import { useCallback, useEffect, useRef } from 'react';
import { createNodeDataHook } from './useNodeDataFactory';
import { HTTPMethod, RequestBodyType, APIResponse, APINodeContent } from '../types/nodes';
import { isValidUrl } from '../utils/web/urlUtils';

/**
 * Default values for API node content
 */
const API_DEFAULTS: Partial<APINodeContent> = {
  url: '',
  method: 'GET',
  label: 'API Call',
  requestBodyType: 'none',
  requestBody: '',
  requestHeaders: {},
  isRunning: false
};

/**
 * Custom hook to manage API node state and operations.
 * Uses the standardized hook factory pattern.
 */
export const useApiNodeData = ({ nodeId }: { nodeId: string }) => {
  // Use the factory to create the base hook functionality
  const { 
    content, 
    updateContent: updateApiContent, 
    createChangeHandler,
    getStoreState 
  } = createNodeDataHook<APINodeContent>('api', API_DEFAULTS)({ nodeId });

  // Extract properties with defaults for easier access
  const url = content?.url || API_DEFAULTS.url;
  const method = content?.method || API_DEFAULTS.method;
  const label = content?.label || API_DEFAULTS.label;
  const requestBodyType = content?.requestBodyType || API_DEFAULTS.requestBodyType;
  const requestBody = content?.requestBody || API_DEFAULTS.requestBody;
  const requestHeaders = content?.requestHeaders || API_DEFAULTS.requestHeaders;
  const response = content?.response;
  const statusCode = content?.statusCode;
  const executionTime = content?.executionTime;
  const errorMessage = content?.errorMessage;
  const isRunning = content?.isRunning || API_DEFAULTS.isRunning;

  const lastRunTimeRef = useRef<number | null>(null);
  
  // Create standardized change handlers using the factory's createChangeHandler
  const handleUrlChange = createChangeHandler('url');
  const handleMethodChange = createChangeHandler('method');
  const handleLabelChange = createChangeHandler('label');
  const handleRequestBodyTypeChange = createChangeHandler('requestBodyType');
  const handleRequestBodyChange = createChangeHandler('requestBody');
  const handleHeadersChange = createChangeHandler('requestHeaders');
  const handleResponseChange = createChangeHandler('response');
  const handleStatusCodeChange = createChangeHandler('statusCode');
  const handleExecutionTimeChange = createChangeHandler('executionTime');
  const handleErrorMessageChange = createChangeHandler('errorMessage');
  const setIsRunning = createChangeHandler('isRunning');

  /**
   * Trigger API execution (implementation likely uses worker or backend call)
   */
  const executeApiCall = useCallback(async () => {
    if (!isValidUrl(url)) {
      updateApiContent({ 
        errorMessage: 'Invalid URL',
        isRunning: false,
        response: null,
        statusCode: null,
        executionTime: null,
      });
      return;
    }
    if (isRunning) {
      console.log(`[APINode ${nodeId}] API call already in progress.`);
      return;
    }

    setIsRunning(true);
    updateApiContent({ 
      errorMessage: null, 
      response: null, 
      statusCode: null, 
      executionTime: null 
    });
    lastRunTimeRef.current = Date.now();

    // TODO: Implement actual API call logic (e.g., using fetch in a worker)
    // Simulating async operation for now
    console.log(`[APINode ${nodeId}] Executing API call: ${method} ${url}`);
    await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate network delay

    try {
      // Simulate success
      const simulatedResponse: APIResponse = { data: { message: `Success for ${url}` }, headers: { 'content-type': 'application/json' } };
      const simulatedStatusCode = 200;
      const simulatedTime = Date.now() - (lastRunTimeRef.current ?? Date.now());
      
      updateApiContent({
        response: simulatedResponse,
        statusCode: simulatedStatusCode,
        executionTime: simulatedTime,
        errorMessage: null,
        isRunning: false,
      });
      console.log(`[APINode ${nodeId}] API call successful.`);
    } catch (error) {
      console.error(`[APINode ${nodeId}] API call failed:`, error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      updateApiContent({
        errorMessage: message,
        response: null,
        statusCode: null,
        executionTime: null,
        isRunning: false,
      });
    }
  }, [
    nodeId, url, method, isRunning, updateApiContent, setIsRunning
  ]);
  
  // Effect to potentially clear 'isRunning' if component unmounts unexpectedly
  useEffect(() => {
    return () => {
      // Check if the component is still mounted and if the node still exists
      const nodeContent = getStoreState().contents[nodeId];
      if (isRunning && nodeContent !== undefined) {
        console.warn(`[APINode ${nodeId}] Unmounting while API call was in progress. Resetting state.`);
        // Use the store's setter directly as the hook's context might be gone
        getStoreState().setNodeContent(nodeId, { isRunning: false });
      }
    };
  }, [nodeId, isRunning, getStoreState]);

  return {
    // State / Data
    content,
    url,
    method,
    label,
    requestBodyType,
    requestBody,
    requestHeaders,
    response,
    statusCode,
    executionTime,
    errorMessage,
    isRunning,
    
    // Event Handlers / Updaters
    handleUrlChange,
    handleMethodChange,
    handleLabelChange,
    handleRequestBodyTypeChange,
    handleRequestBodyChange,
    handleHeadersChange,
    handleResponseChange,
    handleStatusCodeChange,
    handleExecutionTimeChange,
    handleErrorMessageChange,
    updateContent: updateApiContent,
    setIsRunning,

    // Actions
    executeApiCall,
  };
}; 