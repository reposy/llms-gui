import { Node, Edge } from 'reactflow';
import { NodeData, NodeType, LLMNodeData, APINodeData, OutputNodeData, JSONExtractorNodeData, InputNodeData, ConditionalNodeData, MergerNodeData, WebCrawlerNodeData } from '../types/nodes';
import { ExecutionContext, NodeState, defaultNodeState, ConditionalExecutionResult } from '../types/execution';
import { resolveTemplate } from '../utils/executionUtils'; // Corrected path if utils moved
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

interface DispatchParams {
  node: Node<NodeData>;
  nodes: Node<NodeData>[]; // All nodes in the flow
  edges: Edge[]; // All edges in the flow
  context: ExecutionContext;
  getNodeState: (nodeId: string) => NodeState;
  setNodeState: (nodeId: string, state: Partial<NodeState>) => void;
}

/**
 * Gathers inputs for a node and dispatches execution to the appropriate node-type-specific executor.
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
  const incomers = getIncomers(node, nodes, edges);
  let inputs: any[] = [];
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

  let output: any = null; // This will hold the raw output from the executor function

  // --- Dispatch Logic ---
  try {
    switch (node.type as NodeType) {
      case 'input': {
        output = executeInputNode({ node: node as Node<InputNodeData>, inputs, context });
        break;
      }
      case 'llm': {
        output = await executeLlmNode({
          node: node as Node<LLMNodeData>,
          inputs,
          context,
          setNodeState, // Potentially needed for streaming/intermediate state
          resolveTemplate
        });
        // Conditional skip check removed, controller handles routing
        break;
      }
      case 'api': {
        output = await executeApiNode({ 
            node: node as Node<APINodeData>, 
            inputs, 
            context, 
            setNodeState, // Pass if needed
            resolveTemplate 
        });
        break;
      }
      case 'output': {
        output = executeOutputNode({ node: node as Node<OutputNodeData>, inputs, context });
        break;
      }
      case 'json-extractor': {
        output = executeJsonExtractorNode({ node: node as Node<JSONExtractorNodeData>, inputs, context });
        break;
      }
      case 'conditional': {
        // Execute and get the result object
        const conditionalResult: ConditionalExecutionResult = executeConditionalNode({ node: node as Node<ConditionalNodeData>, inputs, context });
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
          inputs,
          context,
          setNodeState,
          getNodeState
        });
        break;
      }
      case 'web-crawler': {
        output = await executeWebCrawlerNode({
          node: node as Node<WebCrawlerNodeData>,
          inputs,
          context,
          resolveTemplate
        });
        break;
      }
      case 'group':
        console.log(`[Dispatch ${nodeId}] (Group) Node execution triggered, logic handled by executeFlowForGroup.`);
        output = currentState.result; // Pass through result potentially set by controller
        break;
      default:
        console.warn(`[Dispatch ${nodeId}] Unknown node type: ${node.type}`);
        output = inputs.length > 0 ? inputs[0] : null; // Default pass-through
    }

    // --- Common Success Handling (excluding conditional, which sets its own state) --- 
    if (node.type !== 'conditional') {
        console.log(`[Dispatch ${nodeId}] (${node.type}) Setting status to success for execution ${executionId}. Result:`, output);
        setNodeState(nodeId, { status: 'success', result: output, executionId });
    }
    
    // Return the primary output value (for conditional, this is output.value)
    return output;

  } catch (error: any) {
    const errorMessage = error.message || 'Unknown error';
    console.error(`[Dispatch ${nodeId}] (${node.type}) Execution failed for execution ${executionId}:`, error);
    setNodeState(nodeId, { status: 'error', error: errorMessage, executionId });
    throw error; // Re-throw to be caught by the calling function (_executeSubgraph)
  }
} 