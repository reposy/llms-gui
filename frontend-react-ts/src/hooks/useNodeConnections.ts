import { useCallback } from 'react';
import { useFlowStructureStore } from '../store/useFlowStructureStore';

// NodeConnectionData 인터페이스 정의 추가
export interface NodeConnectionData {
  incoming: string[];
  outgoing: string[];
  hasInputs: boolean;
  hasOutputs: boolean;
}

/**
 * 노드의 연결 관계 정보를 반환하는 훅
 * @param nodeId 노드 ID
 * @returns 입력/출력 연결 정보
 */
export function useNodeConnections(nodeId: string): NodeConnectionData {
  const edges = useFlowStructureStore(state => state.edges);
  
  const incoming = edges.filter(edge => edge.target === nodeId).map(edge => edge.source);
  const outgoing = edges.filter(edge => edge.source === nodeId).map(edge => edge.target);
  
  return {
    incoming,
    outgoing,
    hasInputs: incoming.length > 0,
    hasOutputs: outgoing.length > 0
  };
} 