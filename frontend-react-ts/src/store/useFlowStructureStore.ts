import { createWithEqualityFn } from 'zustand/traditional';
import { devtools, persist } from 'zustand/middleware';
import { Node, Edge } from 'reactflow';
import { NodeData } from '../types/nodes';
import { isEqual } from 'lodash';
import { useCallback, useRef } from 'react';

// Define the store state structure
export interface FlowStructureState {
  // State
  nodes: Node<NodeData>[];
  edges: Edge[];
  selectedNodeId: string | null;
  selectedNodeIds: string[];
  selectionLock: SelectionLock;

  // Actions
  setNodes: (nodes: Node<NodeData>[]) => void;
  setEdges: (edges: Edge[]) => void;
  setSelectedNodeId: (id: string | null) => void;
  updateNode: (id: string, updater: (node: Node<NodeData>) => Node<NodeData>) => void;
  applyNodeSelection: (nodeIds: string[]) => void;
}

// Add selection locking mechanism to prevent immediate selection override
interface SelectionLock {
  locked: boolean;
  lockExpiry: number | null;
}

// Forward declaration for circular dependency
let setSelectedNodeIdWithLock: (nodeId: string | null) => void;
let applyNodeSelectionWithLock: (nodeIds: string[]) => void;

// Define supported modifier keys for selection
export type SelectionModifierKey = 'shift' | 'ctrl' | 'none';

// Create a ref to track frequent selection updates (for debugging loops)
const lastSelectionUpdate = {
  time: 0,
  count: 0,
  ids: [] as string[]
};

// Create the Zustand store
export const useFlowStructureStore = createWithEqualityFn<FlowStructureState>()(
  devtools(
    persist(
      (set) => {
        // Define the store actions
        const storeActions = {
          // Initial state
          nodes: [],
          edges: [],
          selectedNodeId: null,
          selectedNodeIds: [],
          selectionLock: {
            locked: false,
            lockExpiry: null
          },

          // Action implementations
          setNodes: (nodes: Node<NodeData>[]) => set({ nodes }),
          
          setEdges: (edges: Edge[]) => set({ edges }),
          
          // Use the lock-aware functions that are defined later
          setSelectedNodeId: (id: string | null) => {
            if (setSelectedNodeIdWithLock) {
              setSelectedNodeIdWithLock(id);
            } else {
              // Fallback if not yet defined (should not happen in practice)
              set({ selectedNodeId: id });
            }
          },
          
          updateNode: (id: string, updater: (node: Node<NodeData>) => Node<NodeData>) => set((state) => {
            const nodeIndex = state.nodes.findIndex(node => node.id === id);
            if (nodeIndex === -1) {
              console.warn(`[FlowStructureStore] updateNode: Node ${id} not found.`);
              return state;
            }
            
            const updatedNode = updater(state.nodes[nodeIndex]);
            const newNodes = [...state.nodes];
            newNodes[nodeIndex] = updatedNode;
            
            return { nodes: newNodes };
          }),
          
          // Delegate to the lock-aware function
          applyNodeSelection: (nodeIds: string[]) => {
            if (applyNodeSelectionWithLock) {
              applyNodeSelectionWithLock(nodeIds);
            } else {
              // Fallback implementation
              set((state) => {
                const updatedNodes = state.nodes.map(node => ({
                  ...node,
                  selected: nodeIds.includes(node.id)
                }));
                return { nodes: updatedNodes };
              });
            }
          },
        };

        return storeActions;
      },
      {
        name: 'flow-structure-storage',
        partialize: (state) => ({
          nodes: state.nodes,
          edges: state.edges,
          selectedNodeId: state.selectedNodeId,
          selectedNodeIds: state.selectedNodeIds,
          selectionLock: state.selectionLock,
        }),
      }
    )
  ),
  isEqual
);

// Export individual selectors for component usage
export const useNodes = () => useFlowStructureStore(state => state.nodes, isEqual);
export const useEdges = () => useFlowStructureStore(state => state.edges, isEqual);
export const useSelectedNodeId = () => useFlowStructureStore(state => state.selectedNodeId);
export const useSelectedNodeIds = () => useFlowStructureStore(state => state.selectedNodeIds, isEqual);

// Export actions directly for use outside of React components
export const {
  setNodes,
  setEdges,
  updateNode,
} = useFlowStructureStore.getState();

