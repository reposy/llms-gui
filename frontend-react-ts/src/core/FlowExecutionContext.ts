import { ExecutionContext } from '../types/execution';
import { getNodeState, setNodeState } from '../store/useNodeStateStore';
import { NodeContent } from '../types/nodes';
import { Node as FlowNode, Edge } from '@xyflow/react';
import { NodeFactory } from './NodeFactory';
import { Node } from './Node';
import { FlowData } from '../utils/data/importExportUtils';
import { useExecutorStateStore } from '../store/useExecutorStateStore';

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
  getNodeContentFunc: (nodeId: string, nodeType?: string) => NodeContent;

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

  /**
   * Create a new flow execution context
   * @param executionId Unique ID for this execution
   * @param getNodeContentFunc Function to get a node's content
   * @param nodes Full list of nodes in the flow
   * @param edges Full list of edges in the flow
   * @param nodeFactory Node factory for creating node instances
   * @param isExecutorContext Executor context flag
   * @param chainId Chain ID
   * @param flowId Flow ID
   */
  constructor(
    executionId: string,
    getNodeContentFunc: (nodeId: string, nodeType?: string) => NodeContent,
    nodes: FlowNode[],
    edges: Edge[],
    nodeFactory?: NodeFactory,
    isExecutorContext: boolean = false,
    chainId?: string,
    flowId?: string
  ) {
    this.executionId = executionId;
    this.triggerNodeId = '';
    this.getNodeContentFunc = getNodeContentFunc;
    this.nodes = nodes;
    this.edges = edges;
    this.nodeFactory = nodeFactory || new NodeFactory();

    this.isExecutorCtx = isExecutorContext;
    if (this.isExecutorCtx) {
      if (!chainId || !flowId) {
        throw new Error('chainId and flowId are required for Executor context');
      }
      this.currentChainId = chainId;
      this.currentFlowId = flowId;
    }
  }

  /**
   * 에디터용 실행 컨텍스트 생성 팩토리 메서드
   * @param executionId 실행 ID
   * @param flowData Flow 데이터
   * @returns 새로운 FlowExecutionContext 인스턴스
   */
  static createForEditor(executionId: string, flowData: FlowData): FlowExecutionContext {
    return new FlowExecutionContext(
      executionId,
      (nodeId) => {
        const node = flowData.nodes.find(n => n.id === nodeId);
        return node?.data || {};
      },
      flowData.nodes,
      flowData.edges,
      new NodeFactory(), // 에디터 전용 팩토리 인스턴스 생성
      false // isExecutorContext 플래그
    );
  }

  /**
   * 실행기용 실행 컨텍스트 생성 팩토리 메서드
   * @note 이 컨텍스트는 nodeMap, rootIds, leafIds 기반으로만 동작하며,
   *       Editor store/NodeContent 등은 절대 참조하지 않는다.
   *       Editor store 접근 시도시 에러를 throw한다.
   * @param executionId 실행 ID
   * @param flowData Flow 데이터
   * @param nodeFactory 기존 NodeFactory 인스턴스 (옵션)
   * @param chainId Chain ID
   * @param flowId Flow ID
   * @returns 새로운 FlowExecutionContext 인스턴스
   */
  static createForExecutor(executionId: string, flowData: FlowData, nodeFactory?: NodeFactory, chainId?: string, flowId?: string): FlowExecutionContext {
    if (!chainId || !flowId) {
      // 프로덕션에서는 이 오류가 발생해서는 안되지만, 개발 중 안전장치로 추가
      console.error('Executor context creation requires chainId and flowId.');
      throw new Error('chainId and flowId are required for Executor context at creation.');
    }
    return new FlowExecutionContext(
      executionId,
      (nodeId) => {
        // nodeMap 기반 데이터만 허용 (Editor store/NodeContent 등 접근 금지)
        const node = flowData.nodes.find(n => n.id === nodeId);
        return node?.data || {};
      },
      flowData.nodes,
      flowData.edges,
      nodeFactory || new NodeFactory(), // 실행기 전용 팩토리 인스턴스 생성 또는 기존 인스턴스 재사용
      true, // isExecutorContext 플래그
      chainId,
      flowId
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
    if (this.isExecutorCtx && this.currentChainId && this.currentFlowId) {
      useExecutorStateStore.getState().setFlowNodeState(this.currentChainId, this.currentFlowId, nodeId, {
        status: 'running'
      });
    } else {
      setNodeState(nodeId, {
        status: 'running',
        result: undefined,
        error: undefined,
        executionId: this.executionId,
        lastTriggerNodeId: this.triggerNodeId || nodeId,
        activeOutputHandle: undefined,
        conditionResult: undefined
      });
    }
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
    if (this.isExecutorCtx && this.currentChainId && this.currentFlowId) {
      useExecutorStateStore.getState().setFlowNodeState(this.currentChainId, this.currentFlowId, nodeId, {
        status: 'success',
        result: result // deepClone은 setFlowNodeState 내부에서 처리
      });
    } else {
      setNodeState(nodeId, {
        status: 'success',
        result,
        executionId: this.executionId,
        lastTriggerNodeId: this.triggerNodeId || nodeId,
        activeOutputHandle,
        conditionResult,
        // Include iteration metadata in node state
        iterationIndex: this.iterationIndex,
        iterationTotal: this.iterationTotal
      });
    }
  }

  /**
   * Mark a node as failed with an error
   * @param nodeId ID of the node
   * @param error The error message
   */
  markNodeError(nodeId: string, error: string) {
    this.log(`Marking node ${nodeId} as failed: ${error}`);
    if (this.isExecutorCtx && this.currentChainId && this.currentFlowId) {
      useExecutorStateStore.getState().setFlowNodeState(this.currentChainId, this.currentFlowId, nodeId, {
        status: 'error',
        error: error
      });
    } else {
      setNodeState(nodeId, { 
        status: 'error', 
        error,
        executionId: this.executionId,
        // Include iteration metadata in node state
        iterationIndex: this.iterationIndex,
        iterationTotal: this.iterationTotal
      });
    }
  }

  /**
   * Store the output of a node in the context. Appends to existing outputs if any.
   * @param nodeId The node ID
   * @param output The node output to append
   */
  storeOutput(nodeId: string, output: any): void {
    // 개발 모드에서만 로그 출력
    if (process.env.NODE_ENV === 'development') {
      this.log(`Storing output for node ${nodeId}`);
    }

    let outputArray = this.outputs.get(nodeId);
    if (!outputArray) {
      outputArray = [];
      this.outputs.set(nodeId, outputArray);
    }
    outputArray.push(output);

    // 항상 nodeOutputs에도 저장 (대표값)
    this.nodeOutputs.set(nodeId, output);
    
    if (process.env.NODE_ENV === 'development') {
      this.log(`Appended output for node ${nodeId}. Total outputs: ${outputArray.length}`);
    }

    this.markNodeSuccess(nodeId, output);

    try {
      import('../store/useNodeContentStore').then(({ setNodeContent, getNodeContent }) => {
        const existingContent = getNodeContent(nodeId);
        const currentNode = this.nodes.find(n => n.id === nodeId); // 현재 노드 정보 가져오기

        const contentUpdates: Record<string, any> = {
          ...existingContent,
          outputTimestamp: Date.now()
        };
        
        if (typeof output !== 'undefined') {
          contentUpdates.responseContent = output;
          
          if (existingContent && 'format' in existingContent) { // OutputNode
            contentUpdates.content = output;
          }
          
          // 현재 노드가 GroupNode가 아니고, items 속성이 있으며, output이 배열인 경우에만 items 업데이트
          if (currentNode?.type !== 'group' && existingContent && 'items' in existingContent && Array.isArray(output)) {
            contentUpdates.items = output;
          }
        }
        
        setNodeContent(nodeId, contentUpdates);
        if (process.env.NODE_ENV === 'development') {
          this.log(`Updated node content store for node ${nodeId}`);
        }
      }).catch(err => {
        console.error(`Failed to update node content store: ${err}`);
      });
    } catch (error) {
      console.error(`Error updating node content store: ${error}`);
    }
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
} 