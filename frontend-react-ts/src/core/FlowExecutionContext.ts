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

  private logs: string[] = [];
  private nodeState: Map<string, { status: 'init' | 'running' | 'success' | 'error', result?: any, error?: Error }> = new Map();
  private nodeOutputs: Map<string, any> = new Map();
  private nodeErrors: Map<string, Error> = new Map();

  /**
   * Set of executed node IDs to prevent re-execution within the same execution context
   */
  private executedNodeIds = new Set<string>();

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
   * Log a message to the execution log
   * @param message The message to log
   */
  log(message: string): void {
    const timestamp = new Date().toISOString();
    this.logs.push(`[${timestamp}] ${message}`);
    
    // Also log to console for debugging
    console.log(`[ExecutionContext:${this.executionId}] ${message}`);
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
   * Store the output of a node in the context
   * @param nodeId The node ID
   * @param output The node output
   */
  storeOutput(nodeId: string, output: any): void {
    this.log(`Storing output for node ${nodeId}`);
    
    // If output is complex, provide a summary
    let outputSummary = '';
    if (Array.isArray(output)) {
      outputSummary = `Array with ${output.length} items`;
    } else if (output && typeof output === 'object') {
      outputSummary = `Object with keys: ${Object.keys(output).join(', ')}`;
    } else if (typeof output === 'string') {
      outputSummary = output.length > 100 ? `String (${output.length} chars): "${output.substring(0, 100)}..."` : `String: "${output}"`;
    } else {
      outputSummary = String(output);
    }
    
    this.log(`Node ${nodeId} output: ${outputSummary}`);
    
    // Store in execution context outputs
    this.outputs.set(nodeId, output);
    
    // Update node state in the store
    this.markNodeSuccess(nodeId, output);
    
    // Also update the nodeContentStore to make the result visible in the UI
    try {
      // Use dynamic import to avoid circular dependencies
      import('../store/useNodeContentStore').then(({ setNodeContent, getNodeContent }) => {
        // Get existing content first
        const existingContent = getNodeContent(nodeId);
        
        // Update content with result
        setNodeContent(nodeId, { 
          ...existingContent,
          content: output, // Store the output in the content field
          responseContent: output, // Also store in responseContent for backwards compatibility
          outputTimestamp: Date.now() // Add timestamp to force UI updates
        });
        
        this.log(`Updated node content store for node ${nodeId}`);
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