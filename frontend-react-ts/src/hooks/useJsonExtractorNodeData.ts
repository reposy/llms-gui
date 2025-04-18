import { useCallback } from 'react';
import { shallow } from 'zustand/shallow'; // Use shallow for store selectors
import { useNodeContentStore, NodeContent, JSONExtractorNodeContent } from '../store/useNodeContentStore'; // Import main store and types
// import { useFlowStructureStore } from '../store/useFlowStructureStore'; // Removed FlowStructureStore dependency
import { isEqual } from 'lodash';
// import { Node as ReactFlowNode } from '@xyflow/react'; // Removed ReactFlowNode dependency
import { JSONExtractorNodeData } from '../types/nodes'; // Keep type if needed elsewhere

/**
 * Custom hook to manage JSON Extractor node state and operations.
 * All state (label, path, defaultValue, result/content) is managed via useNodeContentStore.
 */
export const useJsonExtractorNodeData = ({
  nodeId
}: {
  nodeId: string
}) => {
  // --- Content Store Access (Unified State Management) ---
  const setNodeContent = useNodeContentStore(state => state.setNodeContent);

  // Use a selector with shallow comparison to get the entire content object
  const content = useNodeContentStore(
    useCallback(
      (state) => state.getNodeContent<JSONExtractorNodeContent>(nodeId, 'json-extractor'), // Get JSON Extractor specific content
      [nodeId]
    ),
    shallow // Use shallow comparison
  );

  const isContentDirty = useNodeContentStore(state => state.isNodeDirty(nodeId));

  // --- Derived State (from content store) ---
  // Provide defaults directly when accessing
  const path = content?.path || '';
  const label = content?.label || 'JSON Extractor Node';
  const defaultValue = content?.defaultValue || '';
  const result = content?.content; // The extracted result is stored in the generic 'content' field

  /**
   * Utility function to update content in the store, ensuring defaults and types.
   */
  const updateExtractorContent = useCallback((updates: Partial<Omit<JSONExtractorNodeContent, keyof NodeContent | 'isDirty' | 'content'>>) => {
    const currentContent = useNodeContentStore.getState().getNodeContent<JSONExtractorNodeContent>(nodeId, 'json-extractor');
    // Filter out the 'content' field from updates as it's managed separately (result)
    const newContent: Partial<JSONExtractorNodeContent> = { ...currentContent, ...updates };

    if (!isEqual(currentContent, newContent)) {
        console.log(`[useJsonExtractorNodeData ${nodeId}] Updating config content with:`, updates);
        setNodeContent<JSONExtractorNodeContent>(nodeId, newContent);
    } else {
        console.log(`[useJsonExtractorNodeData ${nodeId}] Skipping config content update - no changes (deep equal).`);
    }
  }, [nodeId, setNodeContent]);


  /**
   * Handle path configuration change
   */
  const handlePathChange = useCallback((newPath: string) => {
    updateExtractorContent({ path: newPath });
  }, [updateExtractorContent]);

  /**
   * Handle label configuration change
   */
   const handleLabelChange = useCallback((newLabel: string) => {
    updateExtractorContent({ label: newLabel });
   }, [updateExtractorContent]);

   /**
    * Handle defaultValue configuration change
    */
   const handleDefaultValueChange = useCallback((newDefaultValue: string) => {
    updateExtractorContent({ defaultValue: newDefaultValue });
   }, [updateExtractorContent]);

  /**
   * Handle the extracted result content update (called by the execution logic)
   */
  const handleResultChange = useCallback((newResult: any) => {
      console.log(`[useJsonExtractorNodeData ${nodeId}] Updating result content.`);
      // Only update the 'content' field which represents the result
      setNodeContent<JSONExtractorNodeContent>(nodeId, { content: newResult });
  }, [nodeId, setNodeContent]);


  return {
    // Configuration Data (from nodeContentStore)
    path,
    label,
    defaultValue,

    // Result Data (from nodeContentStore.content)
    result,
    isDirty: isContentDirty, // Reflects content store dirtiness

    // Configuration Change Handlers
    handlePathChange,
    handleLabelChange,
    handleDefaultValueChange,
    // handleConfigChange, // Removed

    // Result Update Handler (optional, if needed by UI)
    handleResultChange,

    // Provide the unified config update function if direct partial updates are needed
    // updateConfig: updateExtractorContent
  };
}; 