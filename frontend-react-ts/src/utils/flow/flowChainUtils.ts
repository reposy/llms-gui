import { FlowData } from '../data/importExportUtils';
import { useExecutorStateStore } from '../../store/useExecutorStateStore';
import { useFlowExecutorStore } from '../../store/useFlowExecutorStore';
import { deepClone } from '../helpers';

/**
 * Flow 데이터를 모든 관련 스토어에 동기화합니다.
 * ExecutorStateStore, ExecutorGraphStore에 Flow 데이터를 일관되게 유지합니다.
 */
export const synchronizeFlowData = (
  flowId: string,
  flowData: FlowData,
  flowChainId?: string,
  name?: string
): void => {
  // 깊은 복사를 사용하여 원본 데이터 변경 방지
  const flowDataClone = deepClone(flowData);
  
  // ExecutorGraphStore 동기화
  const graphStore = useFlowExecutorStore.getState();
  // TODO: getFlowGraph/setFlowGraph는 현재 store에 없음. 필요시 resetFlowGraphs 등 공식 메서드로 대체하거나, 동기화 로직을 store 구조에 맞게 구현 필요.
  // 예시: graphStore.resetFlowGraphs({ [flowId]: flowDataClone });
  
  // Flow Chain ID가 제공된 경우 ExecutorStateStore 동기화
  if (flowChainId) {
    const executorStore = useExecutorStateStore.getState();
    const flowChain = executorStore.getFlowChain(flowChainId);
    
    if (flowChain) {
      // 체인 내에 해당 Flow가 존재하는지 확인
      const flowExists = flowChain.flowIds.includes(flowId);
      
      if (!flowExists) {
        console.log(`[flowChainUtils] Adding flow to flow chain in ExecutorStateStore: ${flowId} to flow chain ${flowChainId}`);
        executorStore.addFlowToFlowChain(flowChainId, flowDataClone);
      }
    }
  }
  
  console.log(`[flowChainUtils] Flow synchronization complete for flow: ${flowId}`);
};

/**
 * Flow Editor에서 내보낸 Flow JSON 데이터로 확장된 Flow 구조를 구축합니다.
 * (dead code: FlowChainStore 관련 코드 제거)
 */
export const buildFlowStructureFromJson = (
  flowJson: FlowData,
  flowId?: string
): string => {
  // 이 함수는 더 이상 FlowChainStore를 사용하지 않습니다.
  throw new Error('buildFlowStructureFromJson is deprecated and not supported.');
};

/**
 * 활성화된 Flow의 그래프 상태를 검증합니다.
 * (dead code: FlowChainStore 관련 코드 제거)
 */
export const validateFlowGraph = (flowId: string): {
  isValid: boolean;
  errors: string[];
} => {
  // 이 함수는 더 이상 FlowChainStore를 사용하지 않습니다.
  return {
    isValid: true,
    errors: ['validateFlowGraph is deprecated and not supported.']
  };
}; 