import { FlowData } from '../utils/data/importExportUtils';
import { getAllOutputs, NodeResult } from '../core/outputCollector';
import { useExecutorGraphStore } from '../store/useExecutorGraphStore';
import { useExecutorStateStore } from '../store/useExecutorStateStore';
import { FlowExecutionContext } from '../core/FlowExecutionContext';
import { Node as BaseNode } from '../core/Node';
import { v4 as uuidv4 } from 'uuid';
import { deepClone } from '../utils/helpers';
import { getNodeState } from '../store/useNodeStateStore';

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

// 공통 인터페이스 정의
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
 * [Flow Editor용] 단일 Flow를 실행합니다.
 * 그래프 스토어에서 루트 노드를 가져와 executeNode를 통해 실행합니다.
 */
export const executeFlowEditor = async (params: ExecuteFlowParams): Promise<ExecutionResponse> => {
  const executionId = `exec-${uuidv4()}`;
  
  try {
    console.log('[FlowEditor] Starting flow execution for flow:', params.flowId);
    
    // 그래프 스토어에서 Flow 정보 가져오기
    const graphStore = useExecutorGraphStore.getState();
    
    // 실행을 위한 데이터는 항상 깊은 복사를 통해 분리
    const flowJsonClone = deepClone(params.flowJson);
    
    // 해당 Flow의 그래프 정보가 없으면 먼저 설정
    if (!graphStore.getFlowGraph(params.flowId)) {
      console.log('[FlowEditor] Setting flow graph for:', params.flowId);
      graphStore.setFlowGraph(params.flowId, flowJsonClone);
    }
    
    const graph = graphStore.getFlowGraph(params.flowId);
    if (!graph) {
      throw new Error(`Graph not found for flow: ${params.flowId}`);
    }
    
    // 루트 노드 ID 가져오기
    const rootNodeIds = graph.rootNodeIds;
    
    if (rootNodeIds.length === 0) {
      console.warn('[FlowEditor] No root nodes found for flow:', params.flowId);
      throw new Error('실행할 루트 노드가 없습니다. 유효한 Flow 구조인지 확인하세요.');
    }
    
    console.log(`[FlowEditor] Found ${rootNodeIds.length} root nodes:`, rootNodeIds);
    
    // 실행 컨텍스트 생성
    const context = new FlowExecutionContext(
      executionId,
      (nodeId, nodeType) => {
        // 노드 컨텐츠 가져오기 함수 (Flow Editor에서는 flowJson의 contents 사용)
        if (flowJsonClone.contents && flowJsonClone.contents[nodeId]) {
          return flowJsonClone.contents[nodeId];
        }
        return {};
      },
      flowJsonClone.nodes || [],
      flowJsonClone.edges || [],
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
    console.log('[FlowEditor] Collected outputs:', outputs);
    
    // Flow Editor에서만 사용하는 결과 저장: graphStore만 업데이트
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
    console.error('[FlowEditor] Error executing flow:', error);
    return {
      executionId,
      outputs: null,
      status: 'error',
      error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
    };
  }
};

/**
 * [Flow Executor용] 단일 Flow를 실행합니다.
 * 그래프 스토어에서 루트 노드를 가져와 executeNode를 통해 실행하고, Executor 스토어에도 결과를 저장합니다.
 */
export const executeFlowExecutor = async (params: ExecuteFlowParams): Promise<ExecutionResponse> => {
  const executionId = `exec-${uuidv4()}`;
  
  try {
    console.log('[FlowExecutor] Starting flow execution for flow:', params.flowId);
    
    // 그래프 스토어와 실행기 스토어 가져오기
    const graphStore = useExecutorGraphStore.getState();
    const executorStore = useExecutorStateStore.getState();
    
    // 실행을 위한 데이터는 항상 깊은 복사를 통해 분리
    const flowJsonClone = deepClone(params.flowJson);
    
    // 해당 Flow의 그래프 정보가 없으면 먼저 설정
    if (!graphStore.getFlowGraph(params.flowId)) {
      console.log('[FlowExecutor] Setting flow graph for:', params.flowId);
      graphStore.setFlowGraph(params.flowId, flowJsonClone);
    }
    
    const graph = graphStore.getFlowGraph(params.flowId);
    if (!graph) {
      throw new Error(`Graph not found for flow: ${params.flowId}`);
    }
    
    // 루트 노드 ID 가져오기
    const rootNodeIds = graph.rootNodeIds;
    
    if (rootNodeIds.length === 0) {
      console.warn('[FlowExecutor] No root nodes found for flow:', params.flowId);
      throw new Error('실행할 루트 노드가 없습니다. 유효한 Flow 구조인지 확인하세요.');
    }
    
    console.log(`[FlowExecutor] Found ${rootNodeIds.length} root nodes:`, rootNodeIds);
    
    // 실행 컨텍스트 생성
    const context = new FlowExecutionContext(
      executionId,
      (nodeId, nodeType) => {
        // 노드 컨텐츠 가져오기 함수 (Flow Executor에서는 flowJson의 contents 사용)
        if (flowJsonClone.contents && flowJsonClone.contents[nodeId]) {
          return flowJsonClone.contents[nodeId];
        }
        return {};
      },
      flowJsonClone.nodes || [],
      flowJsonClone.edges || [],
      graphStore.nodeFactory
    );
    
    // 루트 노드들 순차 실행
    for (const rootNodeId of rootNodeIds) {
      const rootNodeInstance = graph.nodeInstances[rootNodeId];
      if (rootNodeInstance) {
        await executeNode(rootNodeInstance, params.inputs, context, params.flowId, graphStore);
      }
    }
    
    // 결과 수집 - 이제 outputCollector에서 올바르게 수집함
    const outputs = getAllOutputs();
    console.log('[FlowExecutor] Collected outputs:', outputs);
    
    // 결과 저장 (Flow Executor는 둘 다 업데이트)
    graphStore.setFlowResult(params.flowId, outputs);
    executorStore.setFlowResult(params.flowId, outputs);  // Executor 스토어에도 결과 저장
    
    // 콜백 호출 (onComplete가 있는 경우)
    if (params.onComplete) {
      params.onComplete(outputs);
    }
    
    // 등록된 모든 콜백에 결과 전달
    notifyResultCallbacks(params.flowId, outputs);
    
    return {
      executionId,
      outputs,
      status: 'success'
    };
  } catch (error) {
    console.error('[FlowExecutor] Error executing flow:', error);
    return {
      executionId,
      outputs: null,
      status: 'error',
      error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
    };
  }
};

/**
 * 원래 executeFlow 함수는 이제 더 이상 사용하지 않으므로, 호환성을 위해 Executor 함수로 리다이렉트합니다.
 * @deprecated Flow Editor와 Flow Executor용 함수를 구분하여 사용하세요.
 */
export const executeFlow = executeFlowExecutor;

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
 * [Flow Executor용] 여러 Flow를 연속해서 실행하는 체인 함수
 */
export const executeChain = async (params: ExecuteChainParams): Promise<void> => {
  // 이전 Flow 실행 결과를 저장하는 객체
  const previousResults: Record<string, any> = {};
  
  console.log(`[FlowExecutor] Starting chain execution with ${params.flowItems.length} flows`);
  
  // Executor 스토어
  const executorStore = useExecutorStateStore.getState();
  
  // 각 Flow 순차 실행
  for (const flowItem of params.flowItems) {
    try {
      console.log(`[FlowExecutor] Executing flow in chain: ${flowItem.id}`);
      
      // 입력 데이터에서 참조 처리
      const processedInputs = processInputReferences(flowItem.inputData, previousResults);
      
      // Flow 복제 후 실행
      const flowJsonClone = deepClone(flowItem.flowJson);
      
      // 단일 Flow 실행 (Executor 전용 함수 사용)
      const result = await executeFlowExecutor({
        flowId: flowItem.id,
        flowJson: flowJsonClone,
        inputs: processedInputs
      });
      
      if (result.status === 'success') {
        // 성공 결과 저장
        previousResults[flowItem.id] = result.outputs;
        
        // 성공 콜백 호출
        if (params.onFlowComplete) {
          params.onFlowComplete(flowItem.id, result.outputs);
        }
      } else {
        // 오류 콜백 호출
        if (params.onError) {
          params.onError(flowItem.id, result.error || '알 수 없는 오류');
        }
        
        // 체인 중단 여부 결정 (현재는 오류 발생 시 중단)
        console.error(`[FlowExecutor] Chain execution stopped due to error in flow: ${flowItem.id}`);
        break;
      }
    } catch (error) {
      console.error(`[FlowExecutor] Unexpected error in chain execution for flow ${flowItem.id}:`, error);
      
      // 오류 콜백 호출
      if (params.onError) {
        params.onError(flowItem.id, error instanceof Error ? error.message : '알 수 없는 오류');
      }
      
      // 체인 중단
      break;
    }
  }
  
  console.log('[FlowExecutor] Chain execution completed');
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