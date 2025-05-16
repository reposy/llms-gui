import { FlowData } from '../utils/data/importExportUtils';
import { getAllOutputs, NodeResult } from '../core/outputCollector';
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
  flowChainId: string;
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
  flowChainId: string;
  onChainStart?: (flowChainId: string) => void;
  onChainComplete?: (flowChainId: string, results: any[]) => void;
  onFlowStart?: (flowChainId: string, flowId: string) => void;
  onFlowComplete?: (flowChainId: string, flowId: string, results: any[]) => void;
  onError?: (flowChainId: string, flowId: string, error: Error | string) => void;
}

/**
 * 체인이 존재하는지 확인하고, 필요하면 생성하는 헬퍼 함수
 */
const ensureChainExists = (chainId: string, name?: string): string => {
  const executorStore = useExecutorStateStore.getState();
  
  // 스토어에서 체인 확인
  let chain = executorStore.getFlowChain(chainId);
  if (!chain) {
    console.log(`[flowExecutionService] Chain ${chainId} not found in store`);
    
    // 새 체인 생성
    console.log(`[flowExecutionService] Creating new chain`);
    const chainName = name || `Chain ${chainId.substring(0, 8)}`;
    executorStore.addFlowChain(chainName);
    
    // 체인 다시 확인
    chain = executorStore.getFlowChain(chainId);
    if (!chain) {
      console.error(`[flowExecutionService] Failed to create chain ${chainId}`);
      // 여기서는 오류를 던지지 않고 chainId만 반환
    }
  }
  
  return chainId;
};

/**
 * 노드 체이닝 방식으로 실행하는 함수
 * 단일 노드와 그 자식 노드들을 재귀적으로 실행합니다.
 */
