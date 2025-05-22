import { FlowData } from '../data/importExportUtils';
import { useFlowChainStore } from '../../store/useFlowChainStore';
import { useExecutorStateStore } from '../../store/useExecutorStateStore';
import { useExecutorGraphStore } from '../../store/useExecutorGraphStore';
import { deepClone } from '../helpers';

/**
 * Flow 데이터를 모든 관련 스토어에 동기화합니다.
 * ExecutorStateStore, FlowChainStore, ExecutorGraphStore에 Flow 데이터를 일관되게 유지합니다.
 */
export const synchronizeFlowData = (
  flowId: string,
  flowData: FlowData,
  flowChainId?: string,
  name?: string
): void => {
  // 깊은 복사를 사용하여 원본 데이터 변경 방지
  const flowDataClone = deepClone(flowData);
  
  // 1. FlowChainStore 동기화
  const flowChainStore = useFlowChainStore.getState();
  let flowStructure = flowChainStore.getFlow(flowId);
  
  if (!flowStructure) {
    console.log(`[flowChainUtils] Importing flow to FlowChainStore: ${flowId}`);
    // 새 Flow 생성
    flowChainStore.importFlow(flowDataClone, name || flowData.name);
  } else {
    console.log(`[flowChainUtils] Flow already exists in FlowChainStore: ${flowId}`);
  }
  
  // 2. ExecutorGraphStore 동기화
  const graphStore = useExecutorGraphStore.getState();
  const existingGraph = graphStore.getFlowGraph(flowId);
  
  if (!existingGraph) {
    console.log(`[flowChainUtils] Setting flow graph in ExecutorGraphStore: ${flowId}`);
    graphStore.setFlowGraph(flowId, flowDataClone);
  }
  
  // 3. Flow Chain ID가 제공된 경우 ExecutorStateStore 동기화
  if (flowChainId) {
    const executorStore = useExecutorStateStore.getState();
    const flowChain = executorStore.getChain(flowChainId);
    
    if (flowChain) {
      // 체인 내에 해당 Flow가 존재하는지 확인
      const flowExists = flowChain.flowIds.includes(flowId);
      
      if (!flowExists) {
        console.log(`[flowChainUtils] Adding flow to flow chain in ExecutorStateStore: ${flowId} to flow chain ${flowChainId}`);
        executorStore.addFlowToChain(flowChainId, flowDataClone);
      }
    }
  }
  
  console.log(`[flowChainUtils] Flow synchronization complete for flow: ${flowId}`);
};

/**
 * Flow Editor에서 내보낸 Flow JSON 데이터로 확장된 Flow 구조를 구축합니다.
 * 그래프 구조(parents, childs, roots, leafs)를 분석하고 flowchain.flow에 적합한 형태로 변환합니다.
 */
export const buildFlowStructureFromJson = (
  flowJson: FlowData,
  flowId?: string
): string => {
  const flowChainStore = useFlowChainStore.getState();
  
  // Flow 가져오기
  const newFlowId = flowChainStore.importFlow(flowJson, flowJson.name);
  
  // 생성된 Flow 구조 가져오기
  const flowStructure = flowChainStore.getFlow(newFlowId);
  
  if (!flowStructure) {
    throw new Error('Failed to create flow structure from JSON');
  }
  
  console.log(`[flowChainUtils] Built flow structure from JSON:`, {
    flowId: newFlowId,
    name: flowStructure.name,
    nodeCount: Object.keys(flowStructure.nodes).length,
    rootsCount: flowStructure.roots.length,
    leafsCount: flowStructure.leafs.length
  });
  
  return newFlowId;
};

/**
 * 활성화된 Flow의 그래프 상태를 검증합니다.
 * 그래프가 올바른 루트와 리프 노드를 가지고 있는지 확인합니다.
 */
export const validateFlowGraph = (flowId: string): {
  isValid: boolean;
  errors: string[];
} => {
  const flowChainStore = useFlowChainStore.getState();
  const flowStructure = flowChainStore.getFlow(flowId);
  
  const errors: string[] = [];
  
  if (!flowStructure) {
    errors.push(`Flow not found: ${flowId}`);
    return { isValid: false, errors };
  }
  
  // 루트 노드 확인
  if (flowStructure.roots.length === 0) {
    errors.push('Flow has no root nodes (nodes without parents)');
  }
  
  // 리프 노드 확인
  if (flowStructure.leafs.length === 0) {
    errors.push('Flow has no leaf nodes (nodes without children)');
  }
  
  // 노드와 그래프 관계 일관성 확인
  const nodeIds = Object.keys(flowStructure.nodes);
  const graphNodeIds = Object.keys(flowStructure.graph);
  
  if (nodeIds.length !== graphNodeIds.length) {
    errors.push('Mismatch between node count and graph node count');
  }
  
  // 각 노드에 대한 그래프 정보 존재 확인
  for (const nodeId of nodeIds) {
    if (!flowStructure.graph[nodeId]) {
      errors.push(`Missing graph information for node: ${nodeId}`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}; 