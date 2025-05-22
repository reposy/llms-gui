import { FlowData } from '../utils/data/importExportUtils';
import { FlowExecutionContext } from '../core/FlowExecutionContext';
import { Node as BaseNode } from '../core/Node';
import { v4 as uuidv4 } from 'uuid';
import { deepClone } from '../utils/helpers';
import { useExecutorStateStore, FlowChain, Flow, ExecutionStatus } from '../store/useExecutorStateStore';
import { useFlowExecutorStore } from '../store/useFlowExecutorStore';

// 출력 결과 타입 정의
export interface NodeResult {
  nodeId: string;
  nodeName?: string;
  nodeType?: string;
  outputs: any[];
  result?: any;
}

// 코드 흐름 개선: 실행을 위한 공통 인터페이스 정의
export interface ExecuteFlowParams {
  flowJson: FlowData;
  inputs: any[];
  flowId: string;
  flowChainId?: string;
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
  inputs?: any[];
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
    const { flowJson, inputs, flowId, flowChainId: chainId } = params;
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
  console.log('[getAllOutputs] 결과 수집 시작');
  const results: NodeResult[] = [];
  
  // 안전하게 노드와 엣지 접근
  if (!context.nodes || !Array.isArray(context.nodes)) {
    console.warn('[getAllOutputs] context.nodes가 없거나 배열이 아닙니다.');
    return [];
  }
  
  // 1. leaf 노드 id 목록 수집 (그룹에 속하지 않고 + 출력 엣지가 없는 노드)
  let leafNodeIds: string[] = [];
  
  try {
    if (context.edges && Array.isArray(context.edges)) {
      // 출력 엣지가 없는 노드 중에서 그룹 노드에 속하지 않은 노드만 leaf로 간주
      leafNodeIds = context.nodes
        .filter(node => {
          // 그룹에 속하지 않음 (parentId가 없음)
          const notInGroup = !node.parentId;
          // 출력 엣지가 없음 (source로 사용되지 않음)
          const hasNoOutputEdge = !context.edges.some(edge => edge.source === node.id);
          return notInGroup && hasNoOutputEdge;
        })
        .map(n => n.id);
    } else {
      // edges가 없으면 모든 노드 중 그룹에 속하지 않은 노드를 leaf로 간주
      leafNodeIds = context.nodes
        .filter(node => !node.parentId)
        .map(n => n.id);
    }
    
    console.log(`[getAllOutputs] ${leafNodeIds.length}개의 leaf 노드 발견`);
    
    // leaf 노드가 하나도 없으면 모든 노드 중 출력 엣지가 없는 노드를 leaf로 간주 
    // (그룹 노드 속성을 확인할 수 없는 경우를 위한 대비책)
    if (leafNodeIds.length === 0 && context.edges) {
      leafNodeIds = context.nodes
        .filter(node => !context.edges.some(edge => edge.source === node.id))
        .map(n => n.id);
      console.log(`[getAllOutputs] 그룹 속성 무시하고 ${leafNodeIds.length}개의 출력 엣지 없는 노드를 leaf로 간주`);
    }
  } catch (error) {
    console.error('[getAllOutputs] leaf 노드 식별 중 오류:', error);
    // 오류 발생 시 안전하게 모든 노드를 leaf로 간주
    leafNodeIds = context.nodes.map(n => n.id);
  }
  
  // 출력이 있는 모든 노드 ID 목록 (백업용)
  let nodesWithOutputs: string[] = [];
  
  // 모든 노드를 반복하면서 출력 있는 노드 ID 찾기 (failsafe)
  for (const node of context.nodes) {
    const outputs = context.getOutput(node.id);
    if (outputs && outputs.length > 0) {
      nodesWithOutputs.push(node.id);
    }
  }
  
  console.log(`[getAllOutputs] 총 ${nodesWithOutputs.length}개 노드에 출력 데이터 있음`);
  
  // 2. 각 leaf 노드의 결과 수집
  for (const nodeId of leafNodeIds) {
    try {
      const node = context.nodes.find(n => n.id === nodeId);
      const nodeOutputs = context.getOutput(nodeId);
      const nodeType = node?.type || '';
      // nodeName: string (label > type > id)
      let nodeName: string = nodeId;
      if (node?.data?.label && typeof node.data.label === 'string') {
        nodeName = node.data.label;
      } else if (nodeType) {
        nodeName = nodeType;
      }
      results.push({
        nodeId,
        nodeName,
        nodeType,
        outputs: nodeOutputs,
        result: nodeOutputs && nodeOutputs.length === 1 ? nodeOutputs[0] : nodeOutputs
      });
    } catch (error) {
      console.error(`[getAllOutputs] 노드 ${nodeId} 결과 처리 중 오류:`, error);
    }
  }
  
