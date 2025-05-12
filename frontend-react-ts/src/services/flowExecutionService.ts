import { runFullFlowExecution } from '../core/executionUtils';
import { FlowData } from '../utils/data/importExportUtils';
import { getAllOutputs } from '../core/outputCollector';

interface ExecuteFlowParams {
  flowJson: FlowData;
  inputs: any[];
}

interface ExecutionResponse {
  executionId: string;
  outputs: any;
  status: 'success' | 'error';
  error?: string;
}

interface ExecuteChainParams {
  flowItems: Array<{
    id: string;
    flowJson: FlowData;
    inputData: any[];
  }>;
  onFlowComplete?: (flowId: string, result: any) => void;
  onError?: (flowId: string, error: string) => void;
}

/**
 * 단일 Flow를 실행합니다.
 * 백엔드 호출 대신 클라이언트에서 처리하며, 내부적으로 executionUtils의 runFullFlowExecution을 사용합니다.
 */
export const executeFlow = async (params: ExecuteFlowParams): Promise<ExecutionResponse> => {
  try {
    console.log('[flowExecutionService] Starting local flow execution');
    
    // 루트 노드 실행 (입력 데이터와 함께)
    await runFullFlowExecution(undefined, params.inputs);
    
    // 리프 노드의 결과 수집
    const outputs = getAllOutputs();
    
    return {
      executionId: `local-exec-${Date.now()}`,
      outputs,
      status: 'success'
    };
  } catch (error) {
    console.error('Error executing flow:', error);
    return {
      executionId: '',
      outputs: null,
      status: 'error',
      error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
    };
  }
};

/**
 * Flow 체인을 순차적으로 실행합니다.
 * 각 Flow의 결과는 onFlowComplete 콜백을 통해 반환됩니다.
 * 
 * @param params.flowItems - 실행할 Flow 항목 배열
 * @param params.onFlowComplete - 각 Flow 실행 완료 시 호출될 콜백 함수
 * @param params.onError - 오류 발생 시 호출될 콜백 함수
 */
export const executeChain = async (params: ExecuteChainParams): Promise<void> => {
  const { flowItems, onFlowComplete, onError } = params;
  
  console.log(`[flowExecutionService] Starting chain execution with ${flowItems.length} flows`);
  
  let previousResults: Record<string, any> = {};
  
  for (let i = 0; i < flowItems.length; i++) {
    const { id, flowJson, inputData } = flowItems[i];
    
    try {
      console.log(`[flowExecutionService] Executing flow ${i + 1}/${flowItems.length}: ${id}`);
      
      // 입력에 이전 Flow 결과 변수 처리
      const processedInputs = inputData.map(input => {
        if (typeof input === 'string') {
          // result-flow-X 형태의 참조 변수 처리
          const resultRefPattern = /\$\{result-flow-([^}]+)\}/g;
          
          return input.replace(resultRefPattern, (match, flowId) => {
            const result = previousResults[flowId];
            if (result === undefined) {
              console.warn(`[flowExecutionService] Reference to unknown flow result: ${match}`);
              return match; // 알 수 없는 참조는 그대로 유지
            }
            return typeof result === 'string' ? result : JSON.stringify(result);
          });
        }
        return input;
      });
      
      // 현재 Flow 실행
      const response = await executeFlow({
        flowJson,
        inputs: processedInputs
      });
      
      if (response.status === 'error') {
        console.error(`[flowExecutionService] Flow ${id} execution failed:`, response.error);
        if (onError) {
          onError(id, response.error || '알 수 없는 오류가 발생했습니다.');
        }
        
        // 체인 실행 중단
        return;
      }
      
      // 결과 저장 및 콜백 호출
      previousResults[id] = response.outputs;
      
      if (onFlowComplete) {
        onFlowComplete(id, response.outputs);
      }
    } catch (error) {
      console.error(`[flowExecutionService] Error in chain execution at flow ${id}:`, error);
      if (onError) {
        onError(id, error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
      }
      
      // 체인 실행 중단
      return;
    }
  }
  
  console.log('[flowExecutionService] Chain execution completed successfully');
};

/**
 * 실행 결과를 가져옵니다. 
 * 현재는 로컬 실행만 지원하므로 호출되지 않지만, 인터페이스 호환성을 위해 유지합니다.
 */
export const getExecutionResult = async (executionId: string): Promise<ExecutionResponse> => {
  try {
    // 로컬 실행은 즉시 결과를 반환하므로 이 함수는 현재 사용되지 않습니다.
    // 백엔드 연동 시를 위해 인터페이스만 유지
    return {
      executionId,
      outputs: null,
      status: 'error',
      error: '백엔드 실행 결과 조회는 지원되지 않습니다. 로컬 실행만 가능합니다.'
    };
  } catch (error) {
    console.error('Error getting execution result:', error);
    return {
      executionId,
      outputs: null,
      status: 'error',
      error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
    };
  }
}; 