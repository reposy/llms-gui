import { useFlowStructureStore } from '../store/useFlowStructureStore';
import { getNodeState } from '../store/useNodeStateStore';

/**
 * 플로우 실행 후 모든 리프 노드(출력 노드가 없는 노드)의 결과를 수집합니다.
 * 그룹 노드의 결과 수집 로직과 유사한 방식으로 작동합니다.
 */
export const getAllOutputs = (): any[] => {
  const { nodes, edges } = useFlowStructureStore.getState();
  
  // 타겟이 있는 노드 ID 목록 (다른 노드로 출력하는 노드)
  const sourceNodeIds = new Set(edges.map(edge => edge.source));
  
  // 리프 노드 찾기 (다른 노드로 출력하지 않는 노드)
  const leafNodeIds = nodes
    .filter(node => !sourceNodeIds.has(node.id))
    .map(node => node.id);
  
  console.log(`[outputCollector] Found ${leafNodeIds.length} leaf nodes:`, leafNodeIds);
  
  // 각 리프 노드의 실행 결과 수집
  const results = [];
  
  for (const nodeId of leafNodeIds) {
    const nodeState = getNodeState(nodeId);
    
    // 성공적으로 실행된 노드만 결과에 포함
    if (nodeState?.status === 'success' && nodeState.result !== undefined) {
      let result = nodeState.result;
      
      // 노드 ID와 함께 결과 객체로 반환
      results.push({
        nodeId,
        nodeType: nodes.find(n => n.id === nodeId)?.type || 'unknown',
        result
      });
    }
  }
  
  console.log(`[outputCollector] Collected results from ${results.length} leaf nodes`);
  return results;
}; 