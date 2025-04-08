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
  applyNodeSelection: (nodeIds: string[]) => void;
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
        
        // New action to apply selection to specific nodes
        applyNodeSelection: (nodeIds) => set((state) => {
          // Create a set for O(1) lookup
          const selectedNodeIdSet = new Set(nodeIds);
          
          // Count current selection state for logging
          const previouslySelectedCount = state.nodes.filter(n => n.selected).length;
          
          // Update all nodes' selected state
          const updatedNodes = state.nodes.map(node => {
            // If the node ID is in the set, mark as selected, otherwise unselected
            const isSelected = selectedNodeIdSet.has(node.id);
            
            // Only create a new node object if the selection state changed
            if (node.selected !== isSelected) {
              return {
                ...node,
                selected: isSelected
              };
            }
            
            // Return the original node if selection state didn't change
            return node;
          });
          
          // Count new selection state for debugging
          const nowSelectedCount = updatedNodes.filter(n => n.selected).length;
          
          console.log(`[FlowStructureStore] Applied selection to ${nodeIds.length} nodes: ${nodeIds.slice(0, 3).join(', ')}${nodeIds.length > 3 ? '...' : ''}`);
          console.log(`[FlowStructureStore] Selection state: ${previouslySelectedCount} → ${nowSelectedCount} nodes selected`);
          
          return { nodes: updatedNodes };
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
  applyNodeSelection,
} = useFlowStructureStore.getState(); 