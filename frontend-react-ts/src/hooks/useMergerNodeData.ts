import { useCallback } from 'react';
import { useNodeContentStore } from '../store/useNodeContentStore';
import { MergerNodeContent } from '../types/nodes';
import { isEqual } from 'lodash';

/**
 * Custom hook to manage Merger node state and operations.
 * All state is managed via useNodeContentStore.
 */
export const useMergerNodeData = ({
  nodeId
}: {
  nodeId: string
}) => {
  // Get the content using proper selector pattern
  const content = useNodeContentStore(
    useCallback(
      (state) => state.getNodeContent(nodeId, 'merger') as MergerNodeContent,
      [nodeId]
    )
  );
  
  // Get the setNodeContent function
  const setNodeContent = useNodeContentStore(state => state.setNodeContent);

  // Provide defaults when accessing properties
  const label = content?.label || 'Merger Node';
  const mergeMode = content?.mergeMode || 'concat';
  const strategy = content?.strategy || 'array';
  const keys = content?.keys || [];
  const items = content?.items || [];
  const itemCount = items.length;
  const mode = content?.mode || 'default';
  const params = content?.params || [];
  const result = content?.result || [];

  /**
   * Update content with deep equality check to prevent unnecessary updates
   */
  const updateMergerContent = useCallback((updates: Partial<MergerNodeContent>) => {
    // Check if any individual updates differ from current values
    const hasChanges = Object.entries(updates).some(([key, value]) => {
      const currentValue = content[key as keyof MergerNodeContent];
      return !isEqual(currentValue, value);
    });
    
    if (!hasChanges) {
      console.log(`[MergerNode ${nodeId}] Skipping content update - no changes (deep equal)`);
      return;
    }
    
    console.log(`[MergerNode ${nodeId}] Updating content with:`, updates);
    setNodeContent(nodeId, updates);
  }, [nodeId, content, setNodeContent]);

  // Change handlers using the central updater
  const handleLabelChange = useCallback((newLabel: string) => {
    updateMergerContent({ label: newLabel });
  }, [updateMergerContent]);

  const handleStrategyChange = useCallback((newStrategy: 'array' | 'object') => {
    updateMergerContent({ strategy: newStrategy });
  }, [updateMergerContent]);

  const handleKeysChange = useCallback((newKeys: string[]) => {
    updateMergerContent({ keys: newKeys });
  }, [updateMergerContent]);

  /**
   * Add a new item to the accumulated items.
   */
  const addItem = useCallback((item: any) => {
    const newItems = [...items, item]; 
    console.log(`[MergerNode ${nodeId}] Adding item. New count: ${newItems.length}`);
    updateMergerContent({ items: newItems });
  }, [nodeId, items, updateMergerContent]); 

  /**
   * Reset all accumulated items.
   */
  const resetItems = useCallback(() => {
    if (items.length === 0) return;

    console.log(`[MergerNode ${nodeId}] Resetting ${items.length} items`);
    updateMergerContent({ items: [] });
  }, [nodeId, items, updateMergerContent]);

  return {
    // Data
    content,
    label,
    mergeMode,
    strategy,
    keys,
    items,
    itemCount,
    mode,
    params,
    result,

    // Change Handlers
    handleLabelChange,
    handleStrategyChange,
    handleKeysChange,

    // Result Item Handlers
    addItem,
    resetItems,
    
    // Direct update method
    updateContent: updateMergerContent
  };
}; 