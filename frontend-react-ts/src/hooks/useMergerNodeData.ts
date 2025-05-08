import { useCallback } from 'react';
import { createNodeDataHook } from './useNodeDataFactory';
import { MergerNodeContent } from '../types/nodes';

/**
 * Default values for Merger node content
 */
const MERGER_DEFAULTS: Partial<MergerNodeContent> = {
  label: 'Merger Node',
  mergeMode: 'concat',
  strategy: 'array',
  keys: [],
  items: [],
  mode: 'default',
  params: [],
  result: []
};

/**
 * Custom hook to manage Merger node state and operations.
 * Uses the standardized hook factory pattern.
 */
export const useMergerNodeData = ({ nodeId }: { nodeId: string }) => {
  // Use the factory to create the base hook functionality
  const { 
    content, 
    updateContent: updateMergerContent, 
    createChangeHandler 
  } = createNodeDataHook<MergerNodeContent>('merger', MERGER_DEFAULTS)({ nodeId });

  // Extract properties with defaults for easier access
  const label = content?.label || MERGER_DEFAULTS.label;
  const mergeMode = content?.mergeMode || MERGER_DEFAULTS.mergeMode;
  const strategy = content?.strategy || MERGER_DEFAULTS.strategy;
  const keys = content?.keys || MERGER_DEFAULTS.keys;
  const items = content?.items || MERGER_DEFAULTS.items;
  const itemCount = items?.length || 0;
  const mode = content?.mode || MERGER_DEFAULTS.mode;
  const params = content?.params || MERGER_DEFAULTS.params;
  const result = content?.result || MERGER_DEFAULTS.result;

  // Create standard change handlers
  const handleLabelChange = createChangeHandler('label');
  const handleStrategyChange = createChangeHandler('strategy');
  const handleKeysChange = createChangeHandler('keys');

  /**
   * Add a new item to the accumulated items.
   */
  const addItem = useCallback((item: any) => {
    // items가 정의되지 않은 경우 빈 배열로 초기화
    const currentItems = items || [];
    const newItems = [...currentItems, item]; 
    console.log(`[MergerNode ${nodeId}] Adding item. New count: ${newItems.length}`);
    updateMergerContent({ items: newItems });
  }, [nodeId, items, updateMergerContent]);

  /**
   * Reset all accumulated items.
   */
  const resetItems = useCallback(() => {
    if (!items || items.length === 0) return;

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