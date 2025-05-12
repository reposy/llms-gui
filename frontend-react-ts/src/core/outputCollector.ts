import { useFlowStructureStore } from '../store/useFlowStructureStore';
import { getNodeState, useNodeStateStore } from '../store/useNodeStateStore';
import { Edge, Node } from '@xyflow/react';

// 노드 결과 인터페이스
export interface NodeResult {
  nodeId: string;
  nodeName: string; // 노드 이름 추가
  nodeType: string;
  result: any;
}

/**
 * 현재 플로우에서 노드 ID에 해당하는 노드 이름을 가져옵니다.
 * 노드 이름이 없으면 타입과 ID 조합을 반환합니다.
 */
const getNodeName = (nodeId: string): string => {
  const { nodes } = useFlowStructureStore.getState();
  const node = nodes.find(n => n.id === nodeId);
  return node?.data?.label || `${node?.type || '노드'} ${nodeId.slice(-6)}`;
};

/**
 * 현재 플로우에서 노드 ID에 해당하는 노드 타입을 가져옵니다.
 */
const getNodeType = (nodeId: string): string => {
  const { nodes } = useFlowStructureStore.getState();
  const node = nodes.find(n => n.id === nodeId);
  return node?.type || 'unknown';
};

/**
 * 플로우에서 리프 노드(출력 연결이 없는 노드)를 찾습니다.
 * 그룹 내부 노드는 제외합니다.
 */
export const findLeafNodes = (): string[] => {
  const { nodes, edges } = useFlowStructureStore.getState();
  
  // 그룹 노드 및 그룹 내부 노드 식별
  const groupNodes = nodes.filter(node => node.type === 'group');
  const nodesInGroups = new Set<string>();
  
  // 그룹 내부 노드 ID 수집
  groupNodes.forEach(groupNode => {
    if (groupNode.data && groupNode.data.nodeIds) {
      groupNode.data.nodeIds.forEach((nodeId: string) => {
        nodesInGroups.add(nodeId);
      });
    }
  });
  
  // 엣지에서 소스 노드 ID 수집 (출력이 있는 노드)
  const sourceNodeIds = new Set(edges.map(edge => edge.source));
  
  // 리프 노드 찾기:
  // 1. 그룹 내부 노드가 아니어야 함
  // 2. 출력 연결(소스)이 없어야 함
  const leafNodeIds = nodes
    .filter(node => 
      !nodesInGroups.has(node.id) && // 그룹 내부 노드가 아님
      !sourceNodeIds.has(node.id)    // 출력 연결이 없음
    )
    .map(node => node.id);
  
  console.log(`[outputCollector] Found ${leafNodeIds.length} leaf nodes:`, leafNodeIds);
  return leafNodeIds;
};

/**
 * 현재 Flow의 루트 노드(입력 연결이 없는 노드)를 찾습니다.
 * 그룹 내부 노드는 제외합니다.
 */
export const findRootNodes = (): string[] => {
  const { nodes, edges } = useFlowStructureStore.getState();
  
  // 그룹 노드 및 그룹 내부 노드 식별
  const groupNodes = nodes.filter(node => node.type === 'group');
  const nodesInGroups = new Set<string>();
  
  // 그룹 내부 노드 ID 수집
  groupNodes.forEach(groupNode => {
    if (groupNode.data && groupNode.data.nodeIds) {
      groupNode.data.nodeIds.forEach((nodeId: string) => {
        nodesInGroups.add(nodeId);
      });
    }
  });
  
  // 엣지에서 타겟 노드 ID 수집 (입력이 있는 노드)
  const targetNodeIds = new Set(edges.map(edge => edge.target));
  
  // 루트 노드 찾기:
  // 1. 그룹 내부 노드가 아니어야 함
  // 2. 입력 연결(타겟)이 없어야 함
  const rootNodeIds = nodes
    .filter(node => 
      !nodesInGroups.has(node.id) && // 그룹 내부 노드가 아님
      !targetNodeIds.has(node.id)    // 입력 연결이 없음
    )
    .map(node => node.id);
  
  console.log(`[outputCollector] Found ${rootNodeIds.length} root nodes:`, rootNodeIds);
  return rootNodeIds;
};

/**
 * 노드 ID에 해당하는 출력 결과를 가져옵니다.
 */
export const getNodeOutputs = (nodeId: string): NodeResult[] | null => {
  const nodeState = getNodeState(nodeId);
  
  // 노드 상태가 없거나 성공이 아니면 null 반환
  if (!nodeState || nodeState.status !== 'success') {
    return null;
  }
  
  // 노드 결과가 정의되어 있지 않으면 null 반환
  if (nodeState.result === undefined) {
    return null;
  }
  
  // 노드 이름과 타입 가져오기
  const nodeName = getNodeName(nodeId);
  const nodeType = getNodeType(nodeId);
  
  // 결과 객체 생성
  return [{
    nodeId,
    nodeName,
    nodeType,
    result: nodeState.result
  }];
};

/**
 * 플로우 실행 후 결과를 수집합니다.
 * 1. 기본적으로 리프 노드(출력 노드가 없는 노드)에서 결과를 수집합니다.
 * 2. 리프 노드에서 결과를 찾지 못한 경우 모든 성공한 노드에서 결과를 수집합니다.
 */
export const getAllOutputs = (): NodeResult[] => {
  // 1. 리프 노드 찾기
  const leafNodeIds = findLeafNodes();
  const { nodes } = useFlowStructureStore.getState();
  
  // 결과 수집
  const results: NodeResult[] = [];
  
  // 2. 리프 노드에서 결과 수집
  console.log(`[outputCollector] Collecting results from ${leafNodeIds.length} leaf nodes`);
  
  for (const nodeId of leafNodeIds) {
    // nodeState에서 상태 확인
    const nodeState = getNodeState(nodeId);
    const node = nodes.find(n => n.id === nodeId);
    
    if (nodeState?.status === 'success') {
      // 노드 이름 가져오기 (없으면 노드 타입 + ID 마지막 6자리 사용)
      const nodeName = node?.data?.label || 
                      `${node?.type || '노드'} ${nodeId.slice(-6)}`;
      
      // 결과 객체 생성 - nodeState.result 사용
      results.push({
        nodeId,
        nodeName,
        nodeType: node?.type || 'unknown',
        result: nodeState.result
      });
      
      console.log(`[outputCollector] Added result from leaf node ${nodeId}: ${typeof nodeState.result}`);
    }
  }
  
  // 3. 리프 노드에서 결과를 찾지 못한 경우, 모든 성공한 노드에서 결과 수집
  if (results.length === 0) {
    console.log(`[outputCollector] No results found in leaf nodes, checking all successful nodes`);
    
    // 모든 노드 확인
    for (const node of nodes) {
      // 이미 처리한 리프 노드는 건너뛰기
      if (leafNodeIds.includes(node.id)) {
        continue;
      }
      
      const nodeState = getNodeState(node.id);
      
      if (nodeState?.status === 'success') {
        const nodeName = node?.data?.label || 
                        `${node?.type || '노드'} ${node.id.slice(-6)}`;
        
        results.push({
          nodeId: node.id,
          nodeName,
          nodeType: node.type || 'unknown',
          result: nodeState.result
        });
        
        console.log(`[outputCollector] Added result from non-leaf node ${node.id}: ${typeof nodeState.result}`);
      }
    }
  }
  
  console.log(`[outputCollector] Total results collected: ${results.length}`);
  return results;
}; 