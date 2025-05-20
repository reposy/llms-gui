import { FlowData } from '../utils/data/importExportUtils';
import { FlowExecutionContext } from '../core/FlowExecutionContext';
import { Node as BaseNode } from '../core/Node';
import { v4 as uuidv4 } from 'uuid';
import { deepClone } from '../utils/helpers';
import { useExecutorStateStore, FlowChain, Flow, ExecutionStatus } from '../store/useExecutorStateStore';

// 출력 결과 타입 정의
export interface NodeResult {
  nodeId: string;
  outputs: any[];
}

// 코드 흐름 개선: 실행을 위한 공통 인터페이스 정의
export interface ExecuteFlowParams {
  flowJson: FlowData;
  inputs: any[];
  flowId: string;
  chainId?: string;
  onComplete?: (outputs: any) => void;
  onNodeStateChange?: (nodeId: string, status: string, result?: any, error?: string) => void;
}

export interface ExecutionResponse {
  executionId: string;
  outputs: any;
  status: 'success' | 'error';
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
 * 플로우 실행기 클래스 - 단일 플로우 실행을 담당
 */
class FlowExecutor {
  /**
   * 플로우 실행
   * @param params 실행 매개변수
   * @returns 실행 응답
   */
  async execute(params: ExecuteFlowParams): Promise<ExecutionResponse> {
    const { flowJson, inputs, flowId, chainId } = params;
    const executionId = `exec-${uuidv4()}`;
    
    try {
      console.log(`[FlowExecutor] Executing flow: ${flowId}${chainId ? ` (chain: ${chainId})` : ''}`);
      
      // 루트 노드 찾기
      const rootNodes = this.findRootNodes(flowJson);
      
      if (rootNodes.length === 0) {
        throw new Error("No root nodes found in flow");
      }
      
      // 실행 컨텍스트 생성
      const context = this.createExecutionContext(executionId, flowJson, chainId, flowId);
      
      // 입력 설정
      context.setInputs(inputs);
      
      // 루트 노드부터 실행
      await this.executeRootNodes(rootNodes, inputs, context);
      
      // 결과 수집 및 반환
      const outputs = getAllOutputs(context);
      
      // 콜백 알림
      if (params.onComplete) {
        params.onComplete(outputs);
      }
      
      // 등록된 콜백에 알림
      notifyResultCallbacks(flowId, outputs);
      
      return {
        executionId,
        outputs,
        status: 'success'
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[FlowExecutor] Error executing flow ${flowId}:`, errorMessage);
      
      return {
        executionId,
        outputs: null,
        status: 'error',
        error: errorMessage
      };
    }
  }
  
  /**
   * 루트 노드 찾기
   * @param flowJson 플로우 데이터
   * @returns 루트 노드 배열
   */
  private findRootNodes(flowJson: FlowData): FlowData['nodes'] {
    return flowJson.nodes.filter(node => {
      // 들어오는 엣지가 없는 노드를 루트 노드로 간주
      return !flowJson.edges.some(edge => edge.target === node.id);
    });
  }
  
  /**
   * 실행 컨텍스트 생성
   * @param executionId 실행 ID
   * @param flowJson 플로우 데이터
   * @param chainId 체인 ID
   * @param flowId 플로우 ID
   * @returns 실행 컨텍스트
   */
  protected createExecutionContext(
    executionId: string, 
    flowJson: FlowData, 
    chainId?: string,
    flowId?: string
  ): FlowExecutionContext {
    if (!chainId || !flowId) {
      throw new Error('chainId and flowId are required for ExecutorFlowExecutor context');
    }
    // 기본 구현은 에디터용 컨텍스트 생성
    return FlowExecutionContext.createForEditor(executionId, flowJson);
  }
  
  /**
   * 루트 노드 실행
   * @param rootNodes 루트 노드 배열
   * @param inputs 입력 데이터
   * @param context 실행 컨텍스트
   */
  private async executeRootNodes(rootNodes: FlowData['nodes'], inputs: any[], context: FlowExecutionContext): Promise<void> {
    // 모든 루트 노드에 대해 병렬 실행
    const promises = rootNodes.map(async (rootNode) => {
      const node = context.createNodeInstance(rootNode.id, rootNode.type || '', rootNode.data);
      if (node) {
        await executeNode(node, inputs, context);
      }
    });
    
    await Promise.all(promises);
  }
}

/**
 * 실행기용 플로우 실행기 클래스
 */
class ExecutorFlowExecutor extends FlowExecutor {
  /**
   * 실행 컨텍스트 생성 (오버라이드)
   * @param executionId 실행 ID
   * @param flowJson 플로우 데이터
   * @param chainId 체인 ID
   * @param flowId 플로우 ID
   * @returns 실행 컨텍스트
   */
  protected createExecutionContext(
    executionId: string, 
    flowJson: FlowData, 
    chainId?: string,
    flowId?: string
  ): FlowExecutionContext {
    if (!chainId || !flowId) {
      throw new Error('chainId and flowId are required for ExecutorFlowExecutor context');
    }
    // 실행기용 컨텍스트 생성
    return FlowExecutionContext.createForExecutor(
      executionId, 
      flowJson, 
      undefined, // nodeFactory는 context 내부에서 기본값으로 생성됨
      chainId, 
      flowId
    );
  }
}

// 실행기 인스턴스 생성
const editorFlowExecutor = new FlowExecutor();
const executorFlowExecutor = new ExecutorFlowExecutor();

// 실행 결과 콜백 관리
const resultCallbacks: Record<string, ((result: any) => void)[]> = {};

/**
 * 결과 콜백 등록 함수
 * @param flowId 플로우 ID
 * @param callback 콜백 함수
 * @returns 콜백 제거 함수
 */
export const registerResultCallback = (flowId: string, callback: (result: any) => void): () => void => {
  if (!resultCallbacks[flowId]) {
    resultCallbacks[flowId] = [];
  }
  
  resultCallbacks[flowId].push(callback);
  
  // 콜백 제거 함수 반환
  return () => {
    if (resultCallbacks[flowId]) {
      resultCallbacks[flowId] = resultCallbacks[flowId].filter(cb => cb !== callback);
    }
  };
};

/**
 * 등록된 콜백에 결과 알림
 * @param flowId 플로우 ID
 * @param result 실행 결과
 */
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

/**
 * 컨텍스트에서 모든 출력 수집
 * @param context 실행 컨텍스트
 * @returns 수집된 모든 출력
 */
export const getAllOutputs = (context: FlowExecutionContext): NodeResult[] => {
  const results: NodeResult[] = [];
  
  // 컨텍스트의 모든 노드에 대해 반복
  for (const node of context.nodes) {
    const nodeId = node.id;
    const nodeOutputs = context.getOutput(nodeId);
    
    if (nodeOutputs && nodeOutputs.length > 0) {
      results.push({
        nodeId,
        outputs: nodeOutputs
      });
    }
  }
  
  return results;
};

/**
 * 노드 및 자식 노드 실행 함수
 * 노드 실행 및 자식 노드 체인 처리를 담당
 * @param node 실행할 노드 인스턴스
 * @param input 입력 데이터
 * @param context 실행 컨텍스트
 * @returns 노드 실행 결과
 */
export const executeNode = async (
  node: BaseNode,
  input: any,
  context: FlowExecutionContext
): Promise<any> => {
  if (!node) {
    throw new Error("Invalid node instance");
  }

  const nodeId = node.id;
  try {
    console.log(`[flowExecutionService] Executing node: ${nodeId} (type: ${node.type})`);
    
    // 노드 실행 상태 설정
    context.markNodeRunning(nodeId);
    
    // 노드 실행
    const result = await node.process(input, context);
    
    // 성공 처리
    context.markNodeSuccess(nodeId, result);
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[flowExecutionService] Error executing node ${nodeId}:`, errorMessage);
    context.markNodeError(nodeId, errorMessage);
    throw error;
  }
};

/**
 * [Flow Editor용] 단일 Flow 실행
 * @param params 실행 매개변수
 * @returns 실행 응답
 */
export const executeFlow = async (params: ExecuteFlowParams): Promise<ExecutionResponse> => {
  return editorFlowExecutor.execute(params);
};

/**
 * Flow Executor를 위한 Flow 실행 함수
 * @param params 실행 매개변수
 * @returns 실행 응답
 */
export const executeFlowExecutor = async (params: ExecuteFlowParams): Promise<ExecutionResponse> => {
  if (!params.chainId || !params.flowId) {
    console.warn('[flowExecutionService.executeFlowExecutor] chainId or flowId is missing. Context might be for editor.');
    return editorFlowExecutor.execute(params);
  }
  return executorFlowExecutor.execute(params);
};

/**
 * 입력 참조 처리 함수
 * 입력값 중 참조 패턴(${flow.id.result})을 찾아 실제 값으로 대체
 * @param inputs 입력 배열
 * @param previousResults 이전 Flow 결과
 * @returns 처리된 입력 배열
 */
export const processInputReferences = (inputs: any[], previousResults: Record<string, any>): any[] => {
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
  
  // 입력 배열의 각 아이템에 대해 처리
  return deepClone(inputs).map((input: any) => {
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

/**
 * Flow Chain 실행 (useExecutorStateStore 사용)
 * 현재는 비어있는 구현입니다. 체인 실행 기능이 필요할 때 구현할 것입니다.
 * @param params 실행 매개변수
 */
export const executeChain = async (params: ExecuteChainParams): Promise<void> => {
  const { flowChainId, onChainStart, onChainComplete, onFlowStart, onFlowComplete, onError } = params;
  const store = useExecutorStateStore.getState();

  onChainStart?.(flowChainId);
  store.setFlowChainStatus(flowChainId, 'running');

  const chain = store.getFlowChain(flowChainId);
  if (!chain) {
    const errorMsg = `FlowChain not found: ${flowChainId}`;
    store.setFlowChainStatus(flowChainId, 'error', errorMsg);
    onError?.(flowChainId, '', errorMsg);
    onChainComplete?.(flowChainId, []);
    return;
  }

  const chainResults: any[] = []; // 체인의 최종 결과 (selectedFlowId의 결과만 담을 수도 있음)
  let chainOverallStatus: ExecutionStatus = 'success';

  for (const flowId of chain.flowIds) {
    const flow = store.getFlow(flowChainId, flowId);
    if (!flow) {
      const errorMsg = `Flow not found: ${flowId} in chain: ${flowChainId}`;
      store.setFlowStatus(flowChainId, flowId, 'error', errorMsg);
      onError?.(flowChainId, flowId, errorMsg);
      chainOverallStatus = 'error';
      break; // 현재 플로우를 찾지 못하면 체인 실행 중단
    }

    onFlowStart?.(flowChainId, flowId);
    store.setFlowStatus(flowChainId, flowId, 'running');

    // 이전 플로우의 결과를 현재 플로우의 입력으로 매핑 (간단한 예시)
    // 실제로는 사용자가 UI에서 매핑을 설정할 수 있어야 함.
    // 여기서는 마지막 실행된 플로우의 lastResults를 사용하도록 가정.
    let currentFlowInputs = [...flow.inputs]; // 사용자가 설정한 기본 입력
    if (chain.flowIds.indexOf(flowId) > 0) {
      const previousFlowId = chain.flowIds[chain.flowIds.indexOf(flowId) - 1];
      const previousFlow = store.getFlow(flowChainId, previousFlowId);
      if (previousFlow?.lastResults) {
        // TODO: 정교한 입력 매핑 로직 필요. 현재는 이전 결과를 그대로 사용.
        // 예를 들어, previousFlow.lastResults가 배열이고, currentFlowInputs도 배열 형식의 입력을 여러 개 받을 수 있다면,
        // 어떻게 매핑할지 정책이 필요합니다. (예: 첫번째 결과만 사용, 특정 이름의 결과 사용 등)
        // 지금은 단순화를 위해 이전 lastResults 전체를 현재 inputs의 첫번째 항목으로 덮어쓰거나 추가하는 방식을 고려할 수 있습니다.
        // 여기서는 previousFlow.lastResults를 currentFlowInputs으로 사용한다고 가정.
        currentFlowInputs = previousFlow.lastResults;
        store.setFlowInputs(flowChainId, flowId, currentFlowInputs); // 매핑된 입력을 스토어에 반영
      }
    }

    try {
      const flowExecutionResult = await executeFlowExecutor({
        flowJson: flow.flowJson,
        inputs: currentFlowInputs, 
        flowId: flow.id,
        chainId: flowChainId, // chainId 전달
        onComplete: (outputs) => {
          store.setFlowResults(flowChainId, flowId, outputs);
          chainResults.push({ flowId, outputs }); // 개별 플로우 결과 저장 (필요시)
        },
      });

      if (flowExecutionResult.status === 'success') {
        store.setFlowStatus(flowChainId, flowId, 'success');
        onFlowComplete?.(flowChainId, flowId, flowExecutionResult.outputs);
        // 체인의 selectedFlowId에 해당하는 결과만 최종 결과로 사용할 경우 여기서 처리
        if (flowId === chain.selectedFlowId) {
          // chainResults = flowExecutionResult.outputs; // 이런 식으로 덮어쓰거나 할 수 있음
        }
      } else {
        store.setFlowStatus(flowChainId, flowId, 'error', flowExecutionResult.error);
        onError?.(flowChainId, flowId, flowExecutionResult.error || 'Unknown error in flow');
        chainOverallStatus = 'error';
        break; // 플로우 실행 실패 시 체인 실행 중단
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      store.setFlowStatus(flowChainId, flowId, 'error', errorMsg);
      onError?.(flowChainId, flowId, errorMsg);
      chainOverallStatus = 'error';
      break; // 예외 발생 시 체인 실행 중단
    }
  }

  // 체인 실행 완료 후 최종 상태 설정
  store.setFlowChainStatus(flowChainId, chainOverallStatus, chainOverallStatus === 'error' ? 'Chain failed' : undefined);
  
  // 체인의 최종 결과는 selectedFlowId에 해당하는 Flow의 lastResults로 결정
  const finalChainResultFlow = chain.selectedFlowId ? store.getFlow(flowChainId, chain.selectedFlowId) : null;
  const finalOutputs = finalChainResultFlow?.lastResults || [];
  
  onChainComplete?.(flowChainId, finalOutputs);
  console.log(`[flowExecutionService] executeChain 완료: ${flowChainId}, 최종 결과:`, finalOutputs);
}; 