import { Node } from 'reactflow';
import { OutputNodeData } from '../types/nodes';
import { ExecutionContext } from '../types/execution';

// Define the expected parameters for the executor
interface ExecuteOutputNodeParams {
  node: Node<OutputNodeData>;
  input: any;
  context: ExecutionContext; // Included for consistency, though not used
}

/**
 * Executes an Output node.
 * It simply passes through the single input it receives.
 * In the stateless execution model, it always shows the last input processed.
 * For foreach iterations, this means only the final result will be visible.
 * Returns the input or null.
 */
export function executeOutputNode(params: ExecuteOutputNodeParams): any {
  const { node, input, context } = params;
  const nodeId = node.id;
  const { executionId, executionMode } = context;

  if (!executionMode) {
    console.warn(`[OutputExecutor] (${nodeId}) WARNING: executionMode is not set in context!`);
  }

  console.log(`[OutputExecutor] (${nodeId}) Executing with context ID: ${executionId}, mode: ${executionMode || 'standard'}`);
  console.log(`[OutputExecutor] (${nodeId}) Received input type: ${Array.isArray(input) ? 'array[' + input.length + ']' : typeof input}`);
  
  if (executionMode === 'batch' || executionMode === 'foreach') {
    console.log(`[OutputExecutor] (${nodeId}) Processing with ${executionMode} mode`);
  } else if (executionMode === 'iteration-item') {
    console.log(`[OutputExecutor] (${nodeId}) Processing single iteration item (possible foreach child): ${JSON.stringify(input)}`);
    console.log(`[OutputExecutor] (${nodeId}) ⚠️ NOTE: In foreach mode, only the final iteration result will be displayed in the UI`);
  }
  
  // Simple, direct handling - no unwrapping of arrays needed
  // since the dispatcher now ensures we only get single values
  
  // Special case for LLM results which may contain their result in a text property
  if (input && typeof input === 'object' && 'text' in input) {
    console.log(`[OutputExecutor] (${nodeId}) Processing LLM result with text property`);
    // The Output node's UI already knows how to display these objects
  }

  // Return the input as is
  return input;
} 