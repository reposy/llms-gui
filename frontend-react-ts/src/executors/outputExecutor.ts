import { Node } from 'reactflow';
import { OutputNodeData } from '../types/nodes';
import { ExecutionContext } from '../types/execution';

// Define the expected parameters for the executor
interface ExecuteOutputNodeParams {
  node: Node<OutputNodeData>;
  inputs: any[];
  context: ExecutionContext; // Included for consistency, though not used
}

/**
 * Executes an Output node.
 * It simply passes through the first input it receives.
 * Returns the first input or null.
 */
export function executeOutputNode(params: ExecuteOutputNodeParams): any {
  const { node, inputs, context } = params;
  const nodeId = node.id;
  const { executionId } = context;

  console.log(`[ExecuteNode ${nodeId}] (Output) Executing with context:`, context);
  
  const output = inputs.length > 0 ? inputs[0] : null;
  console.log(`[ExecuteNode ${nodeId}] (Output) Passing through input:`, output);

  return output;
} 