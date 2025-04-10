import { Node, Edge } from 'reactflow';
import { NodeData, NodeType, LLMNodeData, APINodeData, OutputNodeData, JSONExtractorNodeData, InputNodeData, ConditionalNodeData, MergerNodeData, WebCrawlerNodeData } from '../types/nodes';
import { ExecutionContext, NodeState, defaultNodeState, ConditionalExecutionResult } from '../types/execution';
import { resolveTemplate } from '../utils/executionUtils';
import { getIncomers } from 'reactflow';

// Import specific executors
import { executeLlmNode } from './llmExecutor';
import { executeMergerNode } from './mergerExecutor';
import { executeApiNode } from './apiExecutor';
import { executeConditionalNode } from './conditionalExecutor';
import { executeInputNode } from './inputExecutor';
import { executeOutputNode } from './outputExecutor';
import { executeJsonExtractorNode } from './jsonExtractorExecutor';
import { executeWebCrawlerNode } from './webCrawlerExecutor';

export interface DispatchParams {
  node: Node<NodeData>;
  nodes: Node<NodeData>[]; // All nodes in the flow
  edges: Edge[]; // All edges in the flow
  context: ExecutionContext;
  getNodeState: (nodeId: string) => NodeState;
  setNodeState: (nodeId: string, state: Partial<NodeState>) => void;
}

// Extended interface with optional inputs for internal use
interface InternalDispatchParams extends DispatchParams {
  _inputs?: any[]; // Internal use only for passing inputs during foreach
}

/**
 * Helper function to determine if an input should be processed in foreach mode
 */
function shouldUseForEachMode(inputs: any[]): boolean {
  // Check if first input is an array that's not empty
  return inputs.length > 0 && Array.isArray(inputs[0]) && inputs[0].length > 0;
}

/**
 * Gathers inputs for a node and dispatches execution to the appropriate node-type-specific executor.
 * Handles foreach execution when inputs are arrays.
 */
