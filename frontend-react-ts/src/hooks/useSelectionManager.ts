import { useCallback } from 'react';
import { useFlowStructureStore } from '../store/useFlowStructureStore';
import { useSelectionStateStore } from '../store/useSelectionStateStore';

export const useSelectionManager = () => {
  const { _setSelectedNodeIdInternal, _setSelectionLockInternal } = useSelectionStateStore.getState();
  const { nodes, setNodes } = useFlowStructureStore();

  // Selection lock functions
  const lockSelection = useCallback(() => {
    _setSelectionLockInternal({
      locked: true,
      lockExpiry: Date.now() + 3000 // Lock for 3 seconds by default
    });
    console.log('[Selection] Locked selection state');
  }, [_setSelectionLockInternal]);

  const unlockSelection = useCallback(() => {
    _setSelectionLockInternal({
      locked: false,
      lockExpiry: null
    });
    console.log('[Selection] Unlocked selection state');
  }, [_setSelectionLockInternal]);

  const isSelectionLocked = useCallback(() => {
    const { locked, lockExpiry } = useSelectionStateStore.getState().selectionLock;
    // If not locked or expiry time has passed, it's not locked
    if (!locked || !lockExpiry || Date.now() > lockExpiry) {
      return false;
    }
    return true;
  }, []);

  // Selection state management
  const setSelectedNodeId = useCallback((nodeId: string | null) => {
    if (isSelectionLocked()) {
      console.log('[Selection] Ignoring selection change attempt while locked');
      return;
    }
    _setSelectedNodeIdInternal(nodeId);
  }, [_setSelectedNodeIdInternal, isSelectionLocked]);

  const applyNodeSelection = useCallback((nodeIds: string[]) => {
    // This function interacts with the nodes array in useFlowStructureStore
    setNodes(
      nodes.map(node => ({
        ...node,
        selected: nodeIds.includes(node.id)
      }))
    );
  }, [nodes, setNodes]); // Depends on nodes and setNodes from FlowStructureStore

  // Get current selection state
  const getSelectedNodeIds = useCallback(() => {
    // Gets selected state from the nodes array in useFlowStructureStore
    return nodes.filter(node => node.selected).map(node => node.id);
  }, [nodes]); // Depends on nodes from FlowStructureStore

  const getSelectedNodeId = useCallback(() => {
    // Gets selectedNodeId from the dedicated selection store
    return useSelectionStateStore.getState().selectedNodeId;
  }, []);

  return {
    // Lock management
    lockSelection,
    unlockSelection,
    isSelectionLocked,
    
    // Selection state management
    setSelectedNodeId,
    applyNodeSelection,
    
    // Selection state getters
    getSelectedNodeIds,
    getSelectedNodeId
  };
}; 