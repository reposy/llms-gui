import { getNodeState, setNodeState } from '../store/useNodeStateStore';
import { ExecutionContext } from '../types/execution';
import { NodeContent } from '../types/nodes';
import { Node as FlowNode, Edge } from '@xyflow/react';
import { NodeFactory } from './NodeFactory';

/**
 * Context for flow execution
 * Provides utilities and state management during flow execution
 */
export class FlowExecutionContext implements ExecutionContext {
  /**
   * Unique execution ID
   */
  executionId: string;

  /**
   * Trigger node ID (the node that initiated the execution)
   */
  triggerNodeId: string;
  
  /**
   * Parent node ID for sub-executions
   */
  parentNodeId?: string;
  
  /**
   * Execution mode
   */
  executionMode: 'single' | 'foreach' | 'batch' = 'single';
  
  /**
   * Current iteration index for foreach mode
   */
  iterationIndex?: number;
  
  /**
   * Total number of items in the iteration
   */
  iterationTotal?: number;
  
  /**
   * Original input length
   */
  originalInputLength?: number;
  
  /**
   * Current iteration item
   */
  iterationItem?: any;

  /**
   * Output store for nodes - now stores an array of outputs per node.
   */
  private outputs: Map<string, any[]> = new Map();

  private logs: string[] = [];
  private nodeState: Map<string, { status: 'init' | 'running' | 'success' | 'error', result?: any, error?: Error }> = new Map();
  private nodeOutputs: Map<string, any> = new Map();
  private nodeErrors: Map<string, Error> = new Map();

  /**
   * Set of executed node IDs to prevent re-execution within the same execution context
   */
  private executedNodeIds = new Set<string>();

  // Add a set to track nodes that have accumulated once per context for InputNode
  public accumulatedOnceInputNodes: Set<string> = new Set<string>();

  /**
   * Function to retrieve node content. Injected during context creation.
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
   * Node factory instance for creating node instances during execution.
   */
  public readonly nodeFactory: NodeFactory;

  /**
   * Constructor
   * @param executionId Unique identifier for this execution
   * @param getNodeContentFunc Function to retrieve node content
   * @param nodes Full list of nodes in the flow
   * @param edges Full list of edges in the flow
   * @param nodeFactory Node factory instance
   */
  constructor(
      executionId: string,
      getNodeContentFunc: (nodeId: string, nodeType?: string) => NodeContent,
      nodes: FlowNode[],
      edges: Edge[],
      nodeFactory: NodeFactory
    ) {
    this.executionId = executionId;
    this.triggerNodeId = '';
    this.getNodeContentFunc = getNodeContentFunc;
    this.nodes = nodes;
    this.edges = edges;
    this.nodeFactory = nodeFactory;
    this.logs = []; // Ensure logs is initialized in constructor too
  }

  /**
   * Set the trigger node for this execution
   * @param nodeId ID of the trigger node
   */
  setTriggerNode(nodeId: string) {
    this.triggerNodeId = nodeId;
  }

  /**
   * Log a message in the context
   * @param message The message to log
   */
  log(message: string): void {
    // 개발 모드에서만 로그를 저장하거나 출력
    const isDevelopment = process.env.NODE_ENV === 'development';
    if (!isDevelopment) return;

    const timestamp = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
    if (!Array.isArray(this.logs)) {
        console.error(`[ExecutionContext:${this.executionId}] CRITICAL: this.logs is not an array! Attempting recovery. Logs was:`, this.logs);
        this.logs = []; // Attempt recovery
    }
    
    try {
        // 로그 길이 제한 (최대 100개)
        if (this.logs.length >= 100) {
          this.logs.shift(); // 가장 오래된 로그 제거
        }
      
        // Ensure message is a string before pushing
        const finalMessage = typeof message === 'string' ? message : JSON.stringify(message);
        this.logs.push(`[${timestamp}] ${finalMessage}`); 
    } catch (e) {
        console.error(`[ExecutionContext:${this.executionId}] FAILED to push log: ${e}`, message);
    }
    
    // 개발 모드에서만 콘솔 로그 출력
    if (isDevelopment) {
      console.log(`[ExecutionContext:${this.executionId}] ${message}`);
    }
  }

  /**
   * Set execution mode as a foreach iteration
   * @param context The iteration context details
   */
  setIterationContext(context: { item?: any; index?: number; total?: number }) {
    this.iterationIndex = context.index;
    this.iterationTotal = context.total;
    this.iterationItem = context.item;
    this.executionMode = 'foreach';
  }

  /**
   * Get the array of output values for a node.
   * @param nodeId ID of the node
   * @returns The array of output values, or an empty array if none found.
   */
  getOutput(nodeId: string): any[] {
    return this.outputs.get(nodeId) || [];
  }

  /**
   * Get node execution state from the state store
   * @param nodeId ID of the node
   * @returns The node state or undefined if not found
   */
  getNodeState(nodeId: string): any {
    return getNodeState(nodeId);
  }

  /**
   * Mark a node as running
   * @param nodeId ID of the node
   */
  markNodeRunning(nodeId: string) {
    const message = `Marking node ${nodeId} as running`;
    this.log(message);
    // Remove forced log for testing
    setNodeState(nodeId, { 
      status: 'running', 
      executionId: this.executionId,
      lastTriggerNodeId: this.triggerNodeId || nodeId,
      activeOutputHandle: undefined,
      conditionResult: undefined
    });
  }

  /**
   * Mark a node as successful with a result.
   * Note: Stores the single 'result' in the global node state,
   * even if multiple results are accumulated in the context's output array.
   * @param nodeId ID of the node
   * @param result The *latest* result to store for status display
   */
  markNodeSuccess(nodeId: string, result: any) {
    this.log(`Marking node ${nodeId} as successful`);
    setNodeState(nodeId, {
      status: 'success',
      result,
      error: undefined,
      executionId: this.executionId,
      // Include iteration metadata in node state
      iterationIndex: this.iterationIndex,
      iterationTotal: this.iterationTotal
    });
  }

  /**
   * Mark a node as failed with an error
   * @param nodeId ID of the node
   * @param error The error message
   */
  markNodeError(nodeId: string, error: string) {
    this.log(`Marking node ${nodeId} as failed: ${error}`);
    setNodeState(nodeId, { 
      status: 'error', 
      error,
      executionId: this.executionId,
      // Include iteration metadata in node state
      iterationIndex: this.iterationIndex,
      iterationTotal: this.iterationTotal
    });
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