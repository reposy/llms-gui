import { useCallback, useMemo } from 'react';
import { shallow } from 'zustand/shallow'; // Use shallow for store selectors
import { useNodeContentStore, MergerNodeContent, NodeContent } from '../store/useNodeContentStore';
// import { useFlowStructureStore } from '../store/useFlowStructureStore'; // Removed FlowStructureStore dependency
import { isEqual } from 'lodash';
// import { Node as ReactFlowNode } from '@xyflow/react'; // Removed ReactFlowNode dependency
import { MergerNodeData } from '../types/nodes'; // Keep type if needed elsewhere, but hook logic shouldn't rely on it

/**
 * Custom hook to manage Merger node state and operations.
 * All state (label, strategy, keys, items) is managed via useNodeContentStore.
 */
export const useMergerNodeData = ({
  nodeId
}: {
  nodeId: string
}) => {
  // --- Content Store Access (Unified State Management) ---
  const setNodeContent = useNodeContentStore(state => state.setNodeContent);

  // Use a selector with shallow comparison to get the entire content object
  const content = useNodeContentStore(
    useCallback(
      (state) => state.getNodeContent<MergerNodeContent>(nodeId, 'merger'), // Get Merger specific content
      [nodeId]
    ),
    shallow // Use shallow comparison
  );

  const isContentDirty = useNodeContentStore(state => state.isNodeDirty(nodeId));

  // --- Derived State (from content store) ---
  // Provide defaults directly when accessing
  const label = content?.label || 'Merger Node';
  const strategy = content?.strategy || 'array';
  const keys = content?.keys || [];
  const items = content?.items || [];
  const itemCount = items.length;

  /**
   * Utility function to update content in the store, ensuring defaults and types.
   */
  const updateMergerContent = useCallback((updates: Partial<Omit<MergerNodeContent, keyof NodeContent | 'isDirty'>>) => {
    const currentContent = useNodeContentStore.getState().getNodeContent<MergerNodeContent>(nodeId, 'merger');
    const newContent: Partial<MergerNodeContent> = { ...currentContent, ...updates };

    if (!isEqual(currentContent, newContent)) {
        console.log(`[useMergerNodeData ${nodeId}] Updating content with:`, updates);
        setNodeContent<MergerNodeContent>(nodeId, newContent);
    } else {
        console.log(`[useMergerNodeData ${nodeId}] Skipping content update - no changes (deep equal).`);
    }
  }, [nodeId, setNodeContent]);

  // --- Change Handlers (using updateMergerContent) ---
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
    // Get current items directly from derived state within the hook
    const newItems = [...items, item]; 
    console.log(`[MergerNode ${nodeId}] Adding item. New count: ${newItems.length}`);
    updateMergerContent({ items: newItems });
  }, [nodeId, items, updateMergerContent]); // Depend on items from hook state

  /**
   * Reset all accumulated items.
   */
  const resetItems = useCallback(() => {
    if (items.length === 0) return; // Use items from hook state

    console.log(`[MergerNode ${nodeId}] Resetting ${items.length} items`);
    updateMergerContent({ items: [] });
  }, [nodeId, items, updateMergerContent]); // Depend on items from hook state

  return {
    // State Data (all from useNodeContentStore)
    label,
    strategy,
    keys,
    items,
    itemCount,
    isDirty: isContentDirty,

    // Change Handlers
    handleLabelChange,
    handleStrategyChange,
    handleKeysChange,
    // handleConfigChange, // Removed

    // Result Item Handlers
    addItem,
    resetItems,
    
    // Provide the unified update function if direct partial updates are needed
    // updateContent: updateMergerContent
  };
}; 