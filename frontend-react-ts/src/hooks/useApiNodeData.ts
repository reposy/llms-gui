import { useCallback, useEffect, useRef } from 'react';
import { useNodeContent, APINodeContent, useNodeContentStore } from '../store/useNodeContentStore';
import { isEqual } from 'lodash';
import { HTTPMethod, RequestBodyType, APIResponse } from '../types/nodes';
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
  // Use the general NodeContent hook with correct type and nodeType
  const { 
    content: generalContent, 
    updateContent,
  } = useNodeContent<APINodeContent>(nodeId, 'api');

  // Get isDirty status directly from the store
  const isContentDirty = useNodeContentStore(state => state.isNodeDirty(nodeId));

  // Cast the general content to APINodeContent type
  const content = generalContent as APINodeContent;

  // Destructure content for easier access, providing defaults
  const url = content.url || '';
  const method = content.method || 'GET';
  const label = content.label || 'API Call';
  const requestBodyType = content.requestBodyType || 'none';
  const requestBody = content.requestBody || '';
  const requestHeaders = content.requestHeaders || {};
  const response = content.response; 
  const statusCode = content.statusCode;
  const executionTime = content.executionTime;
  const errorMessage = content.errorMessage;
  const isRunning = content.isRunning || false;

  // const { setNodes } = useReactFlow<APINodeContent>(); // Removed unused hook causing type error
  const lastRunTimeRef = useRef<number | null>(null);
  
  /**
   * Deep equality checks to prevent unnecessary updates
   */
  const updateContentIfChanged = useCallback((updates: Partial<APINodeContent>) => {
    const hasChanges = Object.entries(updates).some(([key, value]) => {
      const currentValue = content[key as keyof APINodeContent];
      return !isEqual(currentValue, value);
    });
    
    if (!hasChanges) {
      console.log(`[APINode ${nodeId}] Skipping content update - no changes in update object (deep equal)`);
      return;
    }
    
    const newContent = { ...content, ...updates };

    if (isEqual(newContent, content)) {
      console.log(`[APINode ${nodeId}] Skipping content update - merged content unchanged (deep equal)`);
      return;
    }
    
    console.log(`[APINode ${nodeId}] Updating content with:`, updates);
    updateContent(updates);
  }, [nodeId, content, updateContent]);

  // Specific event handlers using the central updater
  const handleUrlChange = useCallback((newUrl: string) => {
    updateContentIfChanged({ url: newUrl });
  }, [updateContentIfChanged]);
  
  const handleMethodChange = useCallback((newMethod: HTTPMethod) => {
    updateContentIfChanged({ method: newMethod });
  }, [updateContentIfChanged]);

  const handleLabelChange = useCallback((newLabel: string) => {
    updateContentIfChanged({ label: newLabel });
  }, [updateContentIfChanged]);

  const handleRequestBodyTypeChange = useCallback((newType: RequestBodyType) => {
    updateContentIfChanged({ requestBodyType: newType });
  }, [updateContentIfChanged]);
  
  const handleRequestBodyChange = useCallback((newBody: string) => {
    updateContentIfChanged({ requestBody: newBody });
  }, [updateContentIfChanged]);

  const handleHeadersChange = useCallback((newHeaders: Record<string, string>) => {
    updateContentIfChanged({ requestHeaders: newHeaders });
  }, [updateContentIfChanged]);

  const handleResponseChange = useCallback((newResponse: APIResponse | null) => {
    updateContentIfChanged({ response: newResponse });
  }, [updateContentIfChanged]);

  const handleStatusCodeChange = useCallback((newStatusCode: number | null) => {
    updateContentIfChanged({ statusCode: newStatusCode });
  }, [updateContentIfChanged]);

  const handleExecutionTimeChange = useCallback((newTime: number | null) => {
    updateContentIfChanged({ executionTime: newTime });
  }, [updateContentIfChanged]);

  const handleErrorMessageChange = useCallback((newError: string | null) => {
    updateContentIfChanged({ errorMessage: newError });
  }, [updateContentIfChanged]);

  const setIsRunning = useCallback((running: boolean) => {
    updateContentIfChanged({ isRunning: running });
  }, [updateContentIfChanged]);

  /**
   * Trigger API execution (implementation likely uses worker or backend call)
   */
  const executeApiCall = useCallback(async () => {
    if (!isValidUrl(url)) {
      updateContentIfChanged({ 
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
    updateContentIfChanged({ 
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
      
      updateContentIfChanged({
        response: simulatedResponse,
        statusCode: simulatedStatusCode,
        executionTime: simulatedTime,
        errorMessage: null,
        isRunning: false,
      });
      console.log(`[APINode ${nodeId}] API call successful.`);

      // Trigger visual update/feedback if needed (REMOVED _flash logic)
      // setNodes((nds: Node<APINodeContent>[]) => nds.map((n: Node<APINodeContent>) => {
      //   if (n.id === nodeId) {
      //     // Ensure data merging preserves existing data
      //     const updatedData = { ...n.data, _flash: Date.now() };
      //     return { ...n, data: updatedData }; // Add flash trigger
      //   }
      //   return n;
      // }));

    } catch (error) {
      console.error(`[APINode ${nodeId}] API call failed:`, error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      updateContentIfChanged({
        errorMessage: message,
        response: null,
        statusCode: null,
        executionTime: null,
        isRunning: false,
      });
    }
  }, [
    nodeId, url, method, requestBodyType, requestBody, requestHeaders, 
    updateContentIfChanged, setIsRunning, isRunning, /* setNodes, */ content
  ]);
  
  // Effect to potentially clear 'isRunning' if component unmounts unexpectedly
  useEffect(() => {
    return () => {
      // Check if the component is still mounted and if the node still exists
      const nodeContent = useNodeContentStore.getState().contents[nodeId];
      if (isRunning && nodeContent !== undefined) {
        console.warn(`[APINode ${nodeId}] Unmounting while API call was in progress. Resetting state.`);
        // Use the store's setter directly as the hook's context might be gone
        useNodeContentStore.getState().setNodeContent<APINodeContent>(nodeId, { isRunning: false });
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
    isDirty: isContentDirty,

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
    updateContent: updateContentIfChanged,
    setIsRunning,

    // Actions
    executeApiCall,
  };
}; 