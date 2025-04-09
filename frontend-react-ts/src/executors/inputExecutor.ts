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
  const nodeData = node.data as InputNodeData;
  const { executionId, iterationItem, iterationTracking } = context;
  
  console.log(`[ExecuteNode ${nodeId}] (Input) Executing with context:`, context);
  
  // Determine the execution mode and prepare output
  let output: any;
  let executionMode: 'batch' | 'foreach' | 'iteration-item';
  
  // CASE 1: If there's an iteration item in the context, we're inside an iteration
  // This means we're processing a single item from an iteration (group or input foreach)
  if (iterationItem !== undefined) {
    executionMode = 'iteration-item';
    output = iterationItem;
    
    // Add item index metadata to help with tracking
    if (iterationTracking) {
      output = {
        value: iterationItem,
        _meta: {
          index: iterationTracking.currentIndex,
          totalItems: iterationTracking.totalItems,
          executionId: executionId,
          originalExecutionId: iterationTracking.originalExecutionId,
          source: 'input-node',
          sourceId: nodeId
        }
      };
    }
    
    console.log(`[ExecuteNode ${nodeId}] (Input) Using iteration item with mode '${executionMode}':`, output);
  } 
  // CASE 2: If iterateEachRow is true, we're at the start of a foreach execution
  // The actual iteration handling is done in the executionDispatcher
  else if (nodeData.iterateEachRow) {
    executionMode = 'foreach';
    const items: any[] = [];
    
    // Use the items array directly if available
    if (nodeData.items && nodeData.items.length > 0) {
      items.push(...nodeData.items);
      console.log(`[ExecuteNode ${nodeId}] (Input) Using ${items.length} mixed items for foreach execution`);
    }
    // Otherwise, for text input, convert to items by splitting on newlines
    else if (nodeData.inputType === 'text' && nodeData.text && (!nodeData.items || nodeData.items.length === 0)) {
      // Split text into lines, trim whitespace, and filter out empty lines
      const lines = nodeData.text.split(/\r?\n/).map(line => line.trim()).filter(line => line !== '');
      items.push(...lines);
      console.log(`[ExecuteNode ${nodeId}] (Input) Converted text to ${lines.length} items for foreach execution`);
    }
    
    // Add metadata to each item to enable tracking
    output = items.map((item, index) => ({
      value: item,
      _meta: {
        index,
        totalItems: items.length,
        executionId: `${executionId}-item-${index}`,
        originalExecutionId: executionId,
        source: 'input-node',
        sourceId: nodeId
      }
    }));
    
    console.log(`[ExecuteNode ${nodeId}] (Input) Using mode '${executionMode}' with ${output.length} items`);
  }
  // CASE 3: Otherwise, use the node's content in the appropriate format for batch mode
  else {
    executionMode = 'batch';
    
    if (nodeData.inputType === 'text') {
      // For text input in batch mode, use the full text
      output = nodeData.text || '';
      console.log(`[ExecuteNode ${nodeId}] (Input) Using text content with mode '${executionMode}' (length ${output.length})`);
    } else if (nodeData.items && nodeData.items.length > 0) {
      // For mixed items in batch mode, pass the entire array as is
      output = nodeData.items;
      console.log(`[ExecuteNode ${nodeId}] (Input) Using ${nodeData.items.length} mixed items as array with mode '${executionMode}'`);
    } else {
      output = [];
      console.log(`[ExecuteNode ${nodeId}] (Input) No items available for batch execution`);
    }
    
    // Add execution metadata to batch output
    if (typeof output === 'object') {
      output = {
        value: output,
        _meta: {
          executionId,
          mode: 'batch',
          source: 'input-node',
          sourceId: nodeId
        }
      };
    }
  }

  // Check if we're inside an input node's foreach loop and log iteration progress
  if (iterationTracking && iterationTracking.inputNodeId === nodeId) {
    console.log(`[ExecuteNode ${nodeId}] (Input) Foreach iteration progress: item ${iterationTracking.currentIndex + 1} of ${iterationTracking.totalItems}`);
  }

  return output;
} 