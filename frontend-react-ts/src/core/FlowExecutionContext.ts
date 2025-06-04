import { ExecutionContext } from '../types/execution';
import { getNodeState, setNodeState } from '../store/useNodeStateStore';
import { NodeProperty } from '../types/nodes';
import { Node as FlowNode, Edge } from '@xyflow/react';
import { NodeFactory, globalNodeFactory } from './NodeFactory';
import { Node } from './Node';
import { FlowData } from '../utils/data/importExportUtils';
import { useExecutorStateStore } from '../store/useExecutorStateStore';
import { getNodeProperty } from '../store/useNodePropertyStore';
import { useFlowExecutorStore } from '../store/useFlowExecutorStore';

/**
 * Implementation of the ExecutionContext interface for flow execution
 * This context tracks state for a single execution of a flow
 */
export class FlowExecutionContext implements ExecutionContext {
  /**
   * Unique ID for this execution
   */
  executionId: string;

  /**
   * ID of the node that triggered this execution (e.g., a button or flow executor)
   */
  triggerNodeId: string;

  /**
   * ID of the parent node (for child flows and groups)
   */
  parentNodeId?: string;

  /**
   * Execution mode (single, foreach, batch)
   */
  executionMode: 'single' | 'foreach' | 'batch' = 'single';

  /**
   * Current iteration index (for foreach/batch modes)
   */
  iterationIndex?: number;

  /**
   * Total number of iterations (for foreach/batch modes)
   */
  iterationTotal?: number;

  /**
   * Original input array length (for batch processing)
   */
  originalInputLength?: number;

  /**
   * Current iteration item (for foreach mode)
   */
  iterationItem?: any;

  /**
   * Initial inputs for this execution
   */
  private inputs: any[] = [];

  /** Map of node outputs (node ID -> array of outputs) */
  private outputs: Map<string, any[]> = new Map();

  private logs: string[] = [];
  private nodeState: Map<string, { status: 'init' | 'running' | 'success' | 'error', result?: any, error?: Error }> = new Map();
  private nodeOutputs: Map<string, any> = new Map();
  private nodeErrors: Map<string, Error> = new Map();

  /**
   * Track nodes that have been executed in this context to prevent re-execution
   */
  private executedNodeIds = new Set<string>();

  /**
   * Track nodes that have received their "once" input already
   */
  public accumulatedOnceInputNodes: Set<string> = new Set<string>();

  /**
   * Function to get a node's content
   */
  getNodePropertyFunc: (nodeId: string, nodeType?: string) => NodeProperty;

  /**
   * Full list of nodes in the current flow structure.
   */
  public readonly nodes: FlowNode[];

  /**
   * Full list of edges in the current flow structure.
   */
  public readonly edges: Edge[];

  /**
   * Node factory for creating node instances
   */
  public readonly nodeFactory: NodeFactory;

  // Executor 컨텍스트를 위한 추가 속성
  private readonly isExecutorCtx: boolean = false;
  private readonly currentChainId?: string;
  private readonly currentFlowId?: string;

  private onNodeStateChange?: (nodeId: string, status: 'init' | 'running' | 'success' | 'error', result?: any, error?: any) => void;
  private onStoreOutput?: (nodeId: string, output: any) => void;

  /**
   * 실행 중단 요청 플래그
   */
  private isStopRequested: boolean = false;

  /**
   * 중단 요청 콜백 함수
   */
  private onStopRequested?: () => void;

