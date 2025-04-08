import { useCallback } from 'react';
import { useNodeContent, JSONExtractorNodeContent } from '../store/useNodeContentStore';
import { isEqual } from 'lodash';

/**
 * Custom hook to manage JSON Extractor node state and operations using Zustand store.
 * Centralizes logic for JSONExtractorNode component
 */
export const useJsonExtractorNodeData = ({ 
  nodeId
}: { 
  nodeId: string
}) => {
  // Use the general NodeContentStore with JSONExtractorNodeContent type
  const { 
    content: generalContent, 
    setContent,
    isContentDirty
  } = useNodeContent(nodeId);

  // Cast the general content to JSONExtractorNodeContent type
  const content = generalContent as JSONExtractorNodeContent;

  // Destructure content for easier access
  const path = content.path || '';
  const label = content.label || 'JSON Extractor Node';

  /**
   * Handle path change with deep equality check
   */
  const handlePathChange = useCallback((newPath: string) => {
    if (isEqual(newPath, path)) {
      console.log(`[JSONExtractorNode ${nodeId}] Skipping path update - no change (deep equal)`);
      return;
    }
    setContent({ path: newPath });
  }, [nodeId, path, setContent]);

  /**
   * Update multiple properties at once with deep equality check
   */
  const updateJsonExtractorContent = useCallback((updates: Partial<JSONExtractorNodeContent>) => {
    // Skip update if no actual changes using deep equality
    const hasChanges = Object.entries(updates).some(([key, value]) => {
      const currentValue = content[key as keyof JSONExtractorNodeContent];
      return !isEqual(currentValue, value);
    });
    
    if (!hasChanges) {
      console.log(`[JSONExtractorNode ${nodeId}] Skipping content update - no changes in update object (deep equal)`);
      return;
    }
    
    // Create new content object with updates
    const newContent = {
      ...content,
      ...updates
    };

    // Final deep equality check against current content
    if (isEqual(newContent, content)) {
      console.log(`[JSONExtractorNode ${nodeId}] Skipping content update - merged content unchanged (deep equal)`);
      return;
    }
    
    console.log(`[JSONExtractorNode ${nodeId}] Updating content with:`, updates);
    setContent(updates);
  }, [nodeId, content, setContent]);

  return {
    // Data
    content,
    path,
    label,
    isDirty: isContentDirty,
    
    // Event handlers
    handlePathChange,
    updateJsonExtractorContent,
  };
}; 