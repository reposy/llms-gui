import { Node } from 'reactflow';
import { InputNodeData, FileLikeObject } from '../types/nodes';
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
  const { iterationItem, iterationTracking } = context;

  console.log(`[ExecuteNode ${nodeId}] (Input) Executing with context:`, context);
  console.log(`[ExecuteNode ${nodeId}] (Input) Node data:`, nodeData);
  
  // Log item types to help with debugging
  if (nodeData.items && nodeData.items.length > 0) {
    console.log(`[ExecuteNode ${nodeId}] (Input) Item types:`, 
      nodeData.items.map(item => typeof item === 'string' ? 'string' : `file: ${item.file}`));
  }

  let output: any;

  // If there's an iteration item in the context, we're inside an iteration (group or input foreach)
  if (iterationItem !== undefined) {
    output = iterationItem;
    console.log(`[ExecuteNode ${nodeId}] (Input) Using iteration item:`, output);
  } 
  // If we're not in iteration mode and iterateEachRow is true, we're at the start of a foreach execution
  // The actual iteration handling is in the executionDispatcher
  else if (nodeData.iterateEachRow) {
    // Use the items array directly, which can contain a mix of strings and FileLikeObjects
    if (nodeData.items && nodeData.items.length > 0) {
      output = nodeData.items;
      console.log(`[ExecuteNode ${nodeId}] (Input) Using ${output.length} mixed items for foreach execution`);
    }
    // For text input, convert to items by splitting on newlines if not already in items format
    else if (nodeData.inputType === 'text' && nodeData.text && (!nodeData.items || nodeData.items.length === 0)) {
      // Split text into lines, trim whitespace, and filter out empty lines
      const lines = nodeData.text.split(/\r?\n/).map(line => line.trim()).filter(line => line !== '');
      output = lines;
      console.log(`[ExecuteNode ${nodeId}] (Input) Converted text to ${lines.length} items for foreach execution`);
    } else {
      output = [];
      console.log(`[ExecuteNode ${nodeId}] (Input) No items available for foreach execution`);
    }
  }
  // Otherwise, use the node's content in the appropriate format for batch mode
  else {
    if (nodeData.inputType === 'text') {
      // For text input in batch mode, use the full text
      output = nodeData.text || '';
      console.log(`[ExecuteNode ${nodeId}] (Input) Using text content (length ${output.length}):`, 
        output.length > 100 ? output.substring(0, 100) + '...' : output);
    } else if (nodeData.items && nodeData.items.length > 0) {
      // For mixed items in batch mode, pass the entire array as is
      output = nodeData.items;
      console.log(`[ExecuteNode ${nodeId}] (Input) Using ${nodeData.items.length} mixed items as array in batch mode`);
    } else {
      output = [];
      console.log(`[ExecuteNode ${nodeId}] (Input) No items available for batch execution`);
    }
  }

  // Check if we're inside an input node's foreach loop and log iteration progress
  if (iterationTracking && iterationTracking.inputNodeId === nodeId) {
    console.log(`[ExecuteNode ${nodeId}] (Input) Foreach iteration progress: item ${iterationTracking.currentIndex + 1} of ${iterationTracking.totalItems}`);
  }

  return output;
} 