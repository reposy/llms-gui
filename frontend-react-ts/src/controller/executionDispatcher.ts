import { Node, Edge } from 'reactflow';
import { NodeData, NodeType, InputNodeData } from '../types/nodes';
import { ExecutionContext, NodeState } from '../types/execution';
import { executeGroupNode, GroupExecutorDependencies } from './groupExecutor';
import { dispatchNodeExecution as originalDispatchNodeExecution } from '../executors/executorDispatcher';
import { v4 as uuidv4 } from 'uuid';
import { updateNode } from '../store/useFlowStructureStore';

/**
 * Dependencies required by the execution dispatcher
 */
export interface ExecutionDispatcherDependencies extends GroupExecutorDependencies {
  getNodes: () => Node<NodeData>[];
  getEdges: () => Edge[];
  getNodeState: (nodeId: string) => NodeState;
  setNodeState: (nodeId: string, state: Partial<NodeState>) => void;
}

/**
 * Dispatches execution to the appropriate executor based on node type.
 * This centralized dispatcher ensures clear separation of concerns between
 * different node type executors and provides a clean API for the flow controller.
 */
export async function dispatchNodeExecution(
  nodeId: string,
  inputs: any[],
  context: ExecutionContext,
  dependencies: ExecutionDispatcherDependencies
): Promise<any> {
  const { getNodes, getNodeState, setNodeState, getEdges } = dependencies;
  const node = getNodes().find(n => n.id === nodeId);
  
  if (!node) {
    throw new Error(`Node ${nodeId} not found.`);
  }
  
  console.log(`[ExecutionDispatcher] Dispatching execution for node ${nodeId} (${node.type})`);
  
  // Special handling for group nodes
  if (node.type === 'group') {
    console.log(`[ExecutionDispatcher] Executing group node ${nodeId} with input:`, inputs.length > 0 ? inputs[0] : null);
    
    const groupResults = await executeGroupNode(
      nodeId,
      inputs, // Pass inputs array, but the group executor will use the first item
      context,
      dependencies
    );
    
    // Set the node state with the results to ensure they're available for chaining
    dependencies.setNodeState(nodeId, {
      status: 'success',
      result: groupResults, // Store the array of results from the group's leaf nodes
      executionId: context.executionId
    });
    
    console.log(`[ExecutionDispatcher] Group node ${nodeId} execution complete. Result:`, groupResults);
    return groupResults; // Return the results for chaining to downstream nodes
  }
  
  // Special handling for Input nodes with iterateEachRow option
  if (node.type === 'input' && (node.data as InputNodeData).iterateEachRow) {
    return await handleInputNodeIteration(
      node as Node<InputNodeData>,
      context,
      dependencies
    );
  }
  
  // For other node types, use the original dispatcher from executorDispatcher.ts
  return await originalDispatchNodeExecution({
    node,
    nodes: getNodes(),
    edges: dependencies.getEdges(),
    context,
    getNodeState: dependencies.getNodeState,
    setNodeState: dependencies.setNodeState
  });
}

/**
 * Special handler for input nodes with iterateEachRow option.
 * Executes downstream nodes once for each row in the input.
 */
