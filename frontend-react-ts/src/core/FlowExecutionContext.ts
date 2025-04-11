import { getNodeState, setNodeState } from '../store/useNodeStateStore';

/**
 * Context for flow execution
 * Provides utilities and state management during flow execution
 */
export class FlowExecutionContext {
  /**
   * Unique execution ID
   */
  executionId: string;

  /**
   * Trigger node ID (the node that initiated the execution)
   */
  triggerNodeId: string;
  
  /**
   * Current iteration index for foreach mode
   */
  iterationIndex?: number;
  
  /**
   * Total number of items in the iteration
   */
  iterationTotal?: number;

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
   * Set the trigger node ID
   * @param nodeId The node ID that triggered this execution
   */
  setTriggerNode(nodeId: string) {
    this.triggerNodeId = nodeId;
  }

  /**
   * Create a child context for a foreach iteration
   * @param index Current iteration index
   * @param item Current iteration item
   * @returns New execution context with iteration metadata
   */
  createIterationContext(index: number, total?: number): FlowExecutionContext {
    // Create a new context with the same execution ID
    const iterContext = new FlowExecutionContext(this.executionId);
    
    // Copy basic properties
    iterContext.triggerNodeId = this.triggerNodeId;
    
    // Set iteration metadata
    iterContext.iterationIndex = index;
    iterContext.iterationTotal = total ?? this.iterationTotal;
    
    this.log(`Created iteration context ${index+1}/${iterContext.iterationTotal}`);
    
    return iterContext;
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

  /**
   * Get the stored output for a node
   * @param nodeId ID of the node
   * @returns The stored output, or null if none exists
   */
  getOutput(nodeId: string): any {
    return this.outputs.get(nodeId) || null;
  }

  /**
   * Log a message with the execution context
   * @param message Message to log
   */
  log(message: string) {
    // Add iteration info to log if available
    const iterInfo = this.iterationIndex !== undefined ? 
      `[Iter ${this.iterationIndex + 1}/${this.iterationTotal}] ` : '';
    
    console.log(`[Flow ${this.executionId}] ${iterInfo}${message}`);
  }
} 