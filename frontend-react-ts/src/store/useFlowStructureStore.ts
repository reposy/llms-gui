import { createWithEqualityFn } from 'zustand/traditional';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Node, Edge, NodeChange, EdgeChange, applyNodeChanges, applyEdgeChanges } from '@xyflow/react';
import { NodeData } from '../types/nodes';
import { createIDBStorage } from '../utils/storage/idbStorage';
import { shallow } from 'zustand/shallow';
import { useCallback } from 'react';

// 로깅 설정 - 자세한 로그를 보고 싶을 때 true로 설정
const VERBOSE_LOGGING = false;

// 플로우 구조 스토어 인터페이스
interface FlowStructureState {
  // 상태 데이터
  nodes: Node<NodeData>[];
  edges: Edge[];
  selectedNodeIds: string[];
  
  // 액션
  setNodes: (nodes: Node<NodeData>[]) => void;
  setEdges: (edges: Edge[]) => void;
  setSelectedNodeIds: (nodeIds: string[]) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
}

// 플로우 구조 관리 스토어
export const useFlowStructureStore = createWithEqualityFn<FlowStructureState>()(
  persist(
    (set, get) => ({
      nodes: [],
      edges: [],
      selectedNodeIds: [],
      
      setNodes: (nodes) => {
        // Only update if nodes have actually changed (basic check)
        if (nodesEqual(get().nodes, nodes)) {
          return;
        }
        set({ nodes });
      },
      
      setEdges: (edges) => {
        // Only update if edges have actually changed (basic check)
        if (edgesEqual(get().edges, edges)) {
          return;
        }
        set({ edges });
      },
      
      setSelectedNodeIds: (nodeIds) => {
        // Check if selection has actually changed
        const currentIds = get().selectedNodeIds;
        const isSameSelection = 
          currentIds.length === nodeIds.length && 
          currentIds.every(id => nodeIds.includes(id));
        
        if (isSameSelection) {
          return;
        }
        set({ selectedNodeIds: nodeIds });
      },

      // React Flow change handlers implementation
      onNodesChange: (changes: NodeChange[]) => {
        set({
          nodes: applyNodeChanges(changes, get().nodes as any) as any,
        });
        // 필요한 경우 변경 사항 로깅
        if (VERBOSE_LOGGING) {
          console.log(`[FlowStructureStore] Applied ${changes.length} node changes`);
        }
      },
      
      onEdgesChange: (changes: EdgeChange[]) => {
        set({
          edges: applyEdgeChanges(changes, get().edges),
        });
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

// 직접 스토어 상태와 액션에 접근하기 위한 헬퍼 함수들
export const setNodes = (nodes: Node<NodeData>[]) => 
  useFlowStructureStore.getState().setNodes(nodes);

export const setEdges = (edges: Edge[]) => 
  useFlowStructureStore.getState().setEdges(edges);

export const setSelectedNodeIds = (nodeIds: string[]) => 
  useFlowStructureStore.getState().setSelectedNodeIds(nodeIds);

export const onNodesChange = (changes: NodeChange[]) => 
  useFlowStructureStore.getState().onNodesChange(changes);

export const onEdgesChange = (changes: EdgeChange[]) => 
  useFlowStructureStore.getState().onEdgesChange(changes);

// 컴포넌트에서 사용하기 위한 셀렉터 훅
export const useNodes = () => 
  useFlowStructureStore(
    useCallback(
      (state) => state.nodes,
      []
    )
  );

export const useEdges = () => 
  useFlowStructureStore(
    useCallback(
      (state) => state.edges,
      []
    )
  );

export const useSelectedNodeIds = () => 
  useFlowStructureStore(
    useCallback(
      (state) => state.selectedNodeIds,
      []
    )
  );

// Helper function to check if two Node arrays are equal (simple version)
function nodesEqual(a: Node<NodeData>[], b: Node<NodeData>[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((nodeA, i) => {
    const nodeB = b[i];
    return nodeA.id === nodeB.id && 
           nodeA.position.x === nodeB.position.x &&
           nodeA.position.y === nodeB.position.y &&
           nodeA.width === nodeB.width && 
           nodeA.height === nodeB.height;
  });
}

// Helper function to check if two Edge arrays are equal (simple version)
function edgesEqual(a: Edge[], b: Edge[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((edgeA, i) => {
    const edgeB = b[i];
    return edgeA.id === edgeB.id && 
           edgeA.source === edgeB.source &&
           edgeA.target === edgeB.target &&
           edgeA.sourceHandle === edgeB.sourceHandle && 
           edgeA.targetHandle === edgeB.targetHandle;
  });
}
