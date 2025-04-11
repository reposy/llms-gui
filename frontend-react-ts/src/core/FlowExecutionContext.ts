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
      executionId: this.executionId
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
      executionId: this.executionId
    });
  }

  /**
   * Store an output value for a node
   * @param nodeId ID of the node
   * @param output The output value to store
   */
  storeOutput(nodeId: string, output: any) {
    this.outputs.set(nodeId, output);
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
    console.log(`[Flow ${this.executionId}] ${message}`);
  }
} 