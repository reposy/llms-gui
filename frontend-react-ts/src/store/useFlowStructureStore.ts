import { createWithEqualityFn } from 'zustand/traditional';
import { devtools, persist } from 'zustand/middleware';
import { Node, Edge } from 'reactflow';
import { NodeData } from '../types/nodes';
import { isEqual } from 'lodash';

// Define the store state structure
export interface FlowStructureState {
  // State
  nodes: Node<NodeData>[];
  edges: Edge[];
  selectedNodeId: string | null;

  // Actions
  setNodes: (nodes: Node<NodeData>[]) => void;
  setEdges: (edges: Edge[]) => void;
  setSelectedNodeId: (id: string | null) => void;
  updateNode: (id: string, updater: (node: Node<NodeData>) => Node<NodeData>) => void;
}

// Create the Zustand store
export const useFlowStructureStore = createWithEqualityFn<FlowStructureState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        nodes: [],
        edges: [],
        selectedNodeId: null,

        // Action implementations
        setNodes: (nodes) => set({ nodes }),
        
        setEdges: (edges) => set({ edges }),
        
        setSelectedNodeId: (id) => set({ selectedNodeId: id }),
        
        updateNode: (id, updater) => set((state) => {
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
      }),
      {
        name: 'flow-structure-storage',
        partialize: (state) => ({
          nodes: state.nodes,
          edges: state.edges,
          selectedNodeId: state.selectedNodeId,
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
  setSelectedNodeId,
  updateNode,
} = useFlowStructureStore.getState(); 