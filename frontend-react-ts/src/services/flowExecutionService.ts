import { FlowData } from '../utils/data/importExportUtils';
import { FlowExecutionContext } from '../core/FlowExecutionContext';
import { Node as BaseNode } from '../core/Node';
import { v4 as uuidv4 } from 'uuid';
import { deepClone } from '../utils/helpers';
import { ExecutionStatus } from '../store/useExecutorStateStore';
import { useFlowExecutorStore } from '../store/useFlowExecutorStore';
import { resolveFlowResultInputs } from '../utils/flowResultUtils';

// 출력 결과 타입 정의
export interface NodeResult {
  nodeId: string;
  nodeName?: string;
  nodeType?: string;
  outputs: any[];
  result?: any;
}

// 실행 모드 타입 정의
export type ExecutionMode = 'batch' | 'forEach';

// 코드 흐름 개선: 실행을 위한 공통 인터페이스 정의
export interface ExecuteFlowParams {
  flowJson: FlowData;
  inputs: any[];
  flowId: string;
  flowChainId?: string;
  onComplete?: (outputs: any) => void;
  onNodeStateChange?: (nodeId: string, status: string, result?: any, error?: string) => void;
  // ForEach 실행 모드 지원
  executionMode?: ExecutionMode; // 기본값: 'batch'
  commonInputs?: any[]; // forEach 모드에서 사용할 공통 입력
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
  /**
   * 실행 전략 주입 (순차/병렬/조건부/미들웨어 등)
   * 기본값: sequential
   */
  executionStrategy?: ChainExecutionStrategy;
  // 새로운 기능들
  stopAtFlowId?: string; // 특정 Flow에서 실행 중단
  maxIterations?: number; // 최대 반복 실행 횟수
  contextStorage?: any[]; // Context 저장소
}

/**
 * Flow Chain 실행 전략 타입
 */
export type ChainExecutionStrategy =
  | { type: 'sequential' } // 기본: 순차 실행
  | { type: 'parallel' }   // 병렬 실행 (모든 flow를 동시에 실행)
  | { type: 'conditional'; condition: (flowId: string, index: number, chain: any) => boolean } // 조건부 실행
  | { type: 'custom'; execute: (params: ExecuteChainParams, flows: any[], store: any) => Promise<void> } // 커스텀 전략
  // 미들웨어/후킹 등은 custom에서 래핑 가능

/**
 * 순차 실행 전략 (기존 for loop)
 */
