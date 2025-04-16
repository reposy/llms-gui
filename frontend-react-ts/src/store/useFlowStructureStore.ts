import { createWithEqualityFn } from 'zustand/traditional';
import { persist } from 'zustand/middleware';
import { Node, Edge } from 'reactflow';
import { isEqual } from 'lodash';

// 노드 데이터 타입 정의
export interface NodeData {
  label?: string;
  [key: string]: any;
}

// 선택 모디파이어 키 타입 정의
export type SelectionModifierKey = 'none' | 'shift' | 'ctrl';

// 스토어 상태 정의
export interface FlowStructureState {
  // 상태
  nodes: Node<NodeData>[];
  edges: Edge[];
  
  // 액션
  setNodes: (nodes: Node<NodeData>[]) => void;
  setEdges: (edges: Edge[]) => void;
}

// 스토어 생성
export const useFlowStructureStore = createWithEqualityFn<FlowStructureState>()(
  persist(
    (set, get) => ({
      // 초기 상태
      nodes: [],
      edges: [],
      
      // 액션
      setNodes: (nodes) => set({ nodes }),
      setEdges: (edges) => set({ edges }),
    }),
    {
      name: 'flow-structure-storage',
      partialize: (state) => ({
        nodes: state.nodes,
        edges: state.edges,
      }),
    }
  )
);

// 컴포넌트용 셀렉터
export const useNodes = () => useFlowStructureStore(state => state.nodes);
export const useEdges = () => useFlowStructureStore(state => state.edges);

// 액션 직접 내보내기
export const {
  setNodes,
  setEdges,
} = useFlowStructureStore.getState(); 