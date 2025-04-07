import { Node, Edge } from 'reactflow';
import { NodeData, NodeType } from '../types/nodes';
import { ExecutionContext, NodeState } from '../types/execution';
import { executeGroupNode, GroupExecutorDependencies } from './groupExecutor';
import { dispatchNodeExecution as originalDispatchNodeExecution } from '../executors/executorDispatcher';

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
  const { getNodes, getNodeState } = dependencies;
  const node = getNodes().find(n => n.id === nodeId);
  
  if (!node) {
    throw new Error(`Node ${nodeId} not found.`);
  }
  
  console.log(`[ExecutionDispatcher] Dispatching execution for node ${nodeId} (${node.type})`);
  
  // Special handling for group nodes
  if (node.type === 'group') {
    const groupResults = await executeGroupNode(
      nodeId,
      inputs,
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
 * Determines if a node type requires special execution handling
 */
export function requiresSpecialExecution(nodeType: NodeType): boolean {
  // Currently only group nodes require special handling
  return nodeType === 'group';
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