  /**
   * Create a new flow execution context
   * @param executionId Unique ID for this execution
   * @param getNodePropertyFunc Function to get a node's content
   * @param nodes Full list of nodes in the flow
   * @param edges Full list of edges in the flow
   * @param nodeFactory Node factory for creating node instances
   * @param isExecutorContext Executor context flag
   * @param chainId Chain ID
   * @param flowId Flow ID
   * @param onNodeStateChange Callback for node state changes
   * @param onStoreOutput Callback for node output storage
   */
  constructor(
    executionId: string,
    getNodePropertyFunc: (nodeId: string, nodeType?: string) => NodeProperty,
    nodes: FlowNode[],
    edges: Edge[],
    nodeFactory?: NodeFactory,
    isExecutorContext: boolean = false,
    chainId?: string,
    flowId?: string,
    onNodeStateChange?: (nodeId: string, status: 'init' | 'running' | 'success' | 'error', result?: any, error?: any) => void,
    onStoreOutput?: (nodeId: string, output: any) => void
  ) {
    this.executionId = executionId;
    this.triggerNodeId = '';
    this.getNodePropertyFunc = getNodePropertyFunc;
    this.nodes = nodes;
    this.edges = edges;
    this.nodeFactory = nodeFactory || globalNodeFactory;
    this.isExecutorCtx = isExecutorContext;
    if (this.isExecutorCtx) {
      if (!chainId || !flowId) {
        throw new Error('chainId and flowId are required for Executor context');
      }
      this.currentChainId = chainId;
      this.currentFlowId = flowId;
    }
    this.onNodeStateChange = onNodeStateChange;
    this.onStoreOutput = onStoreOutput;
  }

  /**
   * 에디터용 실행 컨텍스트 생성 팩토리 메서드
   * @param executionId 실행 ID
   * @param flowData Flow 데이터
   * @returns 새로운 FlowExecutionContext 인스턴스
   *
   * [Editor 모드]
   * - store 기반 node.data를 사용 (실시간 편집/상태 반영)
   * - store 접근/변경 허용
   */
  static createForEditor(executionId: string, flowData: FlowData): FlowExecutionContext {
    return new FlowExecutionContext(
      executionId,
      (nodeId) => {
        // Editor 모드: useNodePropertyStore에서 최신 설정을 가져옴
        try {
          const storeProperty = getNodeProperty(nodeId);
          if (storeProperty && typeof storeProperty === 'object') {
            return storeProperty;
          }
        } catch (e) {
          console.warn('[createForEditor] Failed to get property from store:', e);
        }
        // fallback to node.data
        const node = flowData.nodes.find(n => n.id === nodeId);
        return node && (node as any).data ? (node as any).data : {};
      },
      flowData.nodes,
      flowData.edges,
      globalNodeFactory, // 항상 싱글턴 사용
      false, // isExecutorContext 플래그
      undefined,
      undefined,
      undefined,
      undefined
    );
  }

  /**
   * 실행기용 실행 컨텍스트 생성 팩토리 메서드
   * @note 이 컨텍스트는 nodeMap, rootIds, leafIds 기반으로만 동작하며,
   *       Editor store/NodeProperty 등은 절대 참조하지 않는다.
   *       Editor store 접근 시도시 에러를 throw한다.
   * @param executionId 실행 ID
   * @param flowData Flow 데이터
   * @param nodeFactory 기존 NodeFactory 인스턴스 (옵션)
   * @param flowChainId Flow Chain ID (네이밍 통일)
   * @param flowId Flow ID
   * @returns 새로운 FlowExecutionContext 인스턴스
   *
   * [Executor 모드]
   * - store 접근 시도: flowChainMap > flowMap > nodeMap > nodeId > property
   * - 없으면 빈 객체 반환 (data로 fallback하지 않음)
   */
  static createForExecutor(
    executionId: string,
    flowData: FlowData,
    nodeFactory?: NodeFactory,
    flowChainId?: string,
    flowId?: string
  ): FlowExecutionContext {
    return new FlowExecutionContext(
      executionId,
      (nodeId) => {
        // Executor 모드: Flow Executor store에서 data 필드를 property로 사용
        try {
          if (flowChainId && flowId) {
            const store = useFlowExecutorStore.getState();
            const nodeMap = store.flowChainMap?.[flowChainId]?.flowMap?.[flowId]?.nodeMap;
            const storeProperty = nodeMap?.[nodeId]?.data;
            
            if (storeProperty && typeof storeProperty === 'object') {
              return storeProperty;
            }
          }
        } catch (e) {
          console.error(`[createForExecutor] Error retrieving node ${nodeId}:`, e);
        }
        
        // fallback을 buildGraphStructure에서 설정한 데이터로 변경
        const node = flowData.nodes.find(n => n.id === nodeId);
        // buildGraphStructure에서 이미 올바른 데이터가 node.data에 설정되어 있어야 함
        const fallbackData = node && node.data && typeof node.data === 'object' ? node.data : {};
        
        return fallbackData;
      },
      flowData.nodes,
      flowData.edges,
      nodeFactory || globalNodeFactory,
      true,
      flowChainId,
      flowId,
      undefined,
      undefined
    );
  }

