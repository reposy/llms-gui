import { FlowData } from '../utils/data/importExportUtils';
import { getAllOutputs } from '../core/outputCollector';
import { useExecutorGraphStore } from '../store/useExecutorGraphStore';
import { useExecutorStateStore } from '../store/useExecutorStateStore';
import { FlowExecutionContext } from '../core/FlowExecutionContext';
import { Node as BaseNode } from '../core/Node';
import { v4 as uuidv4 } from 'uuid';

// 결과 갱신 콜백 관리를 위한 객체
const resultCallbacks: Record<string, ((result: any) => void)[]> = {};

// 콜백 등록 함수
export const registerResultCallback = (flowId: string, callback: (result: any) => void): () => void => {
  if (!resultCallbacks[flowId]) {
    resultCallbacks[flowId] = [];
  }
  
  resultCallbacks[flowId].push(callback);
  
  // 클린업 함수 반환 (콜백 제거용)
  return () => {
    if (resultCallbacks[flowId]) {
      resultCallbacks[flowId] = resultCallbacks[flowId].filter(cb => cb !== callback);
    }
  };
};

// 콜백 호출 함수
const notifyResultCallbacks = (flowId: string, result: any) => {
  if (resultCallbacks[flowId]) {
    resultCallbacks[flowId].forEach(callback => {
      try {
        callback(result);
      } catch (error) {
        console.error(`Error executing result callback for flow ${flowId}:`, error);
      }
    });
  }
};

