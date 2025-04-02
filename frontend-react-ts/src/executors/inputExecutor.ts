import { Node } from 'reactflow';
import { InputNodeData } from '../types/nodes';
import { ExecutionContext } from '../types/execution';

// Define the expected parameters for the executor
interface ExecuteInputNodeParams {
  node: Node<InputNodeData>;
  inputs: any[]; // Inputs are typically ignored for an Input node
  context: ExecutionContext;
}

/**
 * Executes an Input node.
 * If running within a group iteration, it outputs the current iteration item.
 * Otherwise, it outputs the items defined in its node data.
 * Returns an array of items or a single iteration item.
 */
export function executeInputNode(params: ExecuteInputNodeParams): any {
  const { node, context } = params;
  const nodeId = node.id;
  const nodeData = node.data;
  const { executionId, iterationItem } = context;

  console.log(`[ExecuteNode ${nodeId}] (Input) Executing with context:`, context);

  let output: any;

  // Use iteration item if available (from group execution)
  if (iterationItem !== undefined) {
    output = iterationItem;
    console.log(`[ExecuteNode ${nodeId}] (Input) Using iteration item:`, output);
  } else {
    // Otherwise, use the node's own items (typically for single runs or as group source)
    output = nodeData.items || [];
    console.log(`[ExecuteNode ${nodeId}] (Input) Using node data items:`, output);
  }

  return output;
} 