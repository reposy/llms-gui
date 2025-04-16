import { createWithEqualityFn } from 'zustand/traditional';
import { persist } from 'zustand/middleware';
import { Node, Edge } from 'reactflow';

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
  selectedNodeId: string | null;
  selectedNodeIds: string[]; // 여러 노드 선택 지원
  
  // 액션
  setNodes: (nodes: Node<NodeData>[]) => void;
  setEdges: (edges: Edge[]) => void;
  setSelectedNodeId: (id: string | null) => void;
  setSelectedNodeIds: (ids: string[]) => void;
}

// 스토어 생성
export const useFlowStructureStore = createWithEqualityFn<FlowStructureState>()(
  persist(
    (set, get) => ({
      // 초기 상태
      nodes: [],
      edges: [],
      selectedNodeId: null,
      selectedNodeIds: [],
      
      // 액션
      setNodes: (nodes) => set({ nodes }),
      setEdges: (edges) => set({ edges }),
      setSelectedNodeId: (id) => set({ selectedNodeId: id }),
      setSelectedNodeIds: (ids) => set({ selectedNodeIds: ids }),
    }),
    {
      name: 'flow-structure-storage',
      partialize: (state) => ({
        nodes: state.nodes,
        edges: state.edges,
        selectedNodeId: state.selectedNodeId,
        selectedNodeIds: state.selectedNodeIds,
      }),
    }
  )
);

// 컴포넌트용 셀렉터
export const useNodes = () => useFlowStructureStore(state => state.nodes);
export const useEdges = () => useFlowStructureStore(state => state.edges);
export const useSelectedNodeId = () => useFlowStructureStore(state => state.selectedNodeId);
export const useSelectedNodeIds = () => useFlowStructureStore(state => state.selectedNodeIds);

/**
 * 노드 선택 상태를 업데이트하는 함수
 * 모디파이어 키에 따라 다양한 선택 동작 지원
 */
export const applyNodeSelection = (nodeIds: string[], modifierKey: SelectionModifierKey = 'none') => {
  const state = useFlowStructureStore.getState();
  const { selectedNodeIds, nodes } = state;
  
  let newSelectedIds: string[] = [];
  
  // 모디파이어 키에 따른 선택 로직
  switch (modifierKey) {
    case 'shift':
      // Shift: 기존 선택에 새 노드 추가 (토글 방식)
      newSelectedIds = [...selectedNodeIds];
      
      // 이미 선택된 노드면 선택 해제, 아니면 선택 추가
      for (const id of nodeIds) {
        const index = newSelectedIds.indexOf(id);
        if (index >= 0) {
          newSelectedIds.splice(index, 1); // 선택 해제
        } else {
          newSelectedIds.push(id); // 선택 추가
        }
      }
      break;
      
    case 'ctrl':
      // Ctrl: 기존 선택에 새 노드 추가 (Shift와 유사하지만 다른 동작 가능)
      newSelectedIds = [...selectedNodeIds];
      
      // 이미 선택된 노드면 선택 해제, 아니면 선택 추가
      for (const id of nodeIds) {
        const index = newSelectedIds.indexOf(id);
        if (index >= 0) {
          newSelectedIds.splice(index, 1); // 선택 해제
        } else {
          newSelectedIds.push(id); // 선택 추가
        }
      }
      break;
      
    default:
      // 'none': 새로운 선택으로 완전히 대체
      newSelectedIds = [...nodeIds];
  }
  
  // 노드 업데이트 (노드의 selected 속성 업데이트)
  const updatedNodes = nodes.map(node => ({
    ...node,
    selected: newSelectedIds.includes(node.id)
  }));
  
  // 스토어 업데이트
  useFlowStructureStore.setState({
    nodes: updatedNodes,
    selectedNodeIds: newSelectedIds,
    selectedNodeId: newSelectedIds.length === 1 ? newSelectedIds[0] : null,
  });
};

// 액션 직접 내보내기
export const {
  setNodes,
  setEdges,
  setSelectedNodeId,
  setSelectedNodeIds,
} = useFlowStructureStore.getState(); 