interface ExecuteFlowParams {
  flowJson: FlowData;
  inputs: any[];
  flowId: string;
  onComplete?: (result: any) => void;
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
 * 노드 체이닝 방식으로 실행하는 함수
 * 단일 노드와 그 자식 노드들을 재귀적으로 실행합니다.
 */
const executeNode = async (
  nodeInstance: BaseNode,
  input: any,
  context: FlowExecutionContext,
  flowId: string,
  graphStore = useExecutorGraphStore.getState()
): Promise<any> => {
  if (!nodeInstance) {
    console.error(`[flowExecutionService] Node instance is null or undefined`);
    return null;
  }

  const nodeId = nodeInstance.id;
  console.log(`[flowExecutionService] Executing node: ${nodeId} (type: ${nodeInstance.type})`);
  
  try {
    // 노드 실행 상태 변경
    context.markNodeRunning(nodeId);
    
    // 노드 실행
    const result = await nodeInstance.process(input, context);
    
    // 성공 처리
    context.markNodeSuccess(nodeId, result);
    context.storeOutput(nodeId, result);
    
    // 그래프에서 현재 노드의 자식 노드들 찾기
    const graph = graphStore.getFlowGraph(flowId);
    if (!graph) {
      console.error(`[flowExecutionService] Graph not found for flow: ${flowId}`);
      return result;
    }
    
    const graphNode = graph.nodes[nodeId];
    if (!graphNode) {
      console.error(`[flowExecutionService] Graph node not found: ${nodeId}`);
      return result;
    }
    
    // 그룹 노드는 자체적으로 내부 노드 실행을 처리하므로 자식 노드를 직접 실행하지 않음
    if (graphNode.isGroupNode) {
      console.log(`[flowExecutionService] Group node ${nodeId} executed, result:`, result);
      return result;
    }
    
    // 자식 노드들 실행
    const childrenIds = graphNode.children || [];
    for (const childId of childrenIds) {
      const childInstance = graph.nodeInstances[childId];
      if (childInstance) {
        await executeNode(childInstance, result, context, flowId, graphStore);
      }
    }
    
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[flowExecutionService] Error executing node ${nodeId}:`, errorMessage);
    context.markNodeError(nodeId, errorMessage);
    throw error;
  }
};

/**
 * 단일 Flow를 실행합니다.
 * 그래프 스토어에서 루트 노드를 가져와 executeNode를 통해 실행합니다.
 */
export const executeFlow = async (params: ExecuteFlowParams): Promise<ExecutionResponse> => {
  const executionId = `exec-${uuidv4()}`;
  
  try {
    console.log('[flowExecutionService] Starting flow execution for flow:', params.flowId);
    
    // 그래프 스토어에서 Flow 정보 가져오기
    const graphStore = useExecutorGraphStore.getState();
    
    // 해당 Flow의 그래프 정보가 없으면 먼저 설정
    if (!graphStore.getFlowGraph(params.flowId)) {
      console.log('[flowExecutionService] Setting flow graph for:', params.flowId);
      graphStore.setFlowGraph(params.flowId, params.flowJson);
    }
    
    const graph = graphStore.getFlowGraph(params.flowId);
    if (!graph) {
      throw new Error(`Graph not found for flow: ${params.flowId}`);
    }
    
    // 루트 노드 ID 가져오기
    const rootNodeIds = graph.rootNodeIds;
    
    if (rootNodeIds.length === 0) {
      console.warn('[flowExecutionService] No root nodes found for flow:', params.flowId);
      throw new Error('실행할 루트 노드가 없습니다. 유효한 Flow 구조인지 확인하세요.');
    }
    
    console.log(`[flowExecutionService] Found ${rootNodeIds.length} root nodes:`, rootNodeIds);
    
    // 실행 컨텍스트 생성
    const context = new FlowExecutionContext(
      executionId,
      (nodeId, nodeType) => {
        // 노드 컨텐츠 가져오기 함수 (Flow Executor에서는 flowJson의 contents 사용)
        const flowJson = params.flowJson;
        if (flowJson.contents && flowJson.contents[nodeId]) {
          return flowJson.contents[nodeId];
        }
        return {};
      },
      params.flowJson.nodes || [],
      params.flowJson.edges || [],
      graphStore.nodeFactory
    );
    
    // 루트 노드들 순차 실행
    for (const rootNodeId of rootNodeIds) {
      const rootNodeInstance = graph.nodeInstances[rootNodeId];
      if (rootNodeInstance) {
        await executeNode(rootNodeInstance, params.inputs, context, params.flowId, graphStore);
      }
    }
    
    // 결과 수집
    const outputs = getAllOutputs();
    console.log('[flowExecutionService] Collected outputs:', outputs);
    
    // 결과 저장
    graphStore.setFlowResult(params.flowId, outputs);
    
    // 콜백 호출 (onComplete가 있는 경우)
    if (params.onComplete) {
      params.onComplete(outputs);
    }
    
    return {
      executionId,
      outputs,
      status: 'success'
    };
  } catch (error) {
    console.error('Error executing flow:', error);
    return {
      executionId,
      outputs: null,
      status: 'error',
      error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
    };
  }
};

/**
 * 참조 변수를 처리하는 함수
 * ${result-flow-X} 형태의 참조를 실제 값으로 대체합니다.
 */
const processInputReferences = (inputs: any[], previousResults: Record<string, any>): any[] => {
  return inputs.map(input => {
    if (typeof input === 'string') {
      // ${result-flow-X} 형태의 참조 변수 처리
      const resultRefPattern = /\$\{result-flow-([^}]+)\}/g;
      
      return input.replace(resultRefPattern, (match, flowId) => {
        const result = previousResults[flowId];
        if (result === undefined) {
          console.warn(`[flowExecutionService] Reference to unknown flow result: ${match}`);
          return match; // 알 수 없는 참조는 그대로 유지
        }
        
        // 결과 데이터 타입에 따른 처리
        if (typeof result === 'string') {
          return result;
        } else if (Array.isArray(result)) {
          // 배열인 경우 첫 번째 항목 사용 (또는 다른 정책 적용 가능)
          if (result.length > 0) {
            const firstResult = result[0];
            return typeof firstResult === 'string' ? 
              firstResult : JSON.stringify(firstResult);
          }
          return '[]'; // 빈 배열
        } else {
          return JSON.stringify(result);
        }
      });
    }
    return input;
  });
};

/**
 * Flow 체인을 순차적으로 실행합니다.
 * 각 Flow의 결과는 onFlowComplete 콜백을 통해 반환됩니다.
 */
export const executeChain = async (params: ExecuteChainParams): Promise<void> => {
  const { flowItems, onFlowComplete, onError } = params;
  
  console.log(`[flowExecutionService] Starting chain execution with ${flowItems.length} flows`);
  
  let previousResults: Record<string, any> = {};
  
  for (let i = 0; i < flowItems.length; i++) {
    const { id, flowJson, inputData } = flowItems[i];
    
    try {
      console.log(`[flowExecutionService] Executing flow ${i + 1}/${flowItems.length}: ${id}`);
      
      // 입력 데이터 처리 - 이전 Flow 결과 참조 변수 처리
      const processedInputs = processInputReferences(inputData, previousResults);
      
      // Flow 실행
      const response = await executeFlow({
        flowJson,
        inputs: processedInputs,
        flowId: id,
        onComplete: (result) => {
          // 결과 저장 후 콜백 호출
          previousResults[id] = result;
          
          // 등록된 모든 콜백 호출
          notifyResultCallbacks(id, result);
          
          // 특정 Flow 완료 콜백 호출
          if (onFlowComplete) {
            onFlowComplete(id, result);
          }
        }
      });
      
      if (response.status === 'error') {
        console.error(`[flowExecutionService] Flow ${id} execution failed:`, response.error);
        if (onError) {
          onError(id, response.error || '알 수 없는 오류가 발생했습니다.');
        }
        
        // 체인 실행 중단
        return;
      }
      
      // 결과가 아직 설정되지 않은 경우 설정
      if (!previousResults[id] && response.outputs) {
        previousResults[id] = response.outputs;
        
        // 등록된 모든 콜백 호출
        notifyResultCallbacks(id, response.outputs);
        
        if (onFlowComplete) {
          onFlowComplete(id, response.outputs);
        }
      }
      
      // 상태 저장소에 Flow 결과 저장
      useExecutorStateStore.getState().setFlowResult(id, previousResults[id]);
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