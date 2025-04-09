import { createWithEqualityFn } from 'zustand/traditional';
import { devtools, persist } from 'zustand/middleware';
import { Node, Edge } from 'reactflow';
import { NodeData } from '../types/nodes';
import { isEqual } from 'lodash';
import { useCallback } from 'react';

// Define the store state structure
export interface FlowStructureState {
  // State
  nodes: Node<NodeData>[];
  edges: Edge[];
  selectedNodeId: string | null;
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

// Export actions directly for use outside of React components
export const {
  setNodes,
  setEdges,
  updateNode,
} = useFlowStructureStore.getState();

// Add selection lock functions
export const useSelectionLock = () => {
  const lockSelection = useCallback(() => {
    useFlowStructureStore.setState(() => ({
      selectionLock: {
        locked: true,
        lockExpiry: Date.now() + 3000 // Lock for 3 seconds by default
      }
    }));
    console.log('[Selection] Locked selection state');
  }, []);

  const unlockSelection = useCallback(() => {
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
  
  useFlowStructureStore.setState({ selectedNodeId: nodeId });
};

export const applyNodeSelection = applyNodeSelectionWithLock = (nodeIds: string[]) => {
  // We allow this function to work even when locked since it's used as part of the paste process
  useFlowStructureStore.setState(state => {
    const updatedNodes = state.nodes.map(node => ({
      ...node,
      selected: nodeIds.includes(node.id)
    }));
    
    return { nodes: updatedNodes };
  });
}; 