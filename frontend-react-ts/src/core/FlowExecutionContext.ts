import { getNodeState, setNodeState } from '../store/useNodeStateStore';
import { ExecutionContext } from '../types/execution';

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
   * Output store for nodes
   */
  private outputs: Map<string, any> = new Map();

  /**
   * Constructor
   * @param executionId Unique identifier for this execution
   */
  constructor(executionId: string) {
    this.executionId = executionId;
    this.triggerNodeId = '';
  }

  /**
   * Set the trigger node for this execution
   * @param nodeId ID of the trigger node
   */
  setTriggerNode(nodeId: string) {
    this.triggerNodeId = nodeId;
  }

  /**
   * Log a message in the execution context
   * @param message The message to log
   */
  log(message: string) {
    console.log(`[Exec ${this.executionId}] ${message}`);
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
   * Get the output value for a node
   * @param nodeId ID of the node
   * @returns The output value or undefined if not found
   */
  getOutput(nodeId: string): any {
    return this.outputs.get(nodeId);
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
    this.log(`Marking node ${nodeId} as running`);
    setNodeState(nodeId, { 
      status: 'running', 
      executionId: this.executionId,
      lastTriggerNodeId: this.triggerNodeId || nodeId,
      activeOutputHandle: undefined,
      conditionResult: undefined
    });
  }

  /**
   * Mark a node as successful with a result
   * @param nodeId ID of the node
   * @param result The result to store
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
   * Store an output value for a node
   * @param nodeId ID of the node
   * @param output The output value to store
   */
  storeOutput(nodeId: string, output: any) {
    // Store the output in context's memory
    this.outputs.set(nodeId, output);
    
    // Also update the node state
    this.markNodeSuccess(nodeId, output);
  }
} 