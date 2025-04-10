import { Node } from 'reactflow';
import { MergerNodeData } from '../types/nodes';
import { ExecutionContext, NodeState, defaultNodeState } from '../types/execution';
import { extractValueFromNodeResult } from './executorDispatcher';
import { makeExecutionLogPrefix } from '../controller/executionDispatcher';

export function executeMergerNode(params: {
  node: Node<MergerNodeData>;
  inputs: any[];
  context: ExecutionContext;
  setNodeState: (nodeId: string, state: Partial<NodeState>) => void;
  getNodeState: (nodeId: string) => NodeState;
}): any {
  const { node, inputs, context, setNodeState, getNodeState } = params;
  const nodeId = node.id;
  const nodeData = node.data;
  const { executionId } = context;
  const currentState = getNodeState(nodeId) || defaultNodeState;
  
  // Create standardized log prefix
  const logPrefix = makeExecutionLogPrefix(node, context);
  
  // Determine if this is a new execution
  const nodeLastExecutionId = currentState.executionId;
  const needsReset = nodeLastExecutionId !== executionId;
  
  // Determine merge mode with defaults
  const mergeMode = nodeData.mergeMode || 'concat';
  const joinSeparator = nodeData.joinSeparator || ' ';
  
  console.log(`${logPrefix} Executing with mode: ${mergeMode}`);
  console.log(`${logPrefix} Execution context:`, {
    executionId,
    lastExecutionId: nodeLastExecutionId,
    needsReset,
    iterationInfo: context.iterationTracking ? {
      mode: context.iterationTracking.executionMode,
      currentIndex: context.iterationTracking.currentIndex,
      totalItems: context.iterationTracking.totalItems
    } : 'none'
  });
  
  // Log input types to help with debugging
  if (inputs.length > 0) {
    console.log(`${logPrefix} Received ${inputs.length} inputs with types:`, 
      inputs.map(input => ({
        type: Array.isArray(input) ? `array[${input.length}]` : typeof input,
        hasMetadata: typeof input === 'object' && input !== null && '_meta' in input,
        metaMode: typeof input === 'object' && input !== null && '_meta' in input ? input._meta.mode : 'none'
      }))
    );
  }

  // CRITICAL FIX: Better handling of accumulated inputs for parallel processing
  // We start with either the accumulated inputs from the current state
  // or an empty array if this is a new execution
  let accumulatedInputs: any[] = [];
  
  // If this is the same execution and we've processed before, reuse accumulated inputs
  if (!needsReset && Array.isArray(currentState.accumulatedInputs)) {
    accumulatedInputs = [...currentState.accumulatedInputs];
    console.log(`${logPrefix} Reusing ${accumulatedInputs.length} previously accumulated inputs from execution ${executionId}`);
  }
  
  // Track newly added inputs in this execution step
  const newlyAddedInputs: any[] = [];
  
  // Process each input, handling both batch and foreach modes appropriately
  for (const input of inputs) {
    if (input === undefined || input === null) {
      continue;
    }
    
    // Use the helper function to extract value and metadata consistently
    const { value, metadata } = extractValueFromNodeResult(input);
    
    // Determine input type based on extracted metadata
    const isBatchMode = metadata && metadata.mode === 'batch';
    const isForEachMode = metadata && metadata.mode === 'foreach-item';
    
    if (isBatchMode) {
      console.log(`${logPrefix} Detected input from batch mode:`, {
        metadata,
        valueType: typeof value,
        isArray: Array.isArray(value),
        itemCount: Array.isArray(value) ? value.length : 0
      });
      
      if (!Array.isArray(value)) {
        console.warn(`${logPrefix} Batch mode input value is not an array:`, value);
        // Handle non-array value as a single item
        newlyAddedInputs.push(value);
        continue;
      }
      
      // Handle empty array case
      if (value.length === 0) {
        console.log(`${logPrefix} Batch mode input has empty array`);
        continue;
      }
      
      // For batch mode, always flatten arrays
      console.log(`${logPrefix} Flattening batch array with ${value.length} items`);
      newlyAddedInputs.push(...value);
    } else if (isForEachMode) {
      // Input from foreach mode with metadata
      console.log(`${logPrefix} Detected input from foreach mode:`, { 
        metadataSource: metadata.source,
        metadataIndex: metadata.index,
        metadataExecId: metadata.executionId,
        value 
      });
      
      // For foreach mode, add the individual item with its metadata for traceability
      newlyAddedInputs.push(value);
    } else if (metadata && metadata.source === 'input-node') {
      // Generic input node with metadata but unspecified mode
      console.log(`${logPrefix} Detected input from input node with generic metadata`);
      
      // Extract the actual value
      newlyAddedInputs.push(value);
    } else if (Array.isArray(input) && input.length > 0) {
      // Legacy or untagged array input (fallback for compatibility)
      console.log(`${logPrefix} Detected legacy array input with ${input.length} items`);
      
      // Always flatten legacy arrays
      console.log(`${logPrefix} Flattening legacy array input`);
      newlyAddedInputs.push(...input);
    } else {
      // Regular input (likely from other node types)
      console.log(`${logPrefix} Adding regular input:`, input);
      newlyAddedInputs.push(input);
    }
  }
  
  // CRITICAL FIX: Merge newly added inputs with accumulated inputs
  if (newlyAddedInputs.length > 0) {
    console.log(`${logPrefix} Adding ${newlyAddedInputs.length} new inputs to existing ${accumulatedInputs.length} inputs`);
    accumulatedInputs = [...accumulatedInputs, ...newlyAddedInputs];
  }
  
  // CRITICAL FIX: Save accumulated inputs atomically to prevent race conditions 
  // in parallel processing by using a functional update pattern that atomically appends
  console.log(`${logPrefix} Updating accumulated inputs: ${accumulatedInputs.length} total`);
  
  // Save accumulated inputs for future calls
  setNodeState(nodeId, { 
    accumulatedInputs,
    executionId
  });
  
  console.log(`${logPrefix} Total accumulated inputs: ${accumulatedInputs.length}`);
  
  // Always process inputs, even if there are none
  let result: any;
  
  switch (mergeMode) {
    case 'concat':
      result = processConcatMode(accumulatedInputs);
      break;
      
    case 'join':
      result = processJoinMode(accumulatedInputs, joinSeparator);
      break;
      
    case 'object':
      result = processObjectMode(accumulatedInputs, nodeData.propertyNames);
      break;
      
    default:
      console.warn(`${logPrefix} Unknown merge mode: ${mergeMode}. Falling back to concat.`);
      result = processConcatMode(accumulatedInputs);
  }
  
  // CRITICAL FIX: Set the result field in the node state as well
  // This ensures the final result is always available even if we miss a callback
  setNodeState(nodeId, {
    result,
    status: 'success',
    executionId
  });
  
  console.log(`${logPrefix} Final result:`, {
    type: Array.isArray(result) ? `array[${result.length}]` : typeof result,
    preview: Array.isArray(result) ? 
      `[${result.slice(0, 3).map(i => JSON.stringify(i).substring(0, 30)).join(', ')}${result.length > 3 ? '...' : ''}]` :
      (typeof result === 'object' ? JSON.stringify(result).substring(0, 100) : String(result))
  });
  
  return result;
}

