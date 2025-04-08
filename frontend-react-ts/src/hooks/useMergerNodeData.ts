import { useCallback } from 'react';
import { useNodeContent, MergerNodeContent } from '../store/useNodeContentStore';
import { isEqual } from 'lodash';

/**
 * Custom hook to manage Merger node state and operations using Zustand store.
 * Centralizes logic for MergerNode component
 */
export const useMergerNodeData = ({ 
  nodeId
}: { 
  nodeId: string
}) => {
  // Use the general NodeContentStore with MergerNodeContent type
  const { 
    content: generalContent, 
    setContent,
    isContentDirty
  } = useNodeContent(nodeId);

  // Cast the general content to MergerNodeContent type
  const content = generalContent as MergerNodeContent;

  // Destructure content for easier access
  const items = content.items || [];
  const label = content.label || 'Merger Node';

  /**
   * Handle items change with deep equality check
   */
  const handleItemsChange = useCallback((newItems: any[]) => {
    if (isEqual(newItems, items)) {
      console.log(`[MergerNode ${nodeId}] Skipping items update - no change (deep equal)`);
      return;
    }
    setContent({ items: newItems });
  }, [nodeId, items, setContent]);

  /**
   * Add item with deep equality check
   */
  const addItem = useCallback((item: any) => {
    const newItems = [...items, item];
    if (isEqual(newItems, items)) {
      console.log(`[MergerNode ${nodeId}] Skipping add item - no change (deep equal)`);
      return;
    }
    setContent({ items: newItems });
  }, [nodeId, items, setContent]);

  /**
   * Remove item with deep equality check
   */
  const removeItem = useCallback((index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    if (isEqual(newItems, items)) {
      console.log(`[MergerNode ${nodeId}] Skipping remove item - no change (deep equal)`);
      return;
    }
    setContent({ items: newItems });
  }, [nodeId, items, setContent]);

  /**
   * Update multiple properties at once with deep equality check
   */
  const updateMergerContent = useCallback((updates: Partial<MergerNodeContent>) => {
    // Skip update if no actual changes using deep equality
    const hasChanges = Object.entries(updates).some(([key, value]) => {
      const currentValue = content[key as keyof MergerNodeContent];
      return !isEqual(currentValue, value);
    });
    
    if (!hasChanges) {
      console.log(`[MergerNode ${nodeId}] Skipping content update - no changes in update object (deep equal)`);
      return;
    }
    
    // Create new content object with updates
    const newContent = {
      ...content,
      ...updates
    };

    // Final deep equality check against current content
    if (isEqual(newContent, content)) {
      console.log(`[MergerNode ${nodeId}] Skipping content update - merged content unchanged (deep equal)`);
      return;
    }
    
    console.log(`[MergerNode ${nodeId}] Updating content with:`, updates);
    setContent(updates);
  }, [nodeId, content, setContent]);

  return {
    // Data
    content,
    items,
    label,
    isDirty: isContentDirty,
    
    // Event handlers
    handleItemsChange,
    addItem,
    removeItem,
    updateMergerContent,
  };
}; 