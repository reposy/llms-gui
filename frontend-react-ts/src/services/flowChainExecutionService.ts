import { useExecutorStateStore } from '../store/useExecutorStateStore';
import { executeFlowExecutor } from './flowExecutionService';
import { deepClone } from '../utils/helpers';

// 실행 파라미터 인터페이스
export interface ExecuteFlowChainParams {
  chainId: string;
  onChainStart?: () => void;
  onChainComplete?: (results: any) => void;
  onFlowStart?: (flowId: string, flowName: string, index: number) => void;
  onFlowComplete?: (flowId: string, flowName: string, result: any, index: number) => void;
  onError?: (flowId: string | null, error: string) => void;
}

/**
 * Flow Chain 실행 함수
 * Chain 내 Flow들을 순서대로 실행하고 결과를 다음 Flow의 입력으로 전달합니다.
 */
export const executeFlowChain = async (params: ExecuteFlowChainParams): Promise<void> => {
  const { chainId, onChainStart, onChainComplete, onFlowStart, onFlowComplete, onError } = params;
  
  try {
    // 실행기 스토어 가져오기
    const executorStore = useExecutorStateStore.getState();
    
    // Chain 정보 가져오기
    const chain = executorStore.getFlowChain(chainId);
    
    if (!chain) {
      throw new Error(`Flow Chain not found: ${chainId}`);
    }
    
    // 실행 시작 알림
    if (onChainStart) {
      onChainStart();
    }
    
    // Chain 상태 업데이트
    executorStore.setFlowChainStatus(chainId, 'running');
    
    console.log(`[FlowChainExecution] Starting chain execution: ${chainId} (${chain.flowIds.length} flows)`);
    
    // 순차 실행을 위한 결과 변수
    let chainResults: any = null;
    
    // 순서대로 Flow 실행
    for (let i = 0; i < chain.flowIds.length; i++) {
      const flowId = chain.flowIds[i];
      const flow = chain.flowMap[flowId];
      
      if (!flow) {
        console.warn(`[FlowChainExecution] Flow not found: ${flowId}, skipping`);
        continue;
      }
      
      console.log(`[FlowChainExecution] Executing flow ${i + 1}/${chain.flowIds.length}: ${flowId} (${flow.name})`);
      
      // Flow 상태 업데이트
      executorStore.setFlowStatus(chainId, flowId, 'running');
      
      // Flow 시작 알림
      if (onFlowStart) {
        onFlowStart(flowId, flow.name, i);
      }
      
      // 입력 준비 (이전 Flow의 결과 또는 지정된 inputs)
      const inputs = i === 0 || !chainResults
        ? (flow.inputs || [])
        : [chainResults];
      
      try {
        // Flow 실행
        const result = await executeFlowExecutor({
          flowId,
          chainId,
          flowJson: {
            nodes: Object.values(flow.nodes).map(node => ({
              id: node.id,
              type: node.type,
              data: node.data,
              position: node.position,
              parentId: node.parentNodeId
            })),
            edges: Object.keys(flow.graph).flatMap(nodeId => {
              const relation = flow.graph[nodeId];
              return relation.childs.map(childId => ({
                id: `edge-${nodeId}-${childId}`,
                source: nodeId,
                target: childId
              }));
            })
          },
          inputs
        });
        
        // 결과 저장
        chainResults = result.outputs;
        
        // Flow 완료 알림
        if (onFlowComplete) {
          onFlowComplete(flowId, flow.name, chainResults, i);
        }
        
        console.log(`[FlowChainExecution] Flow ${flowId} completed successfully`);
      } catch (flowError) {
        // Flow 실행 에러 처리
        const errorMessage = flowError instanceof Error ? flowError.message : String(flowError);
        console.error(`[FlowChainExecution] Error executing flow ${flowId}:`, errorMessage);
        
        // 상태 업데이트
        executorStore.setFlowStatus(chainId, flowId, 'error', errorMessage);
        executorStore.setFlowChainStatus(chainId, 'error', `Flow ${flow.name} 실행 중 오류: ${errorMessage}`);
        
        // 에러 콜백
        if (onError) {
          onError(flowId, errorMessage);
        }
        
        // 체인 실행 중단
        throw new Error(`Flow ${flow.name} 실행 중 오류: ${errorMessage}`);
      }
    }
    
    // 모든 Flow 실행 성공
    console.log(`[FlowChainExecution] Chain ${chainId} completed successfully`);
    
    // Chain 상태 업데이트
    executorStore.setFlowChainStatus(chainId, 'success');
    
    // Chain 완료 알림
    if (onChainComplete) {
      onChainComplete(chainResults);
    }
  } catch (chainError) {
    // Chain 실행 에러 처리
    const errorMessage = chainError instanceof Error ? chainError.message : String(chainError);
    console.error(`[FlowChainExecution] Error executing chain ${chainId}:`, errorMessage);
    
    // onError가 아직 호출되지 않은 경우 (flowId 지정 없이)
    if (onError) {
      onError(null, errorMessage);
    }
    
    // ExecutorStateStore 호환성 유지 (전체 에러)
    const executorStore = useExecutorStateStore.getState();
    executorStore.setFlowChainStatus(chainId, 'error');
    
    throw chainError;
  }
};

/**
 * 입력값 내 참조 처리 함수
 * 입력값 중 ${flow.id.result} 패턴을 찾아 해당 Flow의 결과로 대체합니다.
 */
export const processInputReferences = (inputs: any[], previousResults: Record<string, any[]>): any[] => {
  const processedInputs = deepClone(inputs);
  
  // 문자열 입력값에서 참조 패턴 찾기
  const processValue = (value: any): any => {
    if (typeof value !== 'string') return value;
    
    // ${flowId.result} 패턴 찾기
    const regex = /\${([^.]+)\.result}/g;
    let match;
    let processed = value;
    
    while ((match = regex.exec(value)) !== null) {
      const flowId = match[1];
      if (previousResults[flowId]) {
        // 전체 텍스트를 결과로 대체 (단일 참조인 경우만)
        if (match[0] === value) {
          return previousResults[flowId];
        }
        
        // 텍스트 내 참조 부분만 결과로 대체 (텍스트 내 일부만 참조인 경우)
        const resultText = JSON.stringify(previousResults[flowId]);
        processed = processed.replace(match[0], resultText);
      }
    }
    
    return processed;
  };
  
  // 모든 입력값에 대해 처리
  return processedInputs.map(input => {
    if (typeof input === 'object' && input !== null) {
      // 객체인 경우 재귀적으로 모든 필드 처리
      const processedObject: Record<string, any> = {};
      
      for (const [key, value] of Object.entries(input)) {
        processedObject[key] = processValue(value);
      }
      
      return processedObject;
    }
    
    return processValue(input);
  });
}; 