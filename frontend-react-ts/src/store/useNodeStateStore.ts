import { create } from 'zustand';
import { NodeState as ExecutionNodeState } from '../types/execution';

// Use the NodeState from types/execution.ts to ensure consistency
type NodeState = ExecutionNodeState;

interface NodeStateStore {
  states: Record<string, NodeState>;
  getNodeState: (nodeId: string) => NodeState;
  setNodeState: (nodeId: string, state: Partial<NodeState>) => void;
  resetNodeState: (nodeId: string) => void;
}

export const useNodeStateStore = create<NodeStateStore>((set, get) => ({
  states: {},
  
  getNodeState: (nodeId) => {
    return get().states[nodeId] || { status: 'idle', result: null };
  },
  
  setNodeState: (nodeId, state) => {
    set((store) => ({
      states: {
        ...store.states,
        [nodeId]: {
          ...get().getNodeState(nodeId),
          ...state,
          _lastUpdate: Date.now() // Add timestamp for reactivity
        }
      }
    }));
  },

  resetNodeState: (nodeId) => {
    set((store) => {
      const newStates = { ...store.states };
      // 노드 상태를 초기 상태(idle)로 재설정
      newStates[nodeId] = { status: 'idle', result: null };
      return { states: newStates };
    });
  }
}));

// 직접 접근 가능한 함수들 내보내기
export const { 
  getNodeState, 
  setNodeState, 
  resetNodeState 
} = useNodeStateStore.getState();

/**
 * 지정된 노드 ID들의 상태를 모두 초기화하는 함수
 * @param nodeIds 초기화할 노드 ID 배열
 */
export const resetNodeStates = (nodeIds: string[]) => {
  // 각 노드의 상태를 초기화
  for (const nodeId of nodeIds) {
    resetNodeState(nodeId);
  }
};

/**
 * 특정 노드의 상태를 조회하는 훅
 */
export const useNodeState = (nodeId: string) => {
  return useNodeStateStore((state) => state.getNodeState(nodeId));
}; 