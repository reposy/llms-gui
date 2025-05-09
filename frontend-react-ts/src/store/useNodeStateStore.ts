import { createWithEqualityFn } from 'zustand/traditional';
import { NodeState as ExecutionNodeState } from '../types/execution';
import { isEqual } from 'lodash';
import { shallow } from 'zustand/shallow';
import { useCallback } from 'react';

// Use the NodeState from types/execution.ts to ensure consistency
type NodeState = ExecutionNodeState;

interface NodeStateStore {
  states: Record<string, NodeState>;
  getNodeState: (nodeId: string) => NodeState;
  setNodeState: (nodeId: string, state: Partial<NodeState>) => void;
  resetNodeState: (nodeId: string) => void;
  resetNodeStates: (nodeIds: string[]) => void;
}

export const useNodeStateStore = createWithEqualityFn<NodeStateStore>()(
  (set, get) => ({
    states: {},
    
    getNodeState: (nodeId) => {
      return get().states[nodeId] || { status: 'idle', result: null };
    },
    
    setNodeState: (nodeId, newStateUpdate) => {
      set((store) => {
        const currentState = get().getNodeState(nodeId);
        
        // Merge the update with the current state
        const potentialNewState: NodeState = {
          ...currentState,
          ...newStateUpdate,
        };
        
        // Check if the relevant parts of the state actually changed
        const relevantCurrentState = { 
          status: currentState.status, 
          result: currentState.result, 
          error: currentState.error 
        };
        const relevantPotentialNewState = { 
          status: potentialNewState.status, 
          result: potentialNewState.result, 
          error: potentialNewState.error 
        };
        
        if (isEqual(relevantCurrentState, relevantPotentialNewState)) {
          // console.log(`[NodeStateStore] Skipping state update for ${nodeId} - no change.`);
          return {}; // No actual change, return empty object to skip update
        }
        
        // Add timestamp only if state actually changes
        potentialNewState._lastUpdate = Date.now();
        console.log(`[NodeStateStore] Updating state for ${nodeId}:`, potentialNewState);
        
        return {
          states: {
            ...store.states,
            [nodeId]: potentialNewState
          }
        };
      });
    },

    resetNodeState: (nodeId) => {
      set((store) => {
        const newStates = { ...store.states };
        // 노드 상태를 초기 상태(idle)로 재설정
        newStates[nodeId] = { status: 'idle', result: null };
        return { states: newStates };
      });
    },
    
    resetNodeStates: (nodeIds) => {
      set((store) => {
        const newStates = { ...store.states };
        // 각 노드의 상태를 초기화
        for (const nodeId of nodeIds) {
          newStates[nodeId] = { status: 'idle', result: null };
        }
        return { states: newStates };
      });
    }
  }),
  shallow
);

// 직접 스토어 상태와 액션에 접근하기 위한 헬퍼 함수들
export const getNodeState = (nodeId: string): NodeState => 
  useNodeStateStore.getState().getNodeState(nodeId);

export const setNodeState = (nodeId: string, state: Partial<NodeState>): void => 
  useNodeStateStore.getState().setNodeState(nodeId, state);

export const resetNodeState = (nodeId: string): void => 
  useNodeStateStore.getState().resetNodeState(nodeId);

export const resetNodeStates = (nodeIds: string[]): void => 
  useNodeStateStore.getState().resetNodeStates(nodeIds);

// 컴포넌트에서 사용하기 위한 커스텀 훅
export const useNodeState = (nodeId: string): NodeState => {
  return useNodeStateStore(
    useCallback(
      (state) => state.getNodeState(nodeId),
      [nodeId]
    )
  );
}; 