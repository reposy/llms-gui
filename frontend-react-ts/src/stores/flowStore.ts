import { create } from 'zustand';
import { Edge, Node, NodeChange, applyNodeChanges, applyEdgeChanges, EdgeChange } from 'reactflow';

/**
 * Flow store 인터페이스
 */
export interface FlowState {
  // 노드 및 엣지
  nodes: Node[];
  edges: Edge[];
  
  // 노드 및 엣지 업데이트 함수
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  
  // 커스텀 액션
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  updateNode: (id: string, data: any) => void;
  getNodeById: (id: string) => Node | undefined;
}

/**
 * Flow 상태 관리를 위한 Zustand 스토어
 */
export const useFlowStore = create<FlowState>((set, get) => ({
  // 초기 상태
  nodes: [],
  edges: [],
  
  // 노드 변경 적용
  onNodesChange: (changes: NodeChange[]) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes),
    });
  },
  
  // 엣지 변경 적용
  onEdgesChange: (changes: EdgeChange[]) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
    });
  },
  
  // 노드 전체 설정
  setNodes: (nodes: Node[]) => {
    set({ nodes });
  },
  
  // 엣지 전체 설정
  setEdges: (edges: Edge[]) => {
    set({ edges });
  },
  
  // 특정 노드 데이터 업데이트
  updateNode: (id: string, data: any) => {
    set({
      nodes: get().nodes.map(node => {
        if (node.id === id) {
          return {
            ...node,
            data: {
              ...node.data,
              ...data,
            },
          };
        }
        return node;
      }),
    });
  },
  
  // ID로 노드 조회
  getNodeById: (id: string) => {
    return get().nodes.find(node => node.id === id);
  },
}));

/**
 * Flow 스토어 전역 액세스를 위한 함수
 * 컴포넌트 외부에서도 스토어 상태 액세스 가능
 */
export const useFlowStoreById = {
  getState: () => useFlowStore.getState(),
  subscribe: useFlowStore.subscribe,
  getNodeById: (id: string) => useFlowStore.getState().getNodeById(id),
  updateNode: (id: string, data: any) => useFlowStore.getState().updateNode(id, data),
}; 