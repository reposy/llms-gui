import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Node, Edge, NodeChange, EdgeChange, applyNodeChanges, applyEdgeChanges } from '@xyflow/react';
import { NodeData } from '../types/nodes';
import { createIDBStorage } from '../utils/storage/idbStorage';

// Type for the store
interface FlowStructureState {
  nodes: Node<NodeData>[];
  edges: Edge[];
  selectedNodeIds: string[];
  
  // Actions
  setNodes: (nodes: Node<NodeData>[]) => void;
  setEdges: (edges: Edge[]) => void;
  setSelectedNodeIds: (nodeIds: string[]) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
}

// Create the store with persist middleware
export const useFlowStructureStore = create<FlowStructureState>()(
  persist(
    (set, get) => ({
      nodes: [],
      edges: [],
      selectedNodeIds: [],
      
      setNodes: (nodes) => {
        // Only update if nodes have actually changed (basic check)
        if (nodesEqual(get().nodes, nodes)) {
          // console.log('setNodes: Nodes unchanged, skipping update');
          return;
        }
        
        // console.log(`Setting ${nodes.length} nodes in Zustand store`);
        set({ nodes });
      },
      
      setEdges: (edges) => {
        // Only update if edges have actually changed (basic check)
        if (edgesEqual(get().edges, edges)) {
          // console.log('setEdges: Edges unchanged, skipping update');
          return;
        }
        
        // console.log(`Setting ${edges.length} edges in Zustand store`);
        set({ edges });
      },
      
      setSelectedNodeIds: (nodeIds) => {
        // Check if selection has actually changed
        const currentIds = get().selectedNodeIds;
        const isSameSelection = 
          currentIds.length === nodeIds.length && 
          currentIds.every(id => nodeIds.includes(id));
        
        if (isSameSelection) {
          // console.log('setSelectedNodeIds: Selection unchanged, skipping update');
          return;
        }
        
        // console.log(`Setting selectedNodeIds in Zustand store:`, nodeIds);
        set({ selectedNodeIds: nodeIds });
      },

      // React Flow change handlers implementation
      onNodesChange: (changes: NodeChange[]) => {
        set({
          nodes: applyNodeChanges(changes, get().nodes),
        });
        // Optionally log changes
        // console.log('Nodes changed:', changes);
      },
      
      onEdgesChange: (changes: EdgeChange[]) => {
        set({
          edges: applyEdgeChanges(changes, get().edges),
        });
        // Optionally log changes
        // console.log('Edges changed:', changes);
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
        // Note: applyNodeChanges might affect node data, 
        // ensure persist/partialize logic aligns with data handling in useNodeContentStore if needed.
      }),
      onRehydrateStorage: () => (state) => {
        console.log('Flow structure hydrated:', state);
      }
    }
  )
);

// Helper function to check if two Node arrays are equal (simple version)
function nodesEqual(a: Node<NodeData>[], b: Node<NodeData>[]): boolean {
  if (a.length !== b.length) return false;
  // This comparison might be too simple if node order can change or data complexity increases
  // A more robust comparison might involve checking IDs and positions/data
  return a.every((nodeA, i) => {
    const nodeB = b[i];
    // Basic checks, might need deep comparison for data if setNodes carries complex updates
    return nodeA.id === nodeB.id && 
           nodeA.position.x === nodeB.position.x &&
           nodeA.position.y === nodeB.position.y &&
           nodeA.width === nodeB.width && // Added width/height checks
           nodeA.height === nodeB.height;
  });
}

// Helper function to check if two Edge arrays are equal (simple version)
function edgesEqual(a: Edge[], b: Edge[]): boolean {
  if (a.length !== b.length) return false;
  // Similar to nodesEqual, might need more robustness
  return a.every((edgeA, i) => {
    const edgeB = b[i];
    return edgeA.id === edgeB.id && 
           edgeA.source === edgeB.source &&
           edgeA.target === edgeB.target &&
           edgeA.sourceHandle === edgeB.sourceHandle && // Added handle checks
           edgeA.targetHandle === edgeB.targetHandle;
  });
}

// Export action creators for convenience
export const setNodes = (nodes: Node<NodeData>[]) => useFlowStructureStore.getState().setNodes(nodes);
export const setEdges = (edges: Edge[]) => useFlowStructureStore.getState().setEdges(edges);
export const setSelectedNodeIds = (nodeIds: string[]) => useFlowStructureStore.getState().setSelectedNodeIds(nodeIds);
// Export new actions
export const onNodesChange = (changes: NodeChange[]) => useFlowStructureStore.getState().onNodesChange(changes);
export const onEdgesChange = (changes: EdgeChange[]) => useFlowStructureStore.getState().onEdgesChange(changes);

// Export selectors for convenience
export const useNodes = () => useFlowStructureStore(state => state.nodes);
export const useEdges = () => useFlowStructureStore(state => state.edges);
export const useSelectedNodeIds = () => useFlowStructureStore(state => state.selectedNodeIds);