  /**
   * 실행의 초기 입력 설정
   * @param inputs 입력 배열
   */
  setInputs(inputs: any[]): void {
    this.inputs = Array.isArray(inputs) ? [...inputs] : [inputs];
    this.log(`설정된 입력: ${this.inputs.length}개 항목`);
  }

  /**
   * 초기 입력 값 가져오기
   * @returns 입력 배열
   */
  getInputs(): any[] {
    return this.inputs;
  }

  /**
   * 노드 인스턴스 생성
   * @param nodeId 노드 ID
   * @param nodeType 노드 유형
   * @param nodeData 노드 데이터
   * @returns 생성된 노드 인스턴스 또는 null
   */
  createNodeInstance(nodeId: string, nodeType: string, nodeData: any): Node | null {
    try {
      return this.nodeFactory.create(nodeId, nodeType, nodeData, this);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log(`Error creating node instance ${nodeId}: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Set the ID of the node that triggered this execution
   * @param nodeId ID of the trigger node
   */
  setTriggerNode(nodeId: string) {
    this.triggerNodeId = nodeId;
  }

  /**
   * Log a message to the execution context logs
   * @param message The message to log
   */
  log(message: string): void {
    // 모든 로그 정보를 보존하되, 실행 컨텍스트 ID도 포함
    const logMessage = `[ExecutionContext:${this.executionId}] ${message}`;
    
    // 개발 환경에서는 콘솔에도 로그 출력
    if (process.env.NODE_ENV === 'development') {
      console.log(logMessage);
    }
    
    this.logs.push(message);
  }

  /**
   * Set iteration context for foreach/batch execution modes
   * @param context The iteration context (item, index, total)
   */
  setIterationContext(context: { item?: any; index?: number; total?: number }) {
    if (context.item !== undefined) this.iterationItem = context.item;
    if (context.index !== undefined) this.iterationIndex = context.index;
    if (context.total !== undefined) this.iterationTotal = context.total;
  }

  /**
   * Get all outputs for a node
   * @param nodeId The node ID
   * @returns Array of stored outputs for this node
   */
  getOutput(nodeId: string): any[] {
    return this.outputs.get(nodeId) || [];
  }

  /**
   * Get the current state of a node
   * @param nodeId The node ID
   * @returns Current node state or undefined if not set
   */
  getNodeState(nodeId: string): any {
    return this.nodeState.get(nodeId);
  }

  /**
   * Mark a node as running
   * @param nodeId ID of the node
   */
  markNodeRunning(nodeId: string) {
    this.log(`Marking node ${nodeId} as running`);
    this.onNodeStateChange?.(nodeId, 'running');
  }

  /**
   * Mark a node as successful with a result.
   * Note: Stores the single 'result' in the global node state,
   * even if multiple results are accumulated in the context's output array.
   * @param nodeId ID of the node
   * @param result The *latest* result to store for status display
   */
  markNodeSuccess(nodeId: string, result: any, activeOutputHandle?: string, conditionResult?: boolean) {
    this.log(`Marking node ${nodeId} as success`);
    this.onNodeStateChange?.(nodeId, 'success', result, undefined);
  }

  /**
   * Mark a node as failed with an error
   * @param nodeId ID of the node
   * @param error The error message
   */
  markNodeError(nodeId: string, error: string) {
    this.log(`Marking node ${nodeId} as failed: ${error}`);
    this.onNodeStateChange?.(nodeId, 'error', undefined, error);
  }

  /**
   * Store the output of a node in the context. Appends to existing outputs if any.
   * @param nodeId The node ID
   * @param output The node output to append
   */
  storeOutput(nodeId: string, output: any): void {
    this.onStoreOutput?.(nodeId, output);
    // context 내부 outputs 맵은 테스트/임시용으로만 유지(필요시)
    let outputArray = this.outputs.get(nodeId);
    if (!outputArray) {
      outputArray = [];
      this.outputs.set(nodeId, outputArray);
    }
    outputArray.push(output);
    this.nodeOutputs.set(nodeId, output);
  }

  /**
   * Get all logs
   * @returns Array of log messages
   */
  getLogs(): string[] {
    return [...this.logs];
  }

  /**
   * Set node output data
   * @param nodeId ID of the node
   * @param output Output data to store
   */
  setOutput(nodeId: string, output: any): void {
    this.nodeOutputs.set(nodeId, output);
  }

  /**
   * Set node error
   * @param nodeId ID of the node
   * @param error Error to store
   */
  setError(nodeId: string, error: Error): void {
    this.nodeErrors.set(nodeId, error);
  }

  /**
   * Get node error
   * @param nodeId ID of the node
   * @returns The stored error or undefined if not found
   */
  getError(nodeId: string): Error | undefined {
    return this.nodeErrors.get(nodeId);
  }

  /**
   * Set node state
   * @param nodeId ID of the node
   * @param status Node status
   * @param result Optional result data
   * @param error Optional error
   */
  setNodeState(nodeId: string, status: 'init' | 'running' | 'success' | 'error', result?: any, error?: Error): void {
    this.nodeState.set(nodeId, { status, result, error });
  }

  /**
   * Get all node states
   * @returns Map of node states
   */
  getAllNodeStates(): Map<string, { status: 'init' | 'running' | 'success' | 'error', result?: any, error?: Error }> {
    return new Map(this.nodeState);
  }

  /**
   * Reset the execution context
   */
  reset(): void {
    this.logs = [];
    this.nodeState.clear();
    this.nodeOutputs.clear();
    this.nodeErrors.clear();
  }

  /**
   * Store debug data for a node in the context
   * Used for tracking key node properties during execution
   * @param nodeId The node ID
   * @param data The data to store
   */
  storeNodeData(nodeId: string, data: Record<string, any>): void {
    this.log(`Debug data for node ${nodeId}: ${JSON.stringify(data)}`);
    
    // Store in node state for debugging purposes
    const currentState = getNodeState(nodeId) || {};
    setNodeState(nodeId, { 
      ...currentState,
      debugData: data
    });
  }

  /**
   * Check if a node has already been executed in this context
   * @param nodeId ID of the node to check
   * @returns True if the node has already been executed
   */
  hasExecutedNode(nodeId: string): boolean {
    return this.executedNodeIds.has(nodeId);
  }

  /**
   * Mark a node as executed to prevent re-execution
   * @param nodeId ID of the node to mark as executed
   */
  markNodeExecuted(nodeId: string): void {
    this.executedNodeIds.add(nodeId);
  }

  /**
   * Set node state change callback
   * @param callback Callback function for node state changes
   */
  setNodeStateChangeCallback(callback: (nodeId: string, status: 'init' | 'running' | 'success' | 'error', result?: any, error?: any) => void): void {
    this.onNodeStateChange = callback;
  }

  /**
   * Set store output callback
   * @param callback Callback function for node output storage
   */
  setStoreOutputCallback(callback: (nodeId: string, output: any) => void): void {
    this.onStoreOutput = callback;
  }

  /**
   * 실행 중단을 요청합니다
   */
  requestStop(): void {
    this.isStopRequested = true;
    if (this.onStopRequested) {
      this.onStopRequested();
    }
  }

  /**
   * 실행 중단이 요청되었는지 확인합니다
   */
  isStopRequested_(): boolean {
    return this.isStopRequested;
  }

  /**
   * 중단 요청 콜백을 설정합니다
   */
  setStopRequestedCallback(callback: () => void): void {
    this.onStopRequested = callback;
  }

  /**
   * 중단 플래그를 초기화합니다
   */
  resetStopFlag(): void {
    this.isStopRequested = false;
  }
}