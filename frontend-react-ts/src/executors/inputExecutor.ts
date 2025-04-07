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
 * If running within an input node's own foreach iteration, it outputs the current iteration item.
 * Otherwise, it outputs the items defined in its node data.
 * Returns an array of items, a single iteration item, or a single array containing all items.
 */
export function executeInputNode(params: ExecuteInputNodeParams): any {
  const { node, context } = params;
  const nodeId = node.id;
  const nodeData = node.data;
  const { executionId, iterationItem, iterationTracking } = context;

  console.log(`[ExecuteNode ${nodeId}] (Input) Executing with context:`, context);

  let output: any;

  // If there's an iteration item in the context, we're inside an iteration (group or input foreach)
  if (iterationItem !== undefined) {
    output = iterationItem;
    console.log(`[ExecuteNode ${nodeId}] (Input) Using iteration item:`, output);
  } 
  // If we're not in iteration mode and iterateEachRow is true, we're at the start of a foreach execution
  // The actual iteration handling is in the executionDispatcher
  else if (nodeData.iterateEachRow) {
    // For text input, convert to items by splitting on newlines if not already in items format
    if (nodeData.inputType === 'text' && nodeData.text && (!nodeData.items || nodeData.items.length === 0)) {
      // Split text into lines, trim whitespace, and filter out empty lines
      const lines = nodeData.text.split(/\r?\n/).map(line => line.trim()).filter(line => line !== '');
      output = lines;
      console.log(`[ExecuteNode ${nodeId}] (Input) Converted text to ${lines.length} items for foreach execution:`, output);
    } else {
      output = nodeData.items || [];
      console.log(`[ExecuteNode ${nodeId}] (Input) Using all items for foreach execution:`, output);
    }
  }
  // Otherwise, use the node's content in the appropriate format
  else {
    if (nodeData.inputType === 'text') {
      output = nodeData.text || '';
      console.log(`[ExecuteNode ${nodeId}] (Input) Using text content:`, output);
    } else {
      output = nodeData.items || [];
      console.log(`[ExecuteNode ${nodeId}] (Input) Using node data items as array:`, output);
    }
  }

  // Check if we're inside an input node's foreach loop and log iteration progress
  if (iterationTracking && iterationTracking.inputNodeId === nodeId) {
    console.log(`[ExecuteNode ${nodeId}] (Input) Foreach iteration progress: item ${iterationTracking.currentIndex + 1} of ${iterationTracking.totalItems}`);
  }

  return output;
} 