/**
 * Processes inputs in concat mode, creating a flattened array
 */
function processConcatMode(inputs: any[]): any[] {
  let result: any[] = [];
  
  for (const input of inputs) {
    if (Array.isArray(input)) {
      // Always flatten arrays
      result.push(...input);
    } else {
      // For other values, just add them directly
      result.push(input);
    }
  }
  
  return result;
}

/**
 * Processes inputs in join mode, converting to strings and joining
 */
function processJoinMode(inputs: any[], separator: string = ' '): string {
  // Convert each input to string and join
  const stringValues = inputs.map(input => {
    if (input === null || input === undefined) {
      return '';
    }
    
    if (typeof input === 'object') {
      if (Array.isArray(input)) {
        // For arrays, join the elements with commas
        return input.map(item => String(item)).join(', ');
      }
      try {
        // For objects, use JSON.stringify
        return JSON.stringify(input);
      } catch (e) {
        return String(input);
      }
    }
    
    return String(input);
  });
  
  return stringValues.join(separator);
}

/**
 * Processes inputs in object mode, creating an object with keys
 */
function processObjectMode(inputs: any[], propertyNames?: string[]): Record<string, any> {
  const result: Record<string, any> = {};
  
  // Process each input
  inputs.forEach((input, index) => {
    // Determine the property name
    let key: string;
    
    if (propertyNames && propertyNames[index]) {
      key = propertyNames[index];
    } else if (input && typeof input === 'object' && input._meta && input._meta.sourceId) {
      // Try to use source node ID if available
      key = `input_from_${input._meta.sourceId}`;
    } else {
      key = `input_${index + 1}`;
    }
    
    // Extract the value from input if needed
    let value = input;
    if (input && typeof input === 'object' && input._meta) {
      value = input.value;
    }
    
    // Add the property to the result object
    result[key] = value;
  });
  
  return result;
} 