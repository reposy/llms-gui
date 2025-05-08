import { useCallback, useEffect, useRef } from 'react';
import { useNodeContentStore } from '../store/useNodeContentStore';
import { isEqual } from 'lodash';
import { HTTPMethod, RequestBodyType, APIResponse, APINodeContent } from '../types/nodes';
import { isValidUrl } from '../utils/web/urlUtils';

/**
 * Custom hook to manage API node state and operations using Zustand store.
 * Centralizes logic for APINode component
 */
export const useApiNodeData = ({ 
  nodeId
}: { 
  nodeId: string
}) => {
  // Get the content using proper selector pattern with callback
  const content = useNodeContentStore(
    useCallback(
      (state) => state.getNodeContent(nodeId, 'api') as APINodeContent,
      [nodeId]
    )
  );
  
  // Get the setNodeContent function
  const setNodeContent = useNodeContentStore(state => state.setNodeContent);

  // Destructure content for easier access, providing defaults
  const url = content?.url || '';
  const method = content?.method || 'GET';
  const label = content?.label || 'API Call';
  const requestBodyType = content?.requestBodyType || 'none';
  const requestBody = content?.requestBody || '';
  const requestHeaders = content?.requestHeaders || {};
  const response = content?.response; 
  const statusCode = content?.statusCode;
  const executionTime = content?.executionTime;
  const errorMessage = content?.errorMessage;
  const isRunning = content?.isRunning || false;

  const lastRunTimeRef = useRef<number | null>(null);
  
  /**
   * Update content with deep equality check to prevent unnecessary updates
   */
  const updateApiContent = useCallback((updates: Partial<APINodeContent>) => {
    // Check if any individual updates differ from current values
    const hasChanges = Object.entries(updates).some(([key, value]) => {
      const currentValue = content[key as keyof APINodeContent];
      return !isEqual(currentValue, value);
    });
    
    if (!hasChanges) {
      console.log(`[APINode ${nodeId}] Skipping content update - no changes (deep equal)`);
      return;
    }
    
    console.log(`[APINode ${nodeId}] Updating content with:`, updates);
    setNodeContent(nodeId, updates);
  }, [nodeId, content, setNodeContent]);

  // Specific event handlers using the central updater
  const handleUrlChange = useCallback((newUrl: string) => {
    updateApiContent({ url: newUrl });
  }, [updateApiContent]);
  
  const handleMethodChange = useCallback((newMethod: HTTPMethod) => {
    updateApiContent({ method: newMethod });
  }, [updateApiContent]);

  const handleLabelChange = useCallback((newLabel: string) => {
    updateApiContent({ label: newLabel });
  }, [updateApiContent]);

  const handleRequestBodyTypeChange = useCallback((newType: RequestBodyType) => {
    updateApiContent({ requestBodyType: newType });
  }, [updateApiContent]);
  
  const handleRequestBodyChange = useCallback((newBody: string) => {
    updateApiContent({ requestBody: newBody });
  }, [updateApiContent]);

  const handleHeadersChange = useCallback((newHeaders: Record<string, string>) => {
    updateApiContent({ requestHeaders: newHeaders });
  }, [updateApiContent]);

  const handleResponseChange = useCallback((newResponse: APIResponse | null) => {
    updateApiContent({ response: newResponse });
  }, [updateApiContent]);

  const handleStatusCodeChange = useCallback((newStatusCode: number | null) => {
    updateApiContent({ statusCode: newStatusCode });
  }, [updateApiContent]);

  const handleExecutionTimeChange = useCallback((newTime: number | null) => {
    updateApiContent({ executionTime: newTime });
  }, [updateApiContent]);

  const handleErrorMessageChange = useCallback((newError: string | null) => {
    updateApiContent({ errorMessage: newError });
  }, [updateApiContent]);

  const setIsRunning = useCallback((running: boolean) => {
    updateApiContent({ isRunning: running });
  }, [updateApiContent]);

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
      const nodeContent = useNodeContentStore.getState().contents[nodeId];
      if (isRunning && nodeContent !== undefined) {
        console.warn(`[APINode ${nodeId}] Unmounting while API call was in progress. Resetting state.`);
        // Use the store's setter directly as the hook's context might be gone
        useNodeContentStore.getState().setNodeContent(nodeId, { isRunning: false });
      }
    };
  }, [nodeId, isRunning]);


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