// Add selection lock functions
export const useSelectionLock = () => {
  const lockSelection = useCallback(() => {
    const state = useFlowStructureStore.getState();
    
    // Skip if already locked
    if (state.selectionLock.locked) {
      return;
    }
    
    useFlowStructureStore.setState(() => ({
      selectionLock: {
        locked: true,
        lockExpiry: Date.now() + 3000 // Lock for 3 seconds by default
      }
    }));
    console.log('[Selection] Locked selection state');
  }, []);

  const unlockSelection = useCallback(() => {
    const state = useFlowStructureStore.getState();
    
    // Skip if already unlocked
    if (!state.selectionLock.locked) {
      return;
    }
    
    useFlowStructureStore.setState(() => ({
      selectionLock: {
        locked: false,
        lockExpiry: null
      }
    }));
    console.log('[Selection] Unlocked selection state');
  }, []);

  const isSelectionLocked = useCallback(() => {
    const { locked, lockExpiry } = useFlowStructureStore.getState().selectionLock;
    
    // If not locked or expiry time has passed, it's not locked
    if (!locked || !lockExpiry || Date.now() > lockExpiry) {
      return false;
    }
    
    return true;
  }, []);

  return { lockSelection, unlockSelection, isSelectionLocked };
};

// Selection functions with lock support
export const setSelectedNodeId = setSelectedNodeIdWithLock = (nodeId: string | null) => {
  const { locked } = useFlowStructureStore.getState().selectionLock;
  
  if (locked) {
    console.log('[Selection] Ignoring selection change attempt while locked');
    return;
  }
  
  const state = useFlowStructureStore.getState();
  
  // Skip update if the selection isn't changing
  if (state.selectedNodeId === nodeId) {
    console.log('[Selection] Selected node ID unchanged, skipping update:', nodeId);
    return;
  }
  
  // IMPORTANT: If we have multiple nodes selected, and we're trying to set selectedNodeId to null,
  // we need to be careful to prevent infinite loops (setting null → multi-select node → null)
  if (nodeId === null && state.selectedNodeIds.length > 1) {
    // Only if we have a valid selectedNodeId that is part of the current multi-selection
    if (state.selectedNodeId !== null && state.selectedNodeIds.includes(state.selectedNodeId)) {
      console.log('[Selection] Multi-selection active, preserving primary selectedNodeId:', state.selectedNodeId);
      return;
    }
  }
  
  console.log('[Selection] Setting selected node ID:', nodeId);
  useFlowStructureStore.setState({ selectedNodeId: nodeId });
};