async function handleInputNodeIteration(
  inputNode: Node<InputNodeData>,
  context: ExecutionContext,
  dependencies: ExecutionDispatcherDependencies
): Promise<any[]> {
  const { getNodes, getEdges, getNodeState, setNodeState } = dependencies;
  const inputNodeId = inputNode.id;
  const inputData = inputNode.data;
  const { executionId } = context;
  
  // Get the items to iterate over
  const items = inputData.items || [];
  if (items.length === 0) {
    console.log(`[InputIteration ${inputNodeId}] No items to iterate over.`);
    setNodeState(inputNodeId, { 
      status: 'success', 
      result: [], 
      executionId 
    });
    return [];
  }
  
  console.log(`[InputIteration ${inputNodeId}] Starting iteration over ${items.length} items.`);
  
  // Identify direct downstream nodes
  const edges = getEdges();
  const directDownstreamNodeIds = edges
    .filter(edge => edge.source === inputNodeId)
    .map(edge => edge.target);
  
  if (directDownstreamNodeIds.length === 0) {
    console.log(`[InputIteration ${inputNodeId}] No downstream nodes to execute.`);
    setNodeState(inputNodeId, { 
      status: 'success', 
      result: items, 
      executionId 
    });
    return items;
  }
  
  // Track this iteration in the input node state
  setNodeState(inputNodeId, {
    status: 'running',
    executionId,
    iterationStatus: {
      currentIndex: 0,
      totalItems: items.length,
      completed: false
    }
  });
  
  // Update the node data to reflect the iteration status for UI using Zustand
  updateNode(inputNodeId, (node) => ({
    ...node,
    data: {
      ...node.data,
      iterationStatus: {
        currentIndex: 0,
        totalItems: items.length,
        completed: false
      }
    }
  }));
  
  // Array to store all iteration results
  const allResults: any[] = [];
  
  // Iterate over each item
  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    
    // Update iteration status in both state and node data
    setNodeState(inputNodeId, {
      iterationStatus: {
        currentIndex: index,
        totalItems: items.length,
        completed: false
      }
    });
    
    // Update node data for UI using Zustand
    updateNode(inputNodeId, (node) => ({
      ...node,
      data: {
        ...node.data,
        iterationStatus: {
          currentIndex: index,
          totalItems: items.length,
          completed: false
        }
      }
    }));
    
    console.log(`[InputIteration ${inputNodeId}] Processing item ${index + 1}/${items.length}:`, item);
    
    // Create a sub-execution context for this iteration
    const iterationContext: ExecutionContext = {
      isSubExecution: true,
      triggerNodeId: context.triggerNodeId,
      executionId: `${executionId}-item-${index}`, // Create a new unique execution ID for each iteration
      iterationItem: item,
      iterationTracking: {
        inputNodeId,
        originalExecutionId: executionId,
        currentIndex: index,
        totalItems: items.length
      }
    };
    
    // Directly execute the input node with the iteration context to get a single item result
    await originalDispatchNodeExecution({
      node: inputNode,
      nodes: getNodes(),
      edges,
      context: iterationContext,
      getNodeState,
      setNodeState
    });
    
    // For each direct downstream node, execute it with the iteration context
    for (const downstreamNodeId of directDownstreamNodeIds) {
      try {
        // Use the iteration context to pass the current item
        const result = await dispatchNodeExecution(
          downstreamNodeId,
          [item], // Pass the current item as input
          iterationContext,
          dependencies
        );
        
        // If this is the last downstream node in the chain, collect its result
        // Logic to identify "leaf" nodes may need to be more sophisticated
        if (result !== undefined) {
          allResults.push(result);
        }
      } catch (error) {
        console.error(`[InputIteration ${inputNodeId}] Error processing item ${index} for node ${downstreamNodeId}:`, error);
        // Add error to results or handle as needed
      }
    }
  }
  
  // Update input node state with the final results
  setNodeState(inputNodeId, {
    status: 'success',
    result: allResults, // Store all collected results
    executionId,
    iterationStatus: {
      currentIndex: items.length,
      totalItems: items.length,
      completed: true
    }
  });
  
  // Update node data for UI using Zustand
  updateNode(inputNodeId, (node) => ({
    ...node,
    data: {
      ...node.data,
      iterationStatus: {
        currentIndex: items.length,
        totalItems: items.length,
        completed: true
      }
    }
  }));
  
  console.log(`[InputIteration ${inputNodeId}] Iteration complete. Collected ${allResults.length} results.`);
  return allResults;
}

/**
 * Determines if a node type requires special execution handling
 */
export function requiresSpecialExecution(nodeType: NodeType): boolean {
  // Group nodes and Input nodes with iterateEachRow may require special handling
  return nodeType === 'group' || nodeType === 'input';
}

/**
 * Gets upstream node results from the execution context
 */
export function getUpstreamResults(
  nodeId: string,
  nodes: Node<NodeData>[],
  edges: Edge[],
  nodeResults: Record<string, any>
): any[] {
  // Find incoming edges to this node
  const incomingEdges = edges.filter(e => e.target === nodeId);
  
  // Get results from source nodes
  return incomingEdges.map(edge => {
    const sourceId = edge.source;
    return nodeResults[sourceId];
  }).filter(result => result !== undefined);
} 