const executeNode = async (
  nodeInstance: BaseNode,
  input: any,
  context: FlowExecutionContext,
  chainId: string,
  flowId: string,
  storeState = useExecutorStateStore.getState()
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
    const flow = storeState.getFlow(chainId, flowId);
    if (!flow) {
      console.error(`[flowExecutionService] Flow not found for chain ${chainId}, flow: ${flowId}`);
      return result;
    }
    
    const nodeRelation = flow.graph[nodeId];
    if (!nodeRelation) {
      console.error(`[flowExecutionService] Node relation not found for ${nodeId}`);
      return result;
    }
    
    // 그룹 노드는 자체적으로 내부 노드 실행을 처리하므로 자식 노드를 직접 실행하지 않음
    const node = flow.nodes[nodeId];
    if (node && node.isGroupNode) {
      console.log(`[flowExecutionService] Group node ${nodeId} executed, result:`, result);
      return result;
    }
    
    // 자식 노드들 실행
    const childrenIds = nodeRelation.childs || [];
    for (const childId of childrenIds) {
      const childInstance = flow.nodeInstances[childId];
      if (childInstance) {
        await executeNode(childInstance, result, context, chainId, flowId, storeState);
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
  const tempChainId = `temp-chain-${uuidv4()}`; // 임시 체인 ID 생성
  
  try {
    console.log('[FlowEditor] Starting flow execution for flow:', params.flowId);
    
    // 상태 스토어 가져오기
    const storeState = useExecutorStateStore.getState();
    
    // 임시 체인 생성
    storeState.addFlowChain("Temporary Chain");
    
    // 실행을 위한 데이터는 항상 깊은 복사를 통해 분리
    const flowJsonClone = deepClone(params.flowJson);
    
    // Flow 추가
    const flowId = storeState.addFlowToChain(tempChainId, flowJsonClone);
    
    // Flow에서 루트 노드 가져오기
    const roots = storeState.getRootNodes(tempChainId, flowId);
    
    if (roots.length === 0) {
      console.warn('[FlowEditor] No root nodes found for flow:', flowId);
      throw new Error('실행할 루트 노드가 없습니다. 유효한 Flow 구조인지 확인하세요.');
    }
    
    console.log(`[FlowEditor] Found ${roots.length} root nodes:`, roots);
    
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
      storeState.flowExecutorStore.nodeFactory
    );
    
    // 루트 노드들 순차 실행
    const flow = storeState.getFlow(tempChainId, flowId);
    if (!flow) {
      throw new Error(`Flow not found for tempChain: ${tempChainId}, flow: ${flowId}`);
    }
    
    for (const rootId of roots) {
      const rootNodeInstance = flow.nodeInstances[rootId];
      if (rootNodeInstance) {
        await executeNode(rootNodeInstance, params.inputs, context, tempChainId, flowId, storeState);
      }
    }
    
    // 결과 수집
    const outputs = getAllOutputs();
    console.log('[FlowEditor] Collected outputs:', outputs);
    
    // 결과 저장
    storeState.setFlowResults(tempChainId, flowId, outputs);
    
    // 임시 체인 제거 (실행 후 정리)
    storeState.removeFlowChain(tempChainId);
    
    // 결과 반환
    return {
      executionId,
      outputs,
      status: 'success'
    };
  } catch (error) {
    console.error('[FlowEditor] Error executing flow:', error);
    
    // 에러 발생 시 임시 체인 제거
    const storeState = useExecutorStateStore.getState();
    storeState.removeFlowChain(tempChainId);
    
    return {
      executionId,
      outputs: null,
      status: 'error',
      error: error instanceof Error ? error.message : String(error)
    };
  }
};

/**
 * [Flow Executor용] 단일 Flow를 실행합니다.
 * Flow Executor는 체인 및 Flow ID를 활용하여 기존 Flow를 실행합니다.
 */
export const executeFlowExecutor = async (params: ExecuteFlowParams): Promise<ExecutionResponse> => {
  const executionId = `exec-${uuidv4()}`;
  const flowChainId = params.flowChainId;
  const flowId = params.flowId;
  
  try {
    console.log(`[FlowExecutor] Starting flow execution for flow: ${flowId}, chain: ${flowChainId}`);
    
    // Flow 데이터 준비
    const flowJson = params.flowJson;
    console.log(`[FlowExecutor] Flow JSON 구조: nodes=${flowJson.nodes?.length || 0}, edges=${flowJson.edges?.length || 0}`);
    
    // 체인 존재 확인 (생성하지 않음)
    // 스토어 상태 가져오기
    const storeState = useExecutorStateStore.getState();
    
    // 체인 확인
    const chain = storeState.getFlowChain(flowChainId);
    if (!chain) {
      throw new Error(`체인 ${flowChainId}을(를) 찾을 수 없습니다. 실행 전 유효한 체인 ID가 필요합니다.`);
    }
    
    // Flow 확인
    let flow = storeState.getFlow(flowChainId, flowId);
    if (!flow) {
      console.warn(`[FlowExecutor] Flow ${flowId} not found in chain ${flowChainId}, adding it`);
      
      // Flow 추가
      storeState.addFlowToChain(flowChainId, flowJson);
      flow = storeState.getFlow(flowChainId, flowId);
      
      if (!flow) {
        throw new Error(`Flow ${flowId}을(를) 찾을 수 없으며 생성할 수 없습니다.`);
      }
    }
    
    // 루트 노드 가져오기
    const rootNodes = storeState.getRootNodes(flowChainId, flowId);
    
    if (rootNodes.length === 0) {
      console.warn(`[FlowExecutor] No root nodes found for flow ${flowId}`);
      throw new Error('실행할 루트 노드가 없습니다.');
    }
    
    console.log(`[FlowExecutor] Found ${rootNodes.length} root nodes in flow ${flowId}:`, rootNodes);
    
    // Flow 실행 상태 변경
    storeState.setFlowStatus(flowChainId, flowId, 'running');
    
    // 실행 컨텍스트 생성
    const context = new FlowExecutionContext(
      executionId,
      (nodeId) => {
        // 실행 중인 Flow의 contents 가져오기
        const nodeState = getNodeState(nodeId);
        return nodeState || {};
      },
      flowJson.nodes || [],
      flowJson.edges || [],
      storeState.flowExecutorStore.nodeFactory
    );
    
    // 루트 노드들 순차 실행
    for (const rootId of rootNodes) {
      const rootNodeInstance = storeState.getNodeInstance(flowChainId, flowId, rootId);
      if (rootNodeInstance) {
        await executeNode(rootNodeInstance, params.inputs, context, flowChainId, flowId, storeState);
      } else {
        console.warn(`[FlowExecutor] Root node instance ${rootId} not found in flow ${flowId}`);
      }
    }
    
    // 결과 수집
    const outputs = getAllOutputs();
    console.log(`[FlowExecutor] Flow ${flowId} execution completed, output size:`, outputs.length);
    
    // 결과 저장
    storeState.setFlowResults(flowChainId, flowId, outputs);
    storeState.setFlowStatus(flowChainId, flowId, 'success');
    
    // 콜백 호출
    if (params.onComplete) {
      params.onComplete({ outputs, status: 'success' });
    }
    
    // 결과 콜백 호출
    notifyResultCallbacks(flowId, outputs);
    
    return {
      executionId,
      outputs,
      status: 'success'
    };
  } catch (error) {
    console.error(`[FlowExecutor] Error executing flow:`, error);
    
    // 에러 상태 설정
    const storeState = useExecutorStateStore.getState();
    if (flowChainId && flowId) {
      storeState.setFlowStatus(flowChainId, flowId, 'error', error instanceof Error ? error.message : String(error));
    }
    
    // 콜백 호출
    if (params.onComplete) {
      params.onComplete({
        outputs: null,
        status: 'error',
        error: error instanceof Error ? error.message : String(error)
      });
    }
    
    return {
      executionId,
      outputs: null,
      status: 'error',
      error: error instanceof Error ? error.message : String(error)
    };
  }
};

/**
 * 입력값 내 참조 처리 함수
 * 입력값 중 ${result-flow-ID} 패턴을 찾아 해당 Flow의 결과로 대체합니다.
 */
export const processInputReferences = (inputs: any[], previousResults: Record<string, any>): any[] => {
  const processedInputs = deepClone(inputs);
  
  // 문자열 입력값에서 참조 패턴 찾기
  const processValue = (value: any): any => {
    if (typeof value !== 'string') return value;
    
    // ${result-flow-ID} 패턴 찾기
    const regex = /\${result-flow-([^}]+)}/g;
    let match;
    let processed = value;
    
    while ((match = regex.exec(value)) !== null) {
      const flowId = match[1];
      if (previousResults[flowId]) {
        // 결과가 존재하면 대체
        return previousResults[flowId];
      }
    }
    
    return processed;
  };
  
  // 모든 입력값에 대해 처리
  return processedInputs.map(input => {
    if (Array.isArray(input)) {
      return input.map(processValue);
    } else if (typeof input === 'object' && input !== null) {
      const result: Record<string, any> = {};
      for (const [key, val] of Object.entries(input)) {
        result[key] = processValue(val);
      }
      return result;
    }
    return processValue(input);
  });
};

