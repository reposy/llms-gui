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
 * Gathers inputs for a node and dispatches execution to the appropriate node-type-specific executor.
 * StateSess execution with direct parent → child result propagation.
 */
export async function dispatchNodeExecution(params: DispatchParams): Promise<any> {
  const { node, nodes, edges, context, getNodeState, setNodeState } = params;
  const nodeId = node.id;
  const { executionId, triggerNodeId } = context;
  const currentState = getNodeState(nodeId) || defaultNodeState;
  const nodeLastExecutionId = currentState.executionId;

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
          
          // --- Standard Input Processing ---
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

      // Dispatch to appropriate node-specific executor with all gathered inputs
      let result;
      
      // Common parameters for all executors
      const commonParams = {
        context,
        setNodeState,
        getNodeState,
        resolveTemplate
      };
      
      switch (node.type) {
        case 'llm':
          result = await executeLlmNode({
            node: node as Node<LLMNodeData>,
            input: inputs,
            ...commonParams
          });
          break;
        case 'api':
          result = await executeApiNode({
            node: node as Node<APINodeData>,
            input: inputs,
            ...commonParams
          });
          break;
        case 'output':
          result = await executeOutputNode({
            node: node as Node<OutputNodeData>,
            input: inputs,
            ...commonParams
          });
          break;
        case 'conditional':
          result = await executeConditionalNode({
            node: node as Node<ConditionalNodeData>,
            input: inputs,
            ...commonParams
          });
          break;
        case 'input':
          result = await executeInputNode({
            node: node as Node<InputNodeData>,
            input: inputs,
            ...commonParams
          });
          break;
        case 'json-extractor':
          result = await executeJsonExtractorNode({
            node: node as Node<JSONExtractorNodeData>,
            input: inputs,
            ...commonParams
          });
          break;
        case 'merger':
          result = await executeMergerNode({
            node: node as Node<MergerNodeData>,
            input: inputs,
            ...commonParams
          });
          break;
        case 'web-crawler':
          result = await executeWebCrawlerNode({
            node: node as Node<WebCrawlerNodeData>,
            input: inputs,
            ...commonParams
          });
          break;
        default:
          console.log(`[Dispatch ${nodeId}] Node type "${node.type}" not implemented. Passing through inputs.`);
          // Default passthrough behavior for unknown node types
          result = inputs.length === 1 ? inputs[0] : inputs;
      }

      // Update node state with successful result unless it was already updated
      // by the specific executor (e.g., conditional nodes set their own state)
      const currentUpdatedState = getNodeState(nodeId);
      if (currentUpdatedState.status !== 'success' || currentUpdatedState.executionId !== executionId) {
        console.log(`[Dispatch ${nodeId}] (${node.type}) Setting success state with result:`, result);
        setNodeState(nodeId, { 
          status: 'success', 
          result,
          error: undefined,
          executionId
        });
      } else {
        console.log(`[Dispatch ${nodeId}] (${node.type}) Node already marked successful by executor. Not updating state.`);
      }

      // Return the result for passing to child nodes
      return result;
    } catch (error: any) {
      // Handle and propagate errors
      console.error(`[Dispatch ${nodeId}] (${node.type}) Execution error:`, error);
      
      // Update error state unless it was already updated by the executor
      setNodeState(nodeId, { 
        status: 'error', 
        error: error.message || String(error),
        executionId
      });
      
      throw error;
    } finally {
      // Remove from the execution queue regardless of outcome
      delete nodeExecutionQueue[nodeId];
    }
  };

  // Register the execution task in the queue and run it
  executionTask = executeNode();
  nodeExecutionQueue[nodeId] = executionTask;
  
  return executionTask;
}