export async function dispatchNodeExecution(params: DispatchParams): Promise<any> {
  const { node, nodes, edges, context, getNodeState, setNodeState } = params;
  const nodeId = node.id;
  const { executionId, triggerNodeId } = context;
  const currentState = getNodeState(nodeId) || defaultNodeState;
  const nodeLastExecutionId = currentState.executionId;

  // --- State Reset Logic ---
  if (nodeLastExecutionId !== executionId) {
    console.log(`[Dispatch ${nodeId}] (${node.type}) New executionId (${executionId} vs ${nodeLastExecutionId}). Resetting state.`);
    setNodeState(nodeId, {
      status: 'idle',
      result: null,
      error: undefined,
      executionId: executionId,
      lastTriggerNodeId: triggerNodeId,
      // Reset conditional specific fields
      activeOutputHandle: undefined,
      conditionResult: undefined,
    });
  } else {
    console.log(`[Dispatch ${nodeId}] (${node.type}) Same executionId (${executionId}). Not resetting state.`);
  }

  console.log(`[Dispatch ${nodeId}] (${node.type}) Setting status to running for execution ${executionId}`);
  // Set running state, clearing previous conditional results but keeping executionId
  setNodeState(nodeId, { 
      status: 'running', 
      executionId, 
      activeOutputHandle: undefined, // Clear previous handle state
      conditionResult: undefined // Clear previous boolean result
  });

  // --- Input Gathering ---
  // If _inputs is provided (from a foreach iteration), use those instead of gathering from incomers
  let inputs: any[] = [];
  if ('_inputs' in params && Array.isArray((params as InternalDispatchParams)._inputs)) {
    inputs = (params as InternalDispatchParams)._inputs || [];
    console.log(`[Dispatch ${nodeId}] (${node.type}) Using provided inputs:`, inputs);
  } else {
    const incomers = getIncomers(node, nodes, edges);
    console.log(`[Dispatch ${nodeId}] (${node.type}) Getting inputs from ${incomers.length} incomers.`);
    for (const incomer of incomers) {
      const incomerState = getNodeState(incomer.id);
      
      // --- Standard Input Processing (Simplified) ---
      // Now relies on the Controller to only call dispatch for nodes on active paths
      if (incomerState?.status === 'success' && incomerState.executionId === executionId) {
        console.log(`[Dispatch ${nodeId}] Input from ${incomer.id} (ExecID ${incomerState.executionId}):`, incomerState.result);
        inputs.push(incomerState.result); // Push result directly
      } else if (incomerState?.status === 'error' && incomerState.executionId === executionId) {
        console.log(`[Dispatch ${nodeId}] Incomer ${incomer.id} had error in execution ${executionId}. Propagating error.`);
        // Set current node state to error due to dependency failure
        const errorMessage = `Dependency ${incomer.id} failed.`;
        setNodeState(nodeId, { status: 'error', error: errorMessage, executionId });
        throw new Error(errorMessage);
      } else if (incomerState?.executionId !== executionId) {
        console.log(`[Dispatch ${nodeId}] Input from ${incomer.id} skipped (Stale ExecID: ${incomerState?.executionId} vs ${executionId})`);
      } else if (incomerState?.status !== 'success') {
        console.log(`[Dispatch ${nodeId}] Input from ${incomer.id} skipped (Status: ${incomerState?.status})`);
      } else {
        // Log any other cases where input might be skipped unexpectedly
        console.log(`[Dispatch ${nodeId}] Input from ${incomer.id} skipped (State: ${JSON.stringify(incomerState)})`);
      }
    }
    console.log(`[Dispatch ${nodeId}] (${node.type}) Resolved inputs for execution ${executionId}:`, inputs);
  }

  // --- Check if we should use foreach mode ---
  const shouldProcessAsForeach = shouldUseForEachMode(inputs);
  const executionMode = shouldProcessAsForeach ? 'foreach' : 'batch';
  console.log(`[Dispatch ${nodeId}] (${node.type}) Execution mode determined: ${executionMode}`);

  // --- Handle foreach execution mode ---
  if (shouldProcessAsForeach && !context.executionMode) { // Only enter foreach mode if not already in an iteration
    const inputArray = inputs[0];
    const originalInputLength = inputArray.length;
    console.log(`[Dispatch ${nodeId}] (${node.type}) Processing ${originalInputLength} items in foreach mode`);
    
    // Collect results from each iteration
    const iterationResults = [];
    
    // Process each item in the array with a separate execution context
    for (let i = 0; i < originalInputLength; i++) {
      const item = inputArray[i];
      const itemExecutionId = `${executionId}-item-${i}`;
      
      // Create iteration-specific context
      const iterationContext: ExecutionContext = {
        ...context,
        executionId: itemExecutionId,
        executionMode: 'iteration-item',
        iterationIndex: i,
        originalInputLength,
        inputRows: inputArray,
        iterationItem: item,
        iterationTracking: {
          inputNodeId: nodeId,
          originalExecutionId: executionId,
          currentIndex: i,
          totalItems: originalInputLength
        }
      };
      
      try {
        console.log(`[Dispatch ${nodeId}] (${node.type}) Starting iteration ${i+1}/${originalInputLength} with execId ${itemExecutionId}`);
        
        // Execute the iteration with the single item as input
        // Pass the item via the internal _inputs parameter
        const iterationResult = await dispatchNodeExecution({
          node,
          nodes,
          edges,
          context: iterationContext,
          getNodeState,
          setNodeState,
          _inputs: [item] // Use internal property
        } as InternalDispatchParams);
        
        // Add metadata to result
        const resultWithMeta = {
          value: iterationResult,
          _meta: {
            index: i,
            totalItems: originalInputLength,
            executionId: itemExecutionId,
            originalExecutionId: executionId,
            source: node.type,
            sourceId: nodeId
          }
        };
        
        iterationResults.push(resultWithMeta);
        console.log(`[Dispatch ${nodeId}] (${node.type}) Completed iteration ${i+1}/${originalInputLength}`);
        
      } catch (error: any) {
        console.error(`[Dispatch ${nodeId}] (${node.type}) Error in iteration ${i+1}/${originalInputLength}:`, error);
        
        // Add error result with metadata
        iterationResults.push({
          error: error.message || 'Unknown error',
          _meta: {
            index: i,
            totalItems: originalInputLength,
            executionId: itemExecutionId,
            originalExecutionId: executionId,
            source: node.type,
            sourceId: nodeId
          }
        });
      }
    }
    
    // Set successful state with all iteration results
    console.log(`[Dispatch ${nodeId}] (${node.type}) All iterations completed. Setting success state with ${iterationResults.length} results`);
    setNodeState(nodeId, { 
      status: 'success', 
      result: iterationResults, 
      executionId,
      iterationStatus: {
        currentIndex: originalInputLength,
        totalItems: originalInputLength,
        completed: true
      }
    });
    
    return iterationResults;
  }
  
  // --- If not foreach or already in an iteration, continue with normal execution ---
  let output: any = null; // This will hold the raw output from the executor function
  
  // --- Dispatch Logic ---
  try {
    switch (node.type as NodeType) {
      case 'input': {
        output = executeInputNode({ 
          node: node as Node<InputNodeData>, 
          input: inputs.length > 0 ? inputs[0] : null,
          context 
        });
        break;
      }
      case 'llm': {
        output = await executeLlmNode({
          node: node as Node<LLMNodeData>,
          input: inputs.length > 0 ? inputs[0] : null,
          context,
          setNodeState,
          resolveTemplate
        });
        break;
      }
      case 'api': {
        output = await executeApiNode({ 
          node: node as Node<APINodeData>, 
          input: inputs.length > 0 ? inputs[0] : null,
          context, 
          setNodeState,
          resolveTemplate 
        });
        break;
      }
      case 'output': {
        output = executeOutputNode({ 
          node: node as Node<OutputNodeData>, 
          input: inputs.length > 0 ? inputs[0] : null,
          context 
        });
        break;
      }
      case 'json-extractor': {
        output = executeJsonExtractorNode({ 
          node: node as Node<JSONExtractorNodeData>, 
          input: inputs.length > 0 ? inputs[0] : null,
          context 
        });
        break;
      }
      case 'conditional': {
        // Execute and get the result object
        const conditionalResult: ConditionalExecutionResult = executeConditionalNode({ 
          node: node as Node<ConditionalNodeData>, 
          input: inputs.length > 0 ? inputs[0] : null,
          context 
        });
        // Determine boolean result for state/UI
        const conditionBooleanResult = conditionalResult.outputHandle === 'trueHandle';
        console.log(`[Dispatch ${nodeId}] (Conditional) Evaluated: ${conditionBooleanResult}, Activating handle: ${conditionalResult.outputHandle}`);
        
        // Set the comprehensive state
        setNodeState(nodeId, { 
            status: 'success', 
            result: conditionalResult.value,        // Store the passed-through value
            activeOutputHandle: conditionalResult.outputHandle, // Store which handle was chosen
            conditionResult: conditionBooleanResult, // Store the boolean result for UI
            executionId 
        });
        // The 'output' returned to the main loop should be the value that was passed through
        // The activeOutputHandle is used by the loop to determine the next node(s)
        output = conditionalResult.value; 
        // No return here, fall through to common success handling
        break; 
      }
      case 'merger': {
        output = executeMergerNode({
          node: node as Node<MergerNodeData>,
          input: inputs.length > 0 ? inputs[0] : null,
          context,
          setNodeState,
          getNodeState
        });
        break;
      }
      case 'web-crawler': {
        output = await executeWebCrawlerNode({
          node: node as Node<WebCrawlerNodeData>,
          input: inputs.length > 0 ? inputs[0] : null,
          context,
          resolveTemplate
        });
        break;
      }
      case 'group':
        console.log(`[Dispatch ${nodeId}] (Group) Node execution triggered, logic handled by executeFlowForGroup.`);
        output = getNodeState(nodeId).result || null; // Pass through result potentially set by controller
        break;
      default:
        console.warn(`[Dispatch ${nodeId}] Unknown node type: ${node.type}`);
        output = inputs.length > 0 ? inputs[0] : null; // Default pass-through
    }

    // --- Common Success Handling (excluding conditional, which sets its own state) --- 
    // Don't set state for iteration-items - their parent foreach will set the state
    if (node.type !== 'conditional' && context.executionMode !== 'iteration-item') {
        console.log(`[Dispatch ${nodeId}] (${node.type}) Setting status to success for execution ${executionId}. Result:`, output);
        setNodeState(nodeId, { status: 'success', result: output, executionId });
    }
    
    // Return the primary output value
    return output;

  } catch (error: any) {
    const errorMessage = error.message || 'Unknown error';
    console.error(`[Dispatch ${nodeId}] (${node.type}) Execution failed for execution ${executionId}:`, error);
    
    // Only set error state for main execution, not iterations (they're collected in the parent)
    if (context.executionMode !== 'iteration-item') {
      setNodeState(nodeId, { status: 'error', error: errorMessage, executionId });
    }
    
    throw error; // Re-throw to be caught by the calling function
  }
} 