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
  const { executionId } = context;

  console.log(`[OutputExecutor] (${nodeId}) Executing with context ID: ${executionId}`);
  console.log(`[OutputExecutor] (${nodeId}) Processing input:`, input);

  // Simply pass through the input value
  // The dispatcher's success handling will update the node state with this result
  return input;
} 