async function executeChainSequential(params: ExecuteChainParams, store: any, flowChain: any) {
  const { flowChainId, onFlowStart, onFlowComplete, onError } = params;
  const chainResults: any[] = [];
  let chainOverallStatus: ExecutionStatus = 'success';

  for (const flowId of flowChain.flowIds) {
    const flow = store.getFlow(flowChainId, flowId);
    if (!flow) {
      const errorMsg = `Flow not found: ${flowId} in chain: ${flowChainId}`;
      store.setFlowStatus(flowChainId, flowId, 'error', errorMsg);
      onError?.(flowChainId, flowId, errorMsg);
      chainOverallStatus = 'error';
      break;
    }
    onFlowStart?.(flowChainId, flowId);
    store.setFlowStatus(flowChainId, flowId, 'running');
    
    // 실행 모드와 입력 데이터를 저장된 executionConfig에서 가져오기 (단일 진입점 원칙)
    const executionMode = flow.executionConfig?.mode || 'batch';
    const commonInputs = flow.executionConfig?.commonInputs || [];
    const forEachItems = flow.executionConfig?.forEachItems || [];
    
    let currentFlowInputs = flow.inputs;
    if ((!currentFlowInputs || currentFlowInputs.length === 0) && flowChain.flowIds.indexOf(flowId) > 0) {
      const previousFlowId = flowChain.flowIds[flowChain.flowIds.indexOf(flowId) - 1];
      const previousFlow = store.getFlow(flowChainId, previousFlowId);
      if (previousFlow?.lastResults) {
        currentFlowInputs = deepClone(previousFlow.lastResults);
        store.setFlowInputData(flowChainId, flowId, currentFlowInputs);
      }
    }
    
    try {
      // 단일 진입점: FlowDetailModal과 동일한 방식으로 실행
      const flowExecutionResult = await executeFlowExecutor({
        flowJson: flow.flowJson,
        inputs: executionMode === 'forEach' ? forEachItems : currentFlowInputs,
        flowId: flow.id,
        flowChainId: flowChainId,
        executionMode: executionMode,
        commonInputs: executionMode === 'forEach' ? commonInputs : undefined,
        onComplete: (outputs) => {
          store.setFlowResult(flowChainId, flowId, outputs);
          chainResults.push({ flowId, outputs });
        },
      });
      if (flowExecutionResult.status === 'success') {
        store.setFlowStatus(flowChainId, flowId, 'success');
        onFlowComplete?.(flowChainId, flowId, flowExecutionResult.outputs);
      } else {
        store.setFlowStatus(flowChainId, flowId, 'error', flowExecutionResult.error);
        onError?.(flowChainId, flowId, flowExecutionResult.error || 'Unknown error in flow');
        chainOverallStatus = 'error';
        break;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      store.setFlowStatus(flowChainId, flowId, 'error', errorMsg);
      onError?.(flowChainId, flowId, errorMsg);
      chainOverallStatus = 'error';
      break;
    }
  }
  return { chainResults, chainOverallStatus };
}

/**
 * 병렬 실행 전략 (모든 flow를 동시에 실행)
 * - 각 flow의 입력은 독립적으로 처리됨(이전 flow 결과를 입력으로 사용하지 않음)
 * - 확장: 필요시 의존성 그래프 기반 병렬화로 확장 가능
 */
async function executeChainParallel(params: ExecuteChainParams, store: any, flowChain: any) {
  const { flowChainId, onFlowStart, onFlowComplete, onError } = params;
  const chainResults: any[] = [];
  let chainOverallStatus: ExecutionStatus = 'success';
  const flowPromises = flowChain.flowIds.map(async (flowId: string) => {
    const flow = store.getFlow(flowChainId, flowId);
    if (!flow) {
      const errorMsg = `Flow not found: ${flowId} in chain: ${flowChainId}`;
      store.setFlowStatus(flowChainId, flowId, 'error', errorMsg);
      onError?.(flowChainId, flowId, errorMsg);
      chainOverallStatus = 'error';
      return;
    }
    onFlowStart?.(flowChainId, flowId);
    store.setFlowStatus(flowChainId, flowId, 'running');
    
    // 실행 모드와 입력 데이터를 저장된 executionConfig에서 가져오기 (단일 진입점 원칙)
    const executionMode = flow.executionConfig?.mode || 'batch';
    const commonInputs = flow.executionConfig?.commonInputs || [];
    const forEachItems = flow.executionConfig?.forEachItems || [];
    
    let currentFlowInputs = flow.inputs;
    try {
      // 단일 진입점: FlowDetailModal과 동일한 방식으로 실행
      const flowExecutionResult = await executeFlowExecutor({
        flowJson: flow.flowJson,
        inputs: executionMode === 'forEach' ? forEachItems : currentFlowInputs,
        flowId: flow.id,
        flowChainId: flowChainId,
        executionMode: executionMode,
        commonInputs: executionMode === 'forEach' ? commonInputs : undefined,
        onComplete: (outputs) => {
          store.setFlowResult(flowChainId, flowId, outputs);
          chainResults.push({ flowId, outputs });
        },
      });
      if (flowExecutionResult.status === 'success') {
        store.setFlowStatus(flowChainId, flowId, 'success');
        onFlowComplete?.(flowChainId, flowId, flowExecutionResult.outputs);
      } else {
        store.setFlowStatus(flowChainId, flowId, 'error', flowExecutionResult.error);
        onError?.(flowChainId, flowId, flowExecutionResult.error || 'Unknown error in flow');
        chainOverallStatus = 'error';
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      store.setFlowStatus(flowChainId, flowId, 'error', errorMsg);
      onError?.(flowChainId, flowId, errorMsg);
      chainOverallStatus = 'error';
    }
  });
  await Promise.all(flowPromises);
  return { chainResults, chainOverallStatus };
}

// 조건부/커스텀 전략은 필요시 확장 (예시 주석)
// async function executeChainConditional(...) { ... }
// async function executeChainCustom(...) { ... }

/**
 * Flow Chain 실행 (Strategy Pattern 적용)
 */
export const executeChain = async (params: ExecuteChainParams): Promise<void> => {
  const { flowChainId, onChainStart, onChainComplete, executionStrategy } = params;
  const store = useFlowExecutorStore.getState();
  onChainStart?.(flowChainId);
  store.setFlowChainStatus(flowChainId, 'running');
  const flowChain = store.getFlowChain(flowChainId);
  if (!flowChain) {
    const errorMsg = `FlowChain not found: ${flowChainId}`;
    store.setFlowChainStatus(flowChainId, 'error', errorMsg);
    params.onError?.(flowChainId, '', errorMsg);
    onChainComplete?.(flowChainId, []);
    return;
  }
  // 전략 분기
  let result;
  const strategy = executionStrategy?.type || 'sequential';
  if (strategy === 'parallel') {
    result = await executeChainParallel(params, store, flowChain);
  } else if (strategy === 'sequential') {
    result = await executeChainSequential(params, store, flowChain);
  } else if (strategy === 'conditional' && executionStrategy && 'condition' in executionStrategy) {
    // 조건부 실행 전략은 필요시 구현
    // result = await executeChainConditional(params, store, flowChain, executionStrategy.condition);
    throw new Error('Conditional strategy is not implemented yet.');
  } else if (strategy === 'custom' && executionStrategy && 'execute' in executionStrategy) {
    // 커스텀 전략 실행 (void 반환 가능)
    await executionStrategy.execute(params, flowChain.flowIds.map((id: string) => store.getFlow(flowChainId, id)), store);
    result = { chainResults: [], chainOverallStatus: 'success' as ExecutionStatus };
  } else {
    // 기본: 순차 실행
    result = await executeChainSequential(params, store, flowChain);
  }
  // 상태/결과 처리
  const chainStatus = result?.chainOverallStatus || 'success';
  store.setFlowChainStatus(flowChainId, chainStatus, chainStatus === 'error' ? 'Chain failed' : undefined);
  const finalChainResultFlow = flowChain.selectedFlowIds.length > 0 ? store.getFlow(flowChainId, flowChain.selectedFlowIds[0]) : null;
  const finalOutputs = finalChainResultFlow?.lastResults || [];
  onChainComplete?.(flowChainId, finalOutputs);
};

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
    const { flowJson, inputs, flowId, flowChainId: chainId, executionMode = 'batch', commonInputs = [] } = params;
    const executionId = `exec-${uuidv4()}`;
    
    try {
      console.log(`[FlowExecutor] Executing flow: ${flowId}${chainId ? ` (chain: ${chainId})` : ''}, mode: ${executionMode}`);
      
      // repeatCount 처리 (기본값: 1)
      let repeatCount = 1;
      if (chainId && flowId) {
        const store = useFlowExecutorStore.getState();
        const flow = store.getFlow(chainId, flowId);
        repeatCount = flow?.executionConfig?.repeatCount || 1;
      }
      
      console.log(`[FlowExecutor] Repeat count: ${repeatCount}`);
      
      // 반복 실행을 위한 전체 결과 배열
      const allRepeatResults: any[] = [];
      
      // repeatCount만큼 반복 실행
      for (let repeat = 0; repeat < repeatCount; repeat++) {
        console.log(`[FlowExecutor] Executing iteration ${repeat + 1}/${repeatCount}`);
        
        // 각 반복마다 새로운 실행 ID 생성
        const iterationExecutionId = `${executionId}-repeat-${repeat}`;
        
        // 단일 반복 실행
        const iterationResults = await this.executeSingleIteration({
          ...params,
          executionId: iterationExecutionId
        });
        
        // 결과를 flat하게 쌓기
        if (Array.isArray(iterationResults)) {
          allRepeatResults.push(...iterationResults);
        } else if (iterationResults) {
          allRepeatResults.push(iterationResults);
        }
      }
      
      console.log(`[FlowExecutor] All repeat iterations completed. Total results: ${allRepeatResults.length}`);
      
      // 콜백 알림
      if (params.onComplete) {
        params.onComplete(allRepeatResults);
      }
      
      // 등록된 콜백에 알림
      notifyResultCallbacks(flowId, allRepeatResults);
      
      return {
        executionId,
        outputs: allRepeatResults,
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
   * 단일 반복 실행 (기존 execute 로직)
   */
  private async executeSingleIteration(params: ExecuteFlowParams & { executionId: string }): Promise<any> {
    const { flowJson, inputs, flowId, flowChainId: chainId, executionMode = 'batch', commonInputs = [], executionId } = params;
    
    // 루트 노드 찾기
    const rootNodes = this.findRootNodes(flowJson);
    
    if (rootNodes.length === 0) {
      throw new Error("No root nodes found in flow");
    }

    if (executionMode === 'forEach') {
      // ForEach 모드: 각 input에 대해 순차적으로 플로우 실행
      console.log(`[FlowExecutor] ForEach mode: processing ${inputs.length} inputs sequentially`);
      const allResults: any[] = [];
      
      for (let i = 0; i < inputs.length; i++) {
        const currentInput = inputs[i];
        const combinedInputs = [...commonInputs, currentInput];
        
        console.log(`[FlowExecutor] Processing item ${i + 1}/${inputs.length}:`, { currentInput, combinedInputs });
        
        // 실행 컨텍스트 생성 (각 실행마다 새로운 컨텍스트)
        const context = this.createExecutionContext(`${executionId}-${i}`, flowJson, chainId, flowId);
        
        // 입력 설정
        context.setInputs(combinedInputs);
        
        // 루트 노드부터 실행 (중단 체크 포함)
        const shouldContinue = await this.executeRootNodes(rootNodes, combinedInputs, context);
        if (!shouldContinue) {
          console.log(`[FlowExecutor] Execution stopped at iteration ${i + 1}`);
          break;
        }
        
        // 결과 수집
        const outputs = getAllOutputs(context);
        
        // 결과를 flat하게 수집: [...result1, ...result2, ...result3]
        if (Array.isArray(outputs)) {
          allResults.push(...outputs);
        } else if (outputs) {
          allResults.push(outputs);
        }
      }
      
      console.log(`[FlowExecutor] ForEach mode completed. Total results: ${allResults.length}`);
      return allResults;
      
    } else {
      // Batch 모드: 기존 방식
      console.log(`[FlowExecutor] Batch mode: processing all inputs together`);
      
      // 실행 컨텍스트 생성
      const context = this.createExecutionContext(executionId, flowJson, chainId, flowId);
      
      // 입력 설정
      context.setInputs(inputs);
      
      // 루트 노드부터 실행 (중단 체크 포함)
      await this.executeRootNodes(rootNodes, inputs, context);
      
      // 결과 수집 및 반환
      const outputs = getAllOutputs(context);
      return outputs;
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
  private async executeRootNodes(rootNodes: FlowData['nodes'], inputs: any[], context: FlowExecutionContext): Promise<boolean> {
    // 모든 루트 노드에 대해 병렬 실행
    const promises = rootNodes.map(async (rootNode) => {
      const node = context.createNodeInstance(rootNode.id, rootNode.type || '', rootNode.data);
      if (node) {
        await executeNode(node, inputs, context);
      }
    });
    
    await Promise.all(promises);
    
    // 중단 체크
    const shouldContinue = !context.isStopRequested_();
    if (!shouldContinue) {
      console.log(`[FlowExecutor] Execution stopped by user request`);
    }
    return shouldContinue;
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
    
    // ✅ Flow Executor store에서 실제 노드 데이터를 미리 가져와서 flowJson.nodes를 업데이트
    try {
      const store = useFlowExecutorStore.getState();
      const nodeMap = store.flowChainMap?.[chainId]?.flowMap?.[flowId]?.nodeMap;
      
      if (nodeMap) {
        // flowJson.nodes의 data 필드를 store의 data로 업데이트
        const updatedNodes = flowJson.nodes.map(node => {
          const storeNode = nodeMap[node.id];
          if (storeNode && storeNode.data && typeof storeNode.data === 'object') {
            console.log(`[ExecutorFlowExecutor] Updated node ${node.id} data from store:`, {
              originalKeys: node.data ? Object.keys(node.data) : 'no data',
              storeKeys: Object.keys(storeNode.data),
              ...(node.id.includes('html-parser') && {
                originalExtractionRules: (node.data as any)?.extractionRules?.length || 0,
                storeExtractionRules: (storeNode.data as any)?.extractionRules?.length || 0
              })
            });
            
            return {
              ...node,
              data: storeNode.data  // ✅ store의 데이터로 교체
            };
          }
          return node;
        });
        
        // 업데이트된 flowJson 생성
        flowJson = {
          ...flowJson,
          nodes: updatedNodes
        };
      }
    } catch (error) {
      console.error('[ExecutorFlowExecutor] Error updating flowJson with store data:', error);
    }
    
    // 업데이트된 flowJson으로 실행기용 컨텍스트 생성
    return FlowExecutionContext.createForExecutor(
      executionId, 
      flowJson, 
      undefined,
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
  
  // 실행 전 중단 체크
  if (context.isStopRequested_()) {
    console.log(`[executeNode] Execution stopped before executing node: ${nodeId}`);
    throw new Error("Execution stopped by user request");
  }
  
  try {
    console.log(`[flowExecutionService] Executing node: ${nodeId} (type: ${node.type})`);
    
    // 노드 실행 상태 설정
    context.markNodeRunning(nodeId);
    
    // 노드 실행
    const result = await node.process(input, context);
    
    // 실행 후 중단 체크
    if (context.isStopRequested_()) {
      console.log(`[executeNode] Execution stopped after executing node: ${nodeId}`);
      context.markNodeError(nodeId, "Execution stopped by user request");
      throw new Error("Execution stopped by user request");
    }
    
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
 * [Flow Editor용] 단일 Flow 실행
 * @param params 실행 매개변수
 * @returns 실행 응답
 */
export const executeFlow = async (params: ExecuteFlowParams): Promise<ExecutionResponse> => {
  const store = useFlowExecutorStore.getState();
  const flowChainMap = store.flowChainMap;
  const normalizedInputs = resolveFlowResultInputs(params.inputs, flowChainMap);
  return editorFlowExecutor.execute({ ...params, inputs: normalizedInputs });
};

/**
 * Flow Executor를 위한 Flow 실행 함수
 * @param params 실행 매개변수
 * @returns 실행 응답
 */
export const executeFlowExecutor = async (params: ExecuteFlowParams): Promise<ExecutionResponse> => {
  let resolvedInputs = params.inputs;
  if (Array.isArray(params.inputs) && params.inputs.length > 0 && typeof params.inputs[0] === 'object' && 'type' in params.inputs[0]) {
    const store = useFlowExecutorStore.getState();
    const flowChainMap = store.flowChainMap;
    resolvedInputs = resolveFlowResultInputs(params.inputs, flowChainMap);
  }
  if (!params.flowChainId || !params.flowId) {
    return editorFlowExecutor.execute({ ...params, inputs: resolvedInputs });
  }
  const response = await executorFlowExecutor.execute({ ...params, inputs: resolvedInputs });
  if (response.status === 'success') {
    const safeOutputs = response.outputs || [];
    useFlowExecutorStore.getState().setFlowResult(params.flowChainId, params.flowId, safeOutputs);
  }
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