  // 3. Leaf 노드에서 결과를 찾지 못했고, 출력이 있는 다른 노드가 있다면 그 노드들의 결과 수집
  if (results.length === 0 && nodesWithOutputs.length > 0) {
    console.log(`[getAllOutputs] Leaf 노드에서 결과를 찾지 못함. 출력이 있는 ${nodesWithOutputs.length}개 노드에서 결과 수집 시도`);
    
    for (const nodeId of nodesWithOutputs) {
      try {
        const node = context.nodes.find(n => n.id === nodeId);
        const nodeOutputs = context.getOutput(nodeId);
        const nodeType = node?.type || '';
        let nodeName: string = nodeId;
        if (node?.data?.label && typeof node.data.label === 'string') {
          nodeName = node.data.label;
        } else if (nodeType) {
          nodeName = nodeType;
        }
        if (nodeOutputs && nodeOutputs.length > 0) {
          for (const output of nodeOutputs) {
            // 파일 객체인 경우 파일명/경로만 남김
            if (output && typeof output === 'object' && (output.name || output.path)) {
              results.push({
                nodeId,
                nodeName,
                nodeType,
                outputs: [output],
                result: output.name ? `${output.name}${output.path ? ` (${output.path})` : ''}` : JSON.stringify(output)
              });
            } else {
              results.push({
                nodeId,
                nodeName,
                nodeType,
                outputs: [output],
                result: output
              });
            }
          }
        }
      } catch (error) {
        console.error(`[getAllOutputs] 노드 ${nodeId} 결과 처리 중 오류:`, error);
      }
    }
  }
  
  console.log(`[getAllOutputs] 최종 결과 ${results.length}개 수집 완료`);
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
  if (!params.flowChainId || !params.flowId) {
    console.warn('[flowExecutionService.executeFlowExecutor] chainId or flowId is missing. Context might be for editor.');
    return editorFlowExecutor.execute(params);
  }
  
  // 응답 결과 받기
  const response = await executorFlowExecutor.execute(params);

  // leaf node 결과를 flow에 저장 (lastResults)
  if (response.status === 'success') {
    console.log(`[executeFlowExecutor] ${params.flowId} 실행 성공, 결과 항목 수: ${response.outputs?.length || 0}`);
    
    // outputs이 null/undefined인 경우 빈 배열로 처리
    const safeOutputs = response.outputs || [];
    
    // 결과 저장
    useFlowExecutorStore.getState().setFlowResult(params.flowChainId, params.flowId, safeOutputs);
    
    // 저장 후 결과 확인 (UI 디버깅용)
    const storedResults = useFlowExecutorStore.getState().flowChainMap[params.flowChainId]?.flowMap[params.flowId]?.lastResults;
    console.log(`[executeFlowExecutor] ${params.flowChainId}/${params.flowId} 저장된 lastResults:`, 
                storedResults ? `${storedResults.length}개 항목` : '없음');
  } else {
    console.warn(`[executeFlowExecutor] ${params.flowId} 실행 실패:`, response.error);
  }
  
  // onComplete 콜백이 제공된 경우, 결과를 올바른 형식으로 변환하여 전달
  if (params.onComplete && response.status === 'success') {
    params.onComplete(response.outputs);
    notifyResultCallbacks(params.flowId, {
      status: response.status,
      outputs: response.outputs,
      error: response.error,
      flowId: params.flowId
    });
  }
  
  return response;
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
  const { flowChainId, inputs: chainInputs, onChainStart, onChainComplete, onFlowStart, onFlowComplete, onError } = params;
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

    let currentFlowInputs = [...flow.inputs]; // 각 Flow에 저장된 기본 입력

    // 현재 Flow가 체인의 첫 번째 Flow이고, 체인 전체 입력(chainInputs)이 제공된 경우,
    // 해당 Flow의 입력을 체인 전체 입력으로 설정한다.
    if (chain.flowIds.indexOf(flowId) === 0 && chainInputs !== undefined) {
      currentFlowInputs = deepClone(chainInputs);
      // 스토어의 Flow 개별 입력도 업데이트 (선택적, UI 반영을 위함이라면 필요)
      store.setFlowInputs(flowChainId, flowId, currentFlowInputs); 
    } else if (chain.flowIds.indexOf(flowId) > 0) { 
      // 첫 번째 Flow가 아니고, 이전 Flow가 있는 경우 (기존 로직)
      const previousFlowId = chain.flowIds[chain.flowIds.indexOf(flowId) - 1];
      const previousFlow = store.getFlow(flowChainId, previousFlowId);
      if (previousFlow?.lastResults) {
        currentFlowInputs = deepClone(previousFlow.lastResults);
        store.setFlowInputs(flowChainId, flowId, currentFlowInputs);
      }
    }

    try {
      const flowExecutionResult = await executeFlowExecutor({
        flowJson: flow.flowJson,
        inputs: currentFlowInputs, 
        flowId: flow.id,
        flowChainId: flowChainId, // chainId 전달
        onComplete: (outputs) => {
          // 여기에서 정규화된 형식으로 결과 저장
          store.setFlowResults(flowChainId, flowId, outputs);
          // 로그로 결과 확인
          console.log(`[executeChain] Flow ${flowId} completed, outputs:`, outputs);
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