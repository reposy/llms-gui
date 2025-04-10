import { Node, Edge } from 'reactflow';
import { NodeData, NodeType, LLMNodeData, APINodeData, OutputNodeData, JSONExtractorNodeData, InputNodeData, ConditionalNodeData, MergerNodeData, WebCrawlerNodeData } from '../types/nodes';
import { ExecutionContext, NodeState, defaultNodeState, ConditionalExecutionResult } from '../types/execution';
import { resolveTemplate } from '../utils/executionUtils';
import { getIncomers } from 'reactflow';
import { v4 as uuidv4 } from 'uuid';
import { getNodeContent, InputNodeContent } from '../store/useNodeContentStore';

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

// Internal params that can include pre-supplied inputs
export interface InternalDispatchParams extends DispatchParams {
  _inputs?: any[];
  status?: string;
}

// Queue to track running node executions
// This allows us to wait for previous executions to complete instead of skipping them
const nodeExecutionQueue: Record<string, Promise<any>> = {};

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

  // Ensure executionMode is always properly initialized in the context
  if (!context.executionMode) {
    // Check if this is an input node - if so, get latest config from content store
    if (node.type === 'input') {
      // Get the latest execution settings from node content store
      const nodeContent = getNodeContent(nodeId) as InputNodeContent;
      
      // Prioritize the executionMode from content store (set by UI)
      if (nodeContent.executionMode) {
        context.executionMode = nodeContent.executionMode;
        console.log(`[Dispatch ${nodeId}] (${node.type}) Setting executionMode to '${context.executionMode}' from node content store`);
        
        // Also sync iterateEachRow for consistency
        if (context.executionMode === 'foreach' && !(node.data as InputNodeData).iterateEachRow) {
          console.log(`[Dispatch ${nodeId}] (${node.type}) Syncing iterateEachRow=true based on executionMode=${context.executionMode}`);
          (node.data as InputNodeData).iterateEachRow = true;
        }
      }
      // Fall back to iterateEachRow if executionMode isn't set
      else if (nodeContent.iterateEachRow || (node.data as InputNodeData).iterateEachRow) {
        context.executionMode = 'foreach';
        console.log(`[Dispatch ${nodeId}] (${node.type}) Setting executionMode to 'foreach' based on iterateEachRow=true from content store`);
      } 
      // Last resort - use node.data.executionMode if available
      else if ((node.data as InputNodeData).executionMode) {
        context.executionMode = (node.data as InputNodeData).executionMode;
        console.log(`[Dispatch ${nodeId}] (${node.type}) Setting executionMode to '${context.executionMode}' from node.data`);
      }
      else {
        // Default to batch mode if all checks fail
        context.executionMode = 'batch';
        console.log(`[Dispatch ${nodeId}] (${node.type}) No stored execution mode found, defaulting to 'batch'`);
      }
    } else {
      // Default to batch mode for other nodes
      context.executionMode = 'batch';
      console.log(`[Dispatch ${nodeId}] (${node.type}) Setting default executionMode to 'batch' for non-input node`);
    }
  } else {
    console.log(`[Dispatch ${nodeId}] (${node.type}) Using provided execution mode: ${context.executionMode}`);
  }

  // Check if node is already executing and wait for it to complete if needed
  if (currentState.status === 'running' && nodeId in nodeExecutionQueue) {
    console.log(`[Dispatch ${nodeId}] (${node.type}) Node already running, waiting for completion...`);
    try {
      // Wait for the current execution to complete before proceeding
      const previousResult = await nodeExecutionQueue[nodeId];
      console.log(`[Dispatch ${nodeId}] (${node.type}) Previous execution completed. Result:`, previousResult);
      return previousResult;
    } catch (error) {
      console.error(`[Dispatch ${nodeId}] (${node.type}) Previous execution failed:`, error);
      // We'll continue with a new execution anyway
    }
  }

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

  // Initialize execution task
  let executionTask: Promise<any>;
  
  // Create the execution task function
  const executeNode = async () => {
    try {
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

      // Auto-detect execution mode if not set
      if (!context.executionMode && inputs.length > 0) {
        if (Array.isArray(inputs[0]) && inputs[0].length > 0) {
          // Automatically set batch mode if we receive array input
          if (node.type === 'input' && (node.data as InputNodeData).iterateEachRow) {
            console.log(`[Dispatch ${nodeId}] (${node.type}) Detected array input with iterateEachRow=true, setting foreach mode`);
            context.executionMode = 'foreach' as const;
          } else {
            console.log(`[Dispatch ${nodeId}] (${node.type}) Detected array input, setting batch mode`);
            context.executionMode = 'batch' as const;
          }
        } else {
          console.log(`[Dispatch ${nodeId}] (${node.type}) No array input detected, using standard processing`);
        }
      }

      // Log current execution mode after detection
      console.log(`[Dispatch ${nodeId}] (${node.type}) Using execution mode: ${context.executionMode || 'standard'}`);

      // --- Input Handling and Foreach Logic ---
      // Check if we should process this node as foreach
      let shouldProcessAsForeach = false;
      
      if (node.type === 'input') {
        // For input nodes, check content store first to get the most up-to-date settings
        const nodeContent = getNodeContent(nodeId) as InputNodeContent;
        shouldProcessAsForeach = (
          // Context-level foreach mode
          context.executionMode === 'foreach' ||
          // Node data foreach mode
          (node.data as InputNodeData).iterateEachRow === true || 
          (node.data as InputNodeData).executionMode === 'foreach' ||
          // Content store foreach mode (most reliable, set by UI)
          nodeContent.executionMode === 'foreach' ||
          nodeContent.iterateEachRow === true
        ) && inputs.length > 0 && Array.isArray(inputs[0]);
        
        // Provide detailed logging about the foreach decision
        console.log(`[Dispatch ${nodeId}] (${node.type}) Foreach detection:`, {
          contextMode: context.executionMode,
          nodeDataIterateEachRow: (node.data as InputNodeData).iterateEachRow,
          nodeDataExecutionMode: (node.data as InputNodeData).executionMode,
          contentStoreExecutionMode: nodeContent.executionMode,
          contentStoreIterateEachRow: nodeContent.iterateEachRow,
          hasArray: inputs.length > 0 && Array.isArray(inputs[0]),
          decision: shouldProcessAsForeach
        });
      } else {
        // For non-input nodes, use simpler logic
        shouldProcessAsForeach = context.executionMode === 'foreach' && 
          inputs.length > 0 && Array.isArray(inputs[0]);
      }
      
      console.log(`[Dispatch ${nodeId}] (${node.type}) Should process as foreach? ${shouldProcessAsForeach}`);

      if (shouldProcessAsForeach) {
        console.log(
          `[Dispatch ${nodeId}] Processing in FOREACH mode with ${inputs[0].length} items`
        );

        const inputArray = inputs[0];
        const results = [];

        // Process each item in the array
        for (let itemIndex = 0; itemIndex < inputArray.length; itemIndex++) {
          // Create a new execution context for this item
          const itemContext: ExecutionContext = {
            ...context,
            executionMode: 'iteration-item' as const, // Mark this as an individual iteration
            iterationIndex: itemIndex,
            iterationItem: inputArray[itemIndex],
          };

          // Execute this node with the single item
          const itemResult = await dispatchNodeExecution({
            node,
            nodes,
            edges,
            inputs: [inputArray[itemIndex]], // Single item, not an array of items
            context: itemContext,
            getNodeState,
            setNodeState,
          } as InternalDispatchParams);

          // Check for execution error in any of the items
          if (itemResult.error) {
            return itemResult; // Stop processing on first error
          }

          results.push(itemResult.result);
        }

        // Set success and return the collected results
        return {
          error: false,
          result: results,
        };
      }

      // --- State Management ---
      // Set inputRows for batch mode to support {{input}} resolution with full array
      if ((context.executionMode === 'batch' || !context.executionMode) && inputs.length > 0) {
        // If executionMode is not set but we have array inputs, treat as batch mode
        if (!context.executionMode && (
          (Array.isArray(inputs[0]) && inputs[0].length > 0) || 
          (inputs.length > 1)
        )) {
          console.log(`[Dispatch ${nodeId}] (${node.type}) Setting batch mode based on input structure`);
          context.executionMode = 'batch' as const;
        }

        // Only process if we're in batch mode now
        if (context.executionMode === 'batch') {
          // If first input is an array, use it as inputRows
          if (Array.isArray(inputs[0])) {
            context.inputRows = inputs[0];
            console.log(`[Dispatch ${nodeId}] (${node.type}) Set inputRows from array input (${inputs[0].length} items)`);
          } else {
            // Otherwise, use the entire inputs array as inputRows
            context.inputRows = inputs;
            console.log(`[Dispatch ${nodeId}] (${node.type}) Set inputRows from inputs array (${inputs.length} items)`);
          }
          
          console.log(`[Dispatch ${nodeId}] (${node.type}) Batch mode active. InputRows:`, context.inputRows);
        }
      }

      // --- If not foreach or already in an iteration, continue with normal execution ---
      let output: any = null; // This will hold the raw output from the executor function
      
      // --- Dispatch Logic ---
      try {
        // Handle input differently based on execution mode
        let input = null;
        if (inputs.length > 0) {
          // Priority 1: For iteration-item mode, use context.iterationItem if available
          if (context.executionMode === 'iteration-item' && context.iterationItem !== undefined) {
            input = context.iterationItem;
            console.log(`[Dispatch ${nodeId}] (${node.type}) Using iterationItem directly from context for iteration-item mode:`, input);
          }
          // For Input nodes, special handling for arrays
          else if (node.type === 'input' && Array.isArray(inputs[0])) {
            // Input nodes can still receive arrays for batch processing
            input = inputs[0];
          } else if (context.executionMode === 'batch') {
            // In batch mode, preserve the full array input
            if (Array.isArray(inputs[0])) {
              input = inputs[0]; // If inputs[0] is already an array, use it
              console.log(`[Dispatch ${nodeId}] (${node.type}) Using array from inputs[0] for batch mode with ${inputs[0].length} items`);
            } else {
              input = inputs; // Otherwise, use the entire inputs array
              console.log(`[Dispatch ${nodeId}] (${node.type}) Using entire inputs array for batch mode with ${inputs.length} items`);
            }
          } else if (Array.isArray(inputs[0])) {
            // For non-batch modes, unwrap arrays to get a single item
            console.log(`[Dispatch ${nodeId}] (${node.type}) Unwrapping array input to single item`);
            input = inputs[0].length > 0 ? inputs[0][0] : null;
          } else {
            // Regular case - just use the first input directly
            input = inputs[0];
          }
        }
        // Even if inputs array is empty, use iterationItem if available in iteration-item mode
        else if (context.executionMode === 'iteration-item' && context.iterationItem !== undefined) {
          input = context.iterationItem;
          console.log(`[Dispatch ${nodeId}] (${node.type}) Using iterationItem from context with empty inputs:`, input);
        }
        
        // Log what input is being sent to the executor
        console.log(`[Dispatch ${nodeId}] (${node.type}) Executing with input:`, input);
        console.log(`[Dispatch ${nodeId}] (${node.type}) Execution mode: ${context.executionMode}`);
        if (Array.isArray(input)) {
          console.log(`[Dispatch ${nodeId}] (${node.type}) Input is an array with ${input.length} items`);
        }

        switch (node.type as NodeType) {
          case 'input': {
            output = executeInputNode({ 
              node: node as Node<InputNodeData>, 
              input,
              context 
            });
            break;
          }
          case 'llm': {
            output = await executeLlmNode({
              node: node as Node<LLMNodeData>,
              input,
              context,
              setNodeState,
              resolveTemplate
            });
            break;
          }
          case 'api': {
            output = await executeApiNode({ 
              node: node as Node<APINodeData>, 
              input,
              context, 
              setNodeState,
              resolveTemplate 
            });
            break;
          }
          case 'output': {
            output = executeOutputNode({ 
              node: node as Node<OutputNodeData>, 
              input,
              context 
            });
            break;
          }
          case 'json-extractor': {
            output = executeJsonExtractorNode({ 
              node: node as Node<JSONExtractorNodeData>, 
              input,
              context 
            });
            break;
          }
          case 'conditional': {
            // Execute and get the result object
            const conditionalResult: ConditionalExecutionResult = executeConditionalNode({ 
              node: node as Node<ConditionalNodeData>, 
              input,
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
              input,
              context,
              setNodeState,
              getNodeState
            });
            break;
          }
          case 'web-crawler': {
            output = await executeWebCrawlerNode({
              node: node as Node<WebCrawlerNodeData>,
              input,
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
    } finally {
      // Remove the task from the queue when done
      if (nodeExecutionQueue[nodeId] === executionTask) {
        delete nodeExecutionQueue[nodeId];
        console.log(`[Dispatch ${nodeId}] (${node.type}) Removed node from execution queue`);
      }
    }
  };
  
  // Assign the execution task
  executionTask = executeNode();
  
  // Store the execution task in the queue
  nodeExecutionQueue[nodeId] = executionTask;
  
  // Wait for the task to complete and return its result
  return executionTask;
} 