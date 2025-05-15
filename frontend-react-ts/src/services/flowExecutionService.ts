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

// FlowExecutionResult 타입을 여기서도 정의하거나, store에서 가져올 수 있도록 export 필요
// 여기서는 간단히 유사한 구조로 정의합니다.
interface FlowExecutionResultForService {
  status: 'success' | 'error';
  outputs: any[] | null;
  error?: string;
}

export interface ExecuteChainParams {
  chainId: string;
  onChainStart?: (chainId: string) => void;
  onChainComplete?: (chainId: string, results: any[]) => void;
  onFlowStart?: (chainId: string, flowId: string) => void;
  onFlowComplete?: (chainId: string, flowId: string, results: any[]) => void;
  onError?: (chainId: string, flowId: string, error: Error | string) => void;
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
    const activeChain = executorStore.getActiveChain();
    if (activeChain) {
      executorStore.setFlowResults(activeChain.id, params.flowId, outputs);  // chainId 추가
    }
    
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
 * ${result-flow-X}나 ${result-flow-flow-ID-NUM} 형태의 참조를 실제 값으로 대체합니다.
 */
export const processInputReferences = (inputs: any[], previousResults: Record<string, any>): any[] => {
  return inputs.map(input => {
    if (typeof input === 'string') {
      // Flow 결과 참조 패턴:
      // 1. 기본 패턴: ${result-flow-FLOWID}
      // 2. 확장 패턴: ${result-flow-flow-TIMESTAMP-NUMBER}
      const resultRefPattern = /\$\{result-flow-([^}]+)\}/g;
      
      return input.replace(resultRefPattern, (match, refParam) => {
        console.log(`[flowExecutionService] Processing reference: ${match}, refParam: ${refParam}`);
        
        // 참조 파라미터 처리
        let flowId = refParam;
        
        // "flow-TIMESTAMP-NUMBER" 형식인 경우, TIMESTAMP-NUMBER 부분이 ID가 됨
        if (refParam.startsWith('flow-')) {
          flowId = refParam; // 전체 refParam을 flowId로 사용
        }
        
        const result = previousResults[flowId];
        if (result === undefined) {
          // 모든 previousResults 키 출력 (디버깅용)
          console.warn(`[flowExecutionService] Reference to unknown flow result: ${match}`);
          console.log(`[flowExecutionService] Available results:`, Object.keys(previousResults));
          return match; // 알 수 없는 참조는 그대로 유지
        }
        
        console.log(`[flowExecutionService] Found result for ${flowId}:`, result);
        
        // 결과 데이터 타입에 따른 처리
        if (typeof result === 'string') {
          return result;
        } else if (Array.isArray(result)) {
          // 배열인 경우, 노드 결과 배열일 가능성이 높음
          if (result.length > 0) {
            // NodeResult[] 형식인지 확인 (nodeId, nodeName, nodeType, result 필드가 있는지)
            if (typeof result[0] === 'object' && result[0] !== null && 'result' in result[0]) {
              // 첫 번째 노드 결과의 result 필드 사용
              const nodeResult = result[0].result;
              return typeof nodeResult === 'string' ? 
                nodeResult : JSON.stringify(nodeResult);
            } else {
              // 일반 배열인 경우 첫 번째 요소 사용
              const firstResult = result[0];
              return typeof firstResult === 'string' ? 
                firstResult : JSON.stringify(firstResult);
            }
          }
          return ''; // 빈 배열
        } else if (typeof result === 'object' && result !== null) {
          // 객체인 경우 직렬화 (문자열로 변환)
          return JSON.stringify(result);
        } else {
          // 기타 타입 (number, boolean 등)
          return String(result);
        }
      });
    }
    return input;
  });
};

/**
 * Flow Chain을 실행합니다.
 */
export const executeChain = async (params: ExecuteChainParams): Promise<void> => {
  const executorStore = useExecutorStateStore.getState();
  const chain = executorStore.getChain(params.chainId);
  
  if (!chain) {
    throw new Error(`Chain not found: ${params.chainId}`);
  }

  console.log(`[FlowExecutor] Starting chain execution: ${params.chainId}`);
  
  // Chain 실행 시작
  if (params.onChainStart) {
    params.onChainStart(params.chainId);
  }
  executorStore.setChainStatus(params.chainId, 'running');

  try {
    // Chain 내의 각 Flow 순차 실행
    for (const flowId of chain.flowIds) {
      const flow = chain.flows[flowId];
      
      // Flow 실행 시작
      if (params.onFlowStart) {
        params.onFlowStart(params.chainId, flowId);
      }
      executorStore.setFlowStatus(params.chainId, flowId, 'running');

      try {
        console.log(`[FlowExecutor] Executing flow in chain: ${flowId}`);
        
        let inputs = [...(flow.inputs || [])];
        
        // 이전 Flow의 결과를 입력으로 사용해야 하는 경우
        if (inputs.length > 0 && typeof inputs[0] === 'string' && inputs[0].includes('${result-flow-')) {
          const prevFlowId = chain.flowIds[chain.flowIds.indexOf(flowId) - 1];
          if (prevFlowId) {
            const prevFlow = chain.flows[prevFlowId];
            const prevResults = prevFlow?.lastResults;
            
            if (prevResults) {
              if (Array.isArray(prevResults) && prevResults.length > 0) {
                if (typeof prevResults[0] === 'object' && prevResults[0] !== null && 'result' in prevResults[0]) {
                  inputs = [prevResults[0].result];
                } else {
                  inputs = [prevResults[0]];
                }
              } else if (!Array.isArray(prevResults)) {
                inputs = [prevResults];
              }
            }
          }
        }

        const result = await executeFlowExecutor({
          flowId,
          flowJson: flow.flowJson,
          inputs
        });

        if (result.status === 'success') {
          executorStore.setFlowStatus(params.chainId, flowId, 'success');
          executorStore.setFlowResults(params.chainId, flowId, result.outputs);
          
          if (params.onFlowComplete) {
            params.onFlowComplete(params.chainId, flowId, result.outputs);
          }
        } else {
          throw new Error(result.error || 'Unknown error');
        }
      } catch (error) {
        console.error(`[FlowExecutor] Error executing flow ${flowId}:`, error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        executorStore.setFlowStatus(params.chainId, flowId, 'error', errorMessage);
        if (params.onError) {
          params.onError(params.chainId, flowId, errorMessage);
        }
        
        // Chain 실행 중단
        executorStore.setChainStatus(params.chainId, 'error');
        return;
      }
    }

    // Chain 실행 완료
    executorStore.setChainStatus(params.chainId, 'success');
    
    // 선택된 Flow의 결과를 Chain의 결과로 사용
    if (chain.selectedFlowId && params.onChainComplete) {
      const selectedFlow = chain.flows[chain.selectedFlowId];
      if (selectedFlow) {
        params.onChainComplete(params.chainId, selectedFlow.lastResults || []);
      }
    }
  } catch (error) {
    console.error(`[FlowExecutor] Error executing chain ${params.chainId}:`, error);
    executorStore.setChainStatus(params.chainId, 'error');
    if (params.onError) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      params.onError(params.chainId, '', errorMessage);
    }
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