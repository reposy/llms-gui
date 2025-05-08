import { useCallback } from 'react';
import { useNodeContentStore, JSONExtractorNodeContent } from '../store/useNodeContentStore';
import { isEqual } from 'lodash';

/**
 * Custom hook to manage JSON Extractor node state and operations.
 * All state is managed via useNodeContentStore.
 */
export const useJsonExtractorNodeData = (nodeId: string) => {
  // Get the content using proper selector pattern
  const content = useNodeContentStore(
    useCallback(
      (state) => state.getNodeContent(nodeId, 'json-extractor') as JSONExtractorNodeContent,
      [nodeId]
    )
  );
  
  // Get the setNodeContent function
  const setNodeContent = useNodeContentStore(state => state.setNodeContent);

  // Extract properties with defaults for safety
  const path = content?.path || '';
  const label = content?.label || 'JSON Extractor';
  const defaultValue = content?.defaultValue; // Optional, no default

  /**
   * Update content with deep equality check to prevent unnecessary updates
   */
  const updateExtractorContent = useCallback((updates: Partial<JSONExtractorNodeContent>) => {
    // Check if any individual updates differ from current values
    const hasChanges = Object.entries(updates).some(([key, value]) => {
      const currentValue = content[key as keyof JSONExtractorNodeContent];
      return !isEqual(currentValue, value);
    });
    
    if (!hasChanges) {
      console.log(`[JSONExtractorNode ${nodeId}] Skipping content update - no changes (deep equal)`);
      return;
    }
    
    console.log(`[JSONExtractorNode ${nodeId}] Updating content with:`, updates);
    setNodeContent(nodeId, updates);
  }, [nodeId, content, setNodeContent]);

  // Change handlers using the central updater
  const handlePathChange = useCallback((newPath: string) => {
    updateExtractorContent({ path: newPath });
  }, [updateExtractorContent]);

  const handleLabelChange = useCallback((newLabel: string) => {
    updateExtractorContent({ label: newLabel });
  }, [updateExtractorContent]);

  const handleDefaultValueChange = useCallback((newDefaultValue: any) => {
    updateExtractorContent({ defaultValue: newDefaultValue });
  }, [updateExtractorContent]);

  return {
    // Data
    content,
    path,
    label,
    defaultValue,
    
    // Change Handlers
    handlePathChange,
    handleLabelChange,
    handleDefaultValueChange,
    
    // Direct update method
    updateContent: updateExtractorContent
  };
}; 