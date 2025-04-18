import { useCallback } from 'react';
import { useNodeContentStore, MergerNodeContent } from '../store/useNodeContentStore';
import { useFlowStructureStore } from '../store/useFlowStructureStore';
import { isEqual } from 'lodash';
import { Node as ReactFlowNode } from '@xyflow/react';
import { MergerNodeData } from '../types/nodes';

/**
 * Custom hook to manage Merger node state and operations.
 * - Configuration (label, strategy, keys) is managed via useFlowStructureStore (node.data).
 * - Result/Output items are managed via useNodeContentStore.
 */
export const useMergerNodeData = ({
  nodeId
}: {
  nodeId: string
}) => {
  // --- Structure Store Access (for Configuration) ---
  const { setNodes, getNode } = useFlowStructureStore(state => ({
    setNodes: state.setNodes,
    getNode: (id: string) => state.nodes.find(n => n.id === id)
  }));

  const node = getNode(nodeId);
  const nodeData = node?.data as MergerNodeData | undefined;

  // --- Content Store Access (for Result Items) ---
  const { getNodeContent, setNodeContent } = useNodeContentStore(state => ({
    getNodeContent: state.getNodeContent,
    setNodeContent: state.setNodeContent
  }));

  // Get merged items from content store
  const contentStoreData = getNodeContent<MergerNodeContent>(nodeId);
  const items = contentStoreData?.items || [];
  const itemCount = items.length;
  const isContentDirty = useNodeContentStore(state => state.isNodeDirty(nodeId));

  // --- Derived Configuration State ---
  const label = nodeData?.label || 'Merger Node';
  const strategy = nodeData?.strategy || 'array';
  const keys = nodeData?.keys || [];

  // --- Callback for Configuration Changes ---
  const handleConfigChange = useCallback((updates: Partial<MergerNodeData>) => {
    const targetNode = getNode(nodeId);
    if (!targetNode || targetNode.type !== 'merger') {
      console.warn(`[useMergerNodeData] Node ${nodeId} not found or not a merger node.`);
      return;
    }

    const currentData = targetNode.data as MergerNodeData;
    const hasChanges = Object.entries(updates).some(([key, value]) => {
      const dataKey = key as keyof MergerNodeData;
      return !isEqual(currentData[dataKey], value);
    });

    if (!hasChanges) {
      console.log(`[useMergerNodeData ${nodeId}] Skipping config update - no changes.`);
      return;
    }

    const updatedData: MergerNodeData = {
      ...currentData,
      ...updates,
      type: 'merger',
      label: ('label' in updates ? updates.label : currentData.label) ?? 'Merger Node',
      strategy: ('strategy' in updates ? updates.strategy : currentData.strategy) ?? 'array',
      keys: ('keys' in updates ? updates.keys : currentData.keys) ?? [],
    };

    setNodes(
      useFlowStructureStore.getState().nodes.map((n: ReactFlowNode<any>) => {
        if (n.id === nodeId) {
          return { ...n, data: updatedData };
        }
        return n;
      })
    );
  }, [nodeId, getNode, setNodes]);

  // --- Configuration Change Handlers ---
  const handleLabelChange = useCallback((newLabel: string) => {
    handleConfigChange({ label: newLabel });
  }, [handleConfigChange]);

  const handleStrategyChange = useCallback((newStrategy: 'array' | 'object') => {
    handleConfigChange({ strategy: newStrategy });
  }, [handleConfigChange]);

  const handleKeysChange = useCallback((newKeys: string[]) => {
    handleConfigChange({ keys: newKeys });
  }, [handleConfigChange]);


  // --- Result Item Management Callbacks (using Content Store) ---
  /**
   * Add a new item to the accumulated items in the content store
   */
  const addItem = useCallback((item: any) => {
    const currentItems = getNodeContent<MergerNodeContent>(nodeId)?.items || [];
    const newItems = [...currentItems, item];
    console.log(`[MergerNode ${nodeId}] Adding item. New count: ${newItems.length}`);
    setNodeContent<MergerNodeContent>(nodeId, { items: newItems });
  }, [nodeId, getNodeContent, setNodeContent]);

  /**
   * Reset all accumulated items in the content store
   */
  const resetItems = useCallback(() => {
    const currentItems = getNodeContent<MergerNodeContent>(nodeId)?.items || [];
    if (currentItems.length === 0) return;

    console.log(`[MergerNode ${nodeId}] Resetting ${currentItems.length} items`);
    setNodeContent<MergerNodeContent>(nodeId, { items: [] });
  }, [nodeId, getNodeContent, setNodeContent]);

  return {
    // Configuration Data (from node.data)
    label,
    strategy,
    keys,

    // Result Data (from nodeContentStore)
    items,
    itemCount,
    isDirty: isContentDirty,

    // Configuration Change Handlers
    handleLabelChange,
    handleStrategyChange,
    handleKeysChange,
    handleConfigChange,

    // Result Item Handlers
    addItem,
    resetItems,
  };
}; 