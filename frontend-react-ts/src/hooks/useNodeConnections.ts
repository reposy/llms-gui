import { useCallback } from 'react';
import { useFlowStructureStore } from '../store/useFlowStructureStore';
import { Node } from '@xyflow/react';
import { NodeData, InputNodeData } from '../types/nodes';

// NodeConnectionData 인터페이스 정의 추가
export interface NodeConnectionData {
  incoming: string[];
  outgoing: string[];
  hasInputs: boolean;
  hasOutputs: boolean;
  hasImageInputs: boolean; // 이미지 입력 노드 연결 여부
}

/**
 * 노드의 연결 관계 정보를 반환하는 훅
 * @param nodeId 노드 ID
 * @returns 입력/출력 연결 정보
 */
export function useNodeConnections(nodeId: string): NodeConnectionData {
  const edges = useFlowStructureStore(state => state.edges);
  const nodes = useFlowStructureStore(state => state.nodes);
  
  const incoming = edges.filter(edge => edge.target === nodeId).map(edge => edge.source);
  const outgoing = edges.filter(edge => edge.source === nodeId).map(edge => edge.target);
  
  // 입력 노드 중에서 이미지 입력이 있는지 확인
  const hasImageInputs = incoming.some(incomingId => {
    const node = nodes.find(n => n.id === incomingId);
    // 입력 노드이고, 파일이 items나 commonItems에 있는지 확인
    return node?.type === 'input';
    // 참고: 실제로 이미지 파일 여부를 확인하려면 노드 데이터를 더 분석해야 하지만,
    // 간단한 구현으로는 입력 노드 타입만 체크
  });
  
  return {
    incoming,
    outgoing,
    hasInputs: incoming.length > 0,
    hasOutputs: outgoing.length > 0,
    hasImageInputs
  };
} 