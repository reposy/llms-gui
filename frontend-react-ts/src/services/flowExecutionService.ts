import { FlowData } from '../utils/data/importExportUtils';
import { FlowExecutionContext } from '../core/FlowExecutionContext';
import { Node as BaseNode } from '../core/Node';
import { v4 as uuidv4 } from 'uuid';
import { deepClone } from '../utils/helpers';

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
  flowChainId?: string;
  onComplete?: (result: any) => void;
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
    const { flowJson, inputs, flowId, flowChainId } = params;
    const executionId = `exec-${uuidv4()}`;
    
    try {
      console.log(`[FlowExecutor] Executing flow: ${flowId}${flowChainId ? ` (chain: ${flowChainId})` : ''}`);
      
      // 루트 노드 찾기
      const rootNodes = this.findRootNodes(flowJson);
      
      if (rootNodes.length === 0) {
        throw new Error("No root nodes found in flow");
      }
      
      // 실행 컨텍스트 생성
      const context = this.createExecutionContext(executionId, flowJson);
      
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
   * @returns 실행 컨텍스트
   */
  protected createExecutionContext(executionId: string, flowJson: FlowData): FlowExecutionContext {
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
   * @returns 실행 컨텍스트
   */
  protected createExecutionContext(executionId: string, flowJson: FlowData): FlowExecutionContext {
    // 실행기용 컨텍스트 생성
    return FlowExecutionContext.createForExecutor(executionId, flowJson);
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
  console.log(`[flowExecutionService] executeChain 호출됨: ${params.flowChainId}`);
}; 