/**
 * Flow Chain을 실행하는 함수
 * 체인 내의 Flow들을 순서대로 실행하고 결과를 다음 Flow에 전달합니다.
 */
export const executeChain = async (params: ExecuteChainParams): Promise<void> => {
  const { flowChainId, onChainStart, onChainComplete, onFlowStart, onFlowComplete, onError } = params;
  
  try {
    // 상태 스토어 가져오기
    const storeState = useExecutorStateStore.getState();
    
    // 체인 가져오기
    const chain = storeState.getFlowChain(flowChainId);
    if (!chain) {
      throw new Error(`Flow Chain not found: ${flowChainId}`);
    }
    
    // 실행 시작
    if (onChainStart) {
      onChainStart(flowChainId);
    }
    
    // 체인 상태 변경
    storeState.setFlowChainStatus(flowChainId, 'running');
    
    console.log(`[executeChain] Starting chain execution: ${flowChainId} (${chain.flowIds.length} flows)`);
    
    // 이전 Flow 결과 저장
    const flowResults: Record<string, any> = {};
    
    // 순서대로 Flow 실행
    for (let i = 0; i < chain.flowIds.length; i++) {
      const flowId = chain.flowIds[i];
      const flow = chain.flowMap[flowId];
      
      if (!flow) {
        console.warn(`[executeChain] Flow not found: ${flowId}, skipping`);
        continue;
      }
      
      console.log(`[executeChain] Executing flow ${i+1}/${chain.flowIds.length}: ${flowId} (${flow.name})`);
      
      // Flow 상태 변경
      storeState.setFlowStatus(flowChainId, flowId, 'running');
      
      // Flow 시작 알림
      if (onFlowStart) {
        onFlowStart(flowChainId, flowId);
      }
      
      try {
        // 입력 데이터 준비
        let inputs = flow.inputs || [];
        
        // 이전 Flow 결과를 입력으로 사용할 경우 대체
        if (i > 0 && inputs.some(input => typeof input === 'string' && input.includes('${result-flow-'))) {
          inputs = processInputReferences(inputs, flowResults);
        }
        
        // Flow 실행
        const result = await executeFlowExecutor({
          flowId,
          flowChainId,
          flowJson: flow.flowJson,
          inputs
        });
        
        // 결과 저장
        flowResults[flowId] = result.outputs;
        
        // Flow 완료 알림
        if (onFlowComplete) {
          onFlowComplete(flowChainId, flowId, result.outputs);
        }
      } catch (error) {
        // Flow 실행 오류
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // 상태 변경
        storeState.setFlowStatus(flowChainId, flowId, 'error', errorMessage);
        
        // 오류 알림
        if (onError) {
          onError(flowChainId, flowId, error instanceof Error ? error.message : String(error));
        }
        
        // 체인 실행 중단
        storeState.setFlowChainStatus(flowChainId, 'error');
        throw error;
      }
    }
    
    // 모든 Flow 실행 완료
    console.log(`[executeChain] Chain ${flowChainId} completed successfully`);
    
    // 체인 상태 변경
    storeState.setFlowChainStatus(flowChainId, 'success');
    
    // 체인 완료 알림 (선택된 Flow 결과 반환)
    if (onChainComplete) {
      // 선택된 Flow의 결과 또는 마지막 Flow 결과
      const selectedFlowId = chain.selectedFlowId || chain.flowIds[chain.flowIds.length - 1];
      const finalResults = flowResults[selectedFlowId] || [];
      onChainComplete(flowChainId, finalResults);
    }
  } catch (error) {
    // 체인 실행 오류
    console.error(`[executeChain] Error executing chain ${flowChainId}:`, error);
    
    // 상태 스토어에서 상태 변경
    const storeState = useExecutorStateStore.getState();
    storeState.setFlowChainStatus(flowChainId, 'error');
    
    // 오류 알림 (특정 Flow 지정 없음)
    if (onError) {
      onError(flowChainId, '', error instanceof Error ? error.message : String(error));
    }
    
    throw error;
  }
};

/**
 * 실행 결과 가져오기 (비동기 실행 완료 후)
 */
export const getExecutionResult = async (executionId: string): Promise<ExecutionResponse> => {
  // 현재는 실행 ID 기반 결과 조회를 구현하지 않았으므로, 
  // 간단히 오류 반환
  return {
    executionId,
    outputs: null,
    status: 'error',
    error: 'Result not found for execution ID: ' + executionId
  };
}; 