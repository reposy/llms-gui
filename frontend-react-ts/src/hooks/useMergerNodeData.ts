import { useCallback } from 'react';
import { useNodeContent, MergerNodeContent } from '../store/useNodeContentStore';
import { isEqual } from 'lodash';

/**
 * Custom hook to manage Merger node state and operations using Zustand store.
 * Centralizes logic for both MergerNode component and any related components
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

  // Get accumulated items from content
  const items = content.items || [];
  const itemCount = items.length;
  const label = content.label || 'Merger Node';

  /**
   * Add a new item to the accumulated items
   */
  const addItem = useCallback((item: any) => {
    const currentItems = items || [];
    const newItems = [...currentItems, item];
    
    // Skip update if no actual changes using deep equality
    if (isEqual(newItems, currentItems)) {
      console.log(`[MergerNode ${nodeId}] Skipping item add - no change (deep equal)`);
      return;
    }
    
    console.log(`[MergerNode ${nodeId}] Adding item to accumulator. New count: ${newItems.length}`);
    setContent({ items: newItems });
  }, [nodeId, items, setContent]);

  /**
   * Reset all accumulated items
   */
  const resetItems = useCallback(() => {
    // Skip update if already empty
    if (items.length === 0) {
      console.log(`[MergerNode ${nodeId}] Skipping reset - already empty`);
      return;
    }
    
    console.log(`[MergerNode ${nodeId}] Resetting ${items.length} accumulated items`);
    setContent({ items: [] });
  }, [nodeId, items, setContent]);

  return {
    // Data
    content,
    items,
    itemCount,
    label,
    isDirty: isContentDirty,
    
    // Event handlers
    addItem,
    resetItems,
  };
}; 