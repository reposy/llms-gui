import { create } from 'zustand';
import { createWithEqualityFn } from 'zustand/traditional';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Node, Edge, NodeChange, EdgeChange, applyNodeChanges, applyEdgeChanges } from '@xyflow/react';
import { NodeData } from '../types/nodes';
import { createIDBStorage } from '../utils/storage/idbStorage';
import { shallow } from 'zustand/shallow';

// 로깅 설정 - 자세한 로그를 보고 싶을 때 true로 설정
const VERBOSE_LOGGING = false;

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

// Use createWithEqualityFn and provide shallow as the default equality function
export const useFlowStructureStore = createWithEqualityFn<FlowStructureState>()(
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
          nodes: applyNodeChanges(changes, get().nodes as any) as any,
        });
        // 필요한 경우 변경 사항 로깅
        // Optionally log changes
        if (VERBOSE_LOGGING) {
          console.log(`[FlowStructureStore] Applied ${changes.length} node changes`);
        }
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
      onRehydrateStorage: () => (state) => {
        console.log('Flow structure hydrated:', state);
      }
    }
  ),
  shallow
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

// 타입 변환을 추가하여 호환성 문제 해결
const applyChangesTyped = (changes: NodeChange[], nodes: Node[]) => {
  return applyNodeChanges(changes, nodes as unknown as Node<NodeData>[]) as unknown as Node[];
};
