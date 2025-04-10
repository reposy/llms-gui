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
 * It simply passes through the input it receives.
 * Returns the input or null.
 */
export function executeOutputNode(params: ExecuteOutputNodeParams): any {
  const { node, input, context } = params;
  const nodeId = node.id;
  const { executionId } = context;

  console.log(`[ExecuteNode ${nodeId}] (Output) Executing with context:`, context);
  
  console.log(`[ExecuteNode ${nodeId}] (Output) Passing through input:`, input);

  return input;
} 