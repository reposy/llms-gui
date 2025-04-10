import { Node } from 'reactflow';
import { MergerNodeData } from '../types/nodes';
import { ExecutionContext, NodeState, defaultNodeState } from '../types/execution';

// Extend the NodeState to include accumulated inputs for merger nodes
interface MergerNodeState extends NodeState {
  accumulatedInputs?: any[];
}

/**
 * Executes a Merger node.
 * In the stateless execution model, this accepts a single input per execution
 * but accumulates all inputs in the node state for the current execution ID.
 * 
 * @param params The execution parameters
 * @returns The merged result based on the configured merge mode
 */
export function executeMergerNode(params: {
  node: Node<MergerNodeData>;
  input: any;
  context: ExecutionContext;
  setNodeState: (nodeId: string, state: Partial<NodeState>) => void;
  getNodeState: (nodeId: string) => NodeState;
}): any {
  const { node, input, context, setNodeState, getNodeState } = params;
  const nodeId = node.id;
  const nodeData = node.data;
  const { executionId } = context;
  const currentState = getNodeState(nodeId) || defaultNodeState;
  
  // Determine if this is a new execution
  const nodeLastExecutionId = currentState.executionId;
  const needsReset = nodeLastExecutionId !== executionId;
  
  // Determine merge mode with defaults
  const mergeMode = nodeData.mergeMode || 'concat';
  const joinSeparator = nodeData.joinSeparator || ' ';
  const arrayStrategy = nodeData.arrayStrategy || 'flatten';
  const waitForAll = nodeData.waitForAll === undefined ? true : nodeData.waitForAll;
  
  console.log(`[MergerExecutor] (${nodeId}) Executing with mode: ${mergeMode}, executionId: ${executionId}`);
  console.log(`[MergerExecutor] (${nodeId}) Input:`, input);

  // Prepare storage for accumulated inputs
  let accumulatedInputs: any[] = [];
  
  // If this is the same execution and we've processed before, reuse accumulated inputs
  if (!needsReset && Array.isArray((currentState as MergerNodeState).accumulatedInputs)) {
    accumulatedInputs = [...(currentState as MergerNodeState).accumulatedInputs!];
    console.log(`[MergerExecutor] (${nodeId}) Reusing ${accumulatedInputs.length} previously accumulated inputs from execution ${executionId}`);
  } else if (needsReset) {
    console.log(`[MergerExecutor] (${nodeId}) New execution detected (${executionId} vs ${nodeLastExecutionId}), resetting accumulated inputs`);
  }
  
  // Add current input if not null/undefined
  if (input !== undefined && input !== null) {
    accumulatedInputs.push(input);
    console.log(`[MergerExecutor] (${nodeId}) Added new input to accumulated inputs (now ${accumulatedInputs.length})`);
  }
  
  // Add custom items if configured
  if (nodeData.items && nodeData.items.length > 0) {
    for (const item of nodeData.items) {
      if (item !== undefined && item !== null) {
        accumulatedInputs.push(item);
      }
    }
    console.log(`[MergerExecutor] (${nodeId}) Added ${nodeData.items.length} custom items`);
  }
  
  // Save accumulated inputs for future calls (in case not all inputs are ready yet)
  setNodeState(nodeId, { 
    accumulatedInputs, // This is safely typed now because NodeState is structural
    executionId
  } as Partial<MergerNodeState>);
  
  console.log(`[MergerExecutor] (${nodeId}) Total accumulated inputs: ${accumulatedInputs.length}`);
  
  // If we're waiting for all inputs and we don't have any yet, return null
  if (waitForAll && accumulatedInputs.length === 0) {
    console.log(`[MergerExecutor] (${nodeId}) No inputs available and waiting mode is enabled. Returning null.`);
    return null;
  }
  
  // Process based on merge mode
  let result: any;
  
  switch (mergeMode) {
    case 'concat':
      result = processConcatMode(accumulatedInputs, arrayStrategy);
      break;
      
    case 'join':
      result = processJoinMode(accumulatedInputs, joinSeparator);
      break;
      
    case 'object':
      result = processObjectMode(accumulatedInputs, nodeData.propertyNames);
      break;
      
    default:
      console.warn(`[MergerExecutor] (${nodeId}) Unknown merge mode: ${mergeMode}. Falling back to concat.`);
      result = processConcatMode(accumulatedInputs, arrayStrategy);
  }
  
  console.log(`[MergerExecutor] (${nodeId}) Final merged result:`, result);
  return result;
}

/**
 * Processes inputs in concat mode, creating an array
 */
function processConcatMode(inputs: any[], arrayStrategy: 'flatten' | 'preserve' = 'flatten'): any[] {
  let result: any[] = [];
  
  for (const input of inputs) {
    if (Array.isArray(input)) {
      // For arrays, either flatten or preserve based on strategy
      if (arrayStrategy === 'flatten') {
        result.push(...input);
      } else {
        result.push(input);
      }
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
    } else if (input && input._meta && input._meta.sourceId) {
      // Try to use source node ID if available
      key = `input_from_${input._meta.sourceId}`;
    } else {
      key = `input_${index + 1}`;
    }
    
    // Add to result object
    result[key] = input;
  });
  
  return result;
} 