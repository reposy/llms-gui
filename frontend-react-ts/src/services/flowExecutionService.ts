import { runFullFlowExecution } from '../core/executionUtils';
import { importFlowFromJson, FlowData } from '../utils/data/importExportUtils';
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

/**
 * Flow Editor와 동일한 방식으로 플로우를 실행합니다.
 * 백엔드 호출 대신 클라이언트에서 처리하며, Flow Editor의 runFullFlowExecution을 재사용합니다.
 */
export const executeFlow = async (params: ExecuteFlowParams): Promise<ExecutionResponse> => {
  try {
    console.log('[flowExecutionService] Starting local flow execution');
    
    // 1. 플로우 JSON을 Flow Editor 상태에 적용
    // (이미 FileUploader에서 수행됨)
    
    // 2. 루트 노드 실행 (입력 데이터와 함께)
    await runFullFlowExecution(undefined, params.inputs);
    
    // 3. 리프 노드의 결과 수집
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