export const applyNodeSelection = applyNodeSelectionWithLock = (
  nodeIds: string[], 
  modifierKey: SelectionModifierKey = 'none'
) => {
  // We allow this function to work even when locked since it's used as part of the paste process
  useFlowStructureStore.setState(state => {
    // DEBUGGING: Track selection update frequency 
    const now = Date.now();
    if (now - lastSelectionUpdate.time < 500) {
      lastSelectionUpdate.count++;
      if (lastSelectionUpdate.count > 5 && isEqual(lastSelectionUpdate.ids, nodeIds)) {
        console.warn('[applyNodeSelection] WARNING: Selection updated too frequently with same IDs, possible loop', 
          {lastUpdate: lastSelectionUpdate.time, now, count: lastSelectionUpdate.count, stateSelectedId: state.selectedNodeId});
      }
    } else {
      lastSelectionUpdate.time = now;
      lastSelectionUpdate.count = 1;
      lastSelectionUpdate.ids = nodeIds.length > 0 ? [...nodeIds] : [];
    }
    
    // First calculate what the new selection should be
    let finalNodeIds: string[] = [];
    
    // Handle different selection behaviors based on modifier key
    if (modifierKey === 'shift') {
      // Shift key: Always ADD to selection (never remove)
      finalNodeIds = [...new Set([...state.selectedNodeIds, ...nodeIds])];
    } 
    else if (modifierKey === 'ctrl') {
      // Ctrl/Cmd key: Toggle selection
      if (nodeIds.length === 1) {
        const nodeId = nodeIds[0];
        if (state.selectedNodeIds.includes(nodeId)) {
          // If already selected, remove it
          finalNodeIds = state.selectedNodeIds.filter(id => id !== nodeId);
        } else {
          // If not selected, add it
          finalNodeIds = [...state.selectedNodeIds, nodeId];
        }
      } else {
        // Multiple nodes - just add them
        finalNodeIds = [...new Set([...state.selectedNodeIds, ...nodeIds])];
      }
    }
    else {
      // No modifier key: Replace selection
      finalNodeIds = nodeIds;
    }
    
    // Check if the selectedNodeIds array is changing (by value, not by reference)
    const selectionIdsChanged = !isEqual(finalNodeIds, state.selectedNodeIds);
    
    // Determine what the next selectedNodeId should be
    // If we have selection, use the first ID; otherwise null
    const nextSelectedNodeId = finalNodeIds.length > 0 ? finalNodeIds[0] : null;
    
    // Critical fix: Properly check if selectedNodeId is actually changing
    // Multi-selection case: when in multi-selection, we need to be careful with making the primary selectedNodeId null
    let isSelectedNodeIdChanging = false;
    
    // Only consider it changing if:
    // 1. We're going from a value to null (clearing selection)
    // 2. We're going from null to a value (new selection)
    // 3. We're changing from one value to another (different value)
    if (
      (state.selectedNodeId !== null && nextSelectedNodeId === null) || 
      (state.selectedNodeId === null && nextSelectedNodeId !== null) ||
      (state.selectedNodeId !== null && nextSelectedNodeId !== null && state.selectedNodeId !== nextSelectedNodeId)
    ) {
      isSelectedNodeIdChanging = true;
    }
    
    // Special case: If multi-selection active, keep the primary selectedNodeId stable
    // This prevents loops where multi-selection toggles between null and a node ID
    if (finalNodeIds.length > 1 && state.selectedNodeIds.length > 1) {
      // If moving from multi-selection to multi-selection, don't change primary selectedNodeId
      // unless it's been completely removed from selection
      if (state.selectedNodeId !== null && !finalNodeIds.includes(state.selectedNodeId)) {
        // Only change if the current primary ID is no longer selected
        isSelectedNodeIdChanging = true;
      } else if (state.selectedNodeId !== null && finalNodeIds.includes(state.selectedNodeId)) {
        // Current primary ID is still in the selection, keep it stable
        isSelectedNodeIdChanging = false;
      }
    }
    
    // Update the nodes with the new selection state
    // This keeps the selection visual state in sync with the selectedNodeIds
    const updatedNodes = state.nodes.map(node => {
      const shouldBeSelected = finalNodeIds.includes(node.id);
      const isCurrentlySelected = !!node.selected;
      
      // Only create a new node object if selection state is actually changing
      if (shouldBeSelected !== isCurrentlySelected) {
        return { ...node, selected: shouldBeSelected };
      }
      return node; // Return original node object if selection state is the same
    });
    
    // Check if any node.selected flags need to be updated
    const nodesRequiringSelectedFlagUpdates = !isEqual(
      state.nodes.filter(n => n.selected).map(n => n.id).sort(),
      finalNodeIds.sort()
    );
    
    // EARLY RETURN: If absolutely nothing would change, skip the update completely
    if (!selectionIdsChanged && !nodesRequiringSelectedFlagUpdates && !isSelectedNodeIdChanging) {
      console.log('[applyNodeSelection] No changes needed, skipping update', {
        currentSelectedId: state.selectedNodeId,
        nextSelectedId: nextSelectedNodeId,
        selectionIdsChanged,
        nodesRequiringSelectedFlagUpdates,
        isSelectedNodeIdChanging
      });
      return state; // Return current state without changes
    }
    
    // Log only when we're actually going to update state
    console.log('[applyNodeSelection] Changes:', { 
      selectionIdsChanged,
      nodesRequiringSelectedFlagUpdates,
      isSelectedNodeIdChanging,
      currentSelectedId: state.selectedNodeId,
      nextSelectedId: nextSelectedNodeId,
      finalSelectedIds: finalNodeIds,
      multiSelection: finalNodeIds.length > 1
    });
    
    // Update only the properties that have changed
    const updates: Partial<FlowStructureState> = {};
    
    // Only update selectedNodeIds if the array changed
    if (selectionIdsChanged) {
      updates.selectedNodeIds = finalNodeIds;
    }
    
    // Only include nodes in the update if any node's selection state changed
    if (nodesRequiringSelectedFlagUpdates) {
      updates.nodes = updatedNodes;
    }
    
    // Only update selectedNodeId if it's changing and we should change it
    if (isSelectedNodeIdChanging) {
      updates.selectedNodeId = nextSelectedNodeId;
    }
    
    return updates;
  });
};

// For backward compatibility with code that still uses the append parameter
export const applyNodeSelectionBackwardCompat = (nodeIds: string[], append: boolean = false) => {
  applyNodeSelection(nodeIds, append ? 'shift' : 'none');
}; 