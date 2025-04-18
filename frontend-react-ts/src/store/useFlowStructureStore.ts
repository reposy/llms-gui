import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Node, Edge } from '@xyflow/react';
import { NodeData } from '../types/nodes';
import { createIDBStorage } from '../utils/idbStorage';

// Type for the store
interface FlowStructureState {
  nodes: Node<NodeData>[];
  edges: Edge[];
  selectedNodeIds: string[];
  
  // Actions
  setNodes: (nodes: Node<NodeData>[]) => void;
  setEdges: (edges: Edge[]) => void;
  setSelectedNodeIds: (nodeIds: string[]) => void;
}

// Create the store with persist middleware
export const useFlowStructureStore = create<FlowStructureState>()(
  persist(
    (set, get) => ({
      nodes: [],
      edges: [],
      selectedNodeIds: [],
      
      setNodes: (nodes) => {
        // Only update if nodes have actually changed
        if (nodesEqual(get().nodes, nodes)) {
          console.log('setNodes: Nodes unchanged, skipping update');
          return;
        }
        
        console.log(`Setting ${nodes.length} nodes in Zustand store`);
        set({ nodes });
      },
      
      setEdges: (edges) => {
        // Only update if edges have actually changed
        if (edgesEqual(get().edges, edges)) {
          console.log('setEdges: Edges unchanged, skipping update');
          return;
        }
        
        console.log(`Setting ${edges.length} edges in Zustand store`);
        set({ edges });
      },
      
      setSelectedNodeIds: (nodeIds) => {
        // Check if selection has actually changed
        const currentIds = get().selectedNodeIds;
        const isSameSelection = 
          currentIds.length === nodeIds.length && 
          currentIds.every(id => nodeIds.includes(id));
        
        if (isSameSelection) {
          console.log('setSelectedNodeIds: Selection unchanged, skipping update');
          return;
        }
        
        console.log(`Setting selectedNodeIds in Zustand store:`, nodeIds);
        set({ selectedNodeIds: nodeIds });
      },
    }),
    {
      name: 'flow-structure-storage',
      storage: createJSONStorage(() => createIDBStorage()),
      partialize: (state) => ({ 
        nodes: state.nodes,
        edges: state.edges,
        // Don't persist selection state across sessions
        // selectedNodeIds: state.selectedNodeIds
      }),
      onRehydrateStorage: () => (state) => {
        console.log('Flow structure hydrated:', state);
      }
    }
  )
);

// Helper function to check if two Node arrays are equal
function nodesEqual(a: Node<NodeData>[], b: Node<NodeData>[]): boolean {
  if (a.length !== b.length) return false;
  
  // Simple comparison - might need to be more sophisticated depending on use case
  return a.every((nodeA, i) => {
    const nodeB = b[i];
    return nodeA.id === nodeB.id && 
           nodeA.type === nodeB.type &&
           nodeA.position.x === nodeB.position.x &&
           nodeA.position.y === nodeB.position.y;
  });
}

// Helper function to check if two Edge arrays are equal
function edgesEqual(a: Edge[], b: Edge[]): boolean {
  if (a.length !== b.length) return false;
  
  // Simple comparison - might need to be more sophisticated depending on use case
  return a.every((edgeA, i) => {
    const edgeB = b[i];
    return edgeA.id === edgeB.id && 
           edgeA.source === edgeB.source &&
           edgeA.target === edgeB.target;
  });
}

// Export action creators for convenience
export const setNodes = (nodes: Node<NodeData>[]) => useFlowStructureStore.getState().setNodes(nodes);
export const setEdges = (edges: Edge[]) => useFlowStructureStore.getState().setEdges(edges);
export const setSelectedNodeIds = (nodeIds: string[]) => useFlowStructureStore.getState().setSelectedNodeIds(nodeIds);

// Export selectors for convenience
export const useNodes = () => useFlowStructureStore(state => state.nodes);
export const useEdges = () => useFlowStructureStore(state => state.edges);
export const useSelectedNodeIds = () => useFlowStructureStore(state => state.selectedNodeIds);