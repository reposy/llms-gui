import { Node } from 'reactflow';
import { InputNodeData } from '../types/nodes';
import { ExecutionContext } from '../types/execution';

// Define the expected parameters for the executor
interface ExecuteInputNodeParams {
  node: Node<InputNodeData>;
  input: any;
  context: ExecutionContext;
}

/**
 * Executes an Input node.
 * Simply returns the input as-is. 
 * The dispatcher now handles all foreach/batch behavior.
 */
export function executeInputNode({ node, input, context }: ExecuteInputNodeParams): any {
  const nodeId = node.id;
  console.log(`[InputExecutor] (${nodeId}) Received input:`, input);
  return input;
} 