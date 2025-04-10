import { Node } from 'reactflow';
import { OutputNodeData } from '../types/nodes';
import { ExecutionContext, NodeState } from '../types/execution';
import { makeExecutionLogPrefix } from '../controller/executionDispatcher';
import { extractValueFromNodeResult, extractValueFromContext } from '../executors/executorDispatcher';

// Define the expected parameters for the executor
export interface ExecuteOutputNodeParams {
  node: Node<OutputNodeData>;
  inputs: any[];
  context: ExecutionContext; // Included for consistency, though not used
  setNodeState: (nodeId: string, state: Partial<NodeState>) => void;
}

/**
 * Executes an Output node which simply passes through an input.
 * Returns the first input or null.
 */
export async function executeOutputNode(params: ExecuteOutputNodeParams): Promise<{ value: any }> {
  const { node, inputs, context, setNodeState } = params;
  const { executionId } = context;
  const nodeId = node.id;
  
  // Create standardized log prefix
  const logPrefix = makeExecutionLogPrefix(node, context);

  console.log(`${logPrefix} Executing Output node...`);
  console.log(`${logPrefix} EXECUTION CONTEXT:`, {
    mode: context.iterationTracking?.executionMode || 'standard',
    iteration: context.iterationTracking ? `${context.iterationTracking.currentIndex + 1}/${context.iterationTracking.totalItems}` : 'N/A',
    executionId: context.executionId,
    hasIterationItem: context.hasIterationItem,
    inputType: context.inputType || 'unknown'
  });

  // Set node state to running
  setNodeState(nodeId, {
    status: 'running',
    executionId,
    error: undefined,
    result: undefined, // Clear any previous result
  });

  try {
    // Extract value using consistent helper method
    let result;
    
    // First check for iterationItem in context
    const contextExtracted = extractValueFromContext(context);
    if (contextExtracted.value !== null) {
      result = contextExtracted.value;
      console.log(`${logPrefix} Using iterationItem from context as output result`);
    }
    // Then check the first input if available
    else if (inputs.length > 0) {
      const extracted = extractValueFromNodeResult(inputs[0]);
      result = extracted.value;
      console.log(`${logPrefix} Using inputs[0] as output result`);
    } 
    // Fallback to undefined
    else {
      result = undefined;
      console.log(`${logPrefix} No input available for output node`);
    }
    
    console.log(`${logPrefix} Output result:`, typeof result === 'object' ? 
      JSON.stringify(result).substring(0, 200) + '...' : 
      result);

    // Set node state to success with the result
    setNodeState(nodeId, {
      status: 'success',
      result,
      executionId,
    });

    return { value: result };
  } catch (error) {
    console.error(`${logPrefix} Error executing Output node:`, error);
    
    // Set node state to error
    setNodeState(nodeId, {
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
      executionId,
    });

    throw error;
  }
} 