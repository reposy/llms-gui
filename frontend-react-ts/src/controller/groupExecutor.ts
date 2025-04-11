import { Edge, Node } from 'reactflow';
import { NodeData, GroupNodeData } from '../types/nodes';
import { ExecutionContext, NodeState } from '../types/execution';
import { getRootNodesFromSubset } from '../utils/executionUtils';

// Define missing interfaces
export interface GroupExecutionItemResult {
  item: any;
  index: number;
  itemIndex?: number; // Support both naming styles
  results: any;
  success: boolean;
  error?: string;
}

// Re-use the FlowControllerDependencies interface from flowController.ts
export interface GroupExecutorDependencies {
  getNodes: () => Node<NodeData>[];
  getEdges: () => Edge[];
  getNodeState: (nodeId: string) => NodeState;
  setNodeState: (nodeId: string, state: Partial<NodeState>) => void;
  resetNodeStates: (nodeIds?: string[]) => void;
  getDownstreamNodes: (nodeId: string, includeStartNode: boolean, subsetNodeIds?: Set<string>) => string[];
  getNodesInGroup: (groupId: string) => Node<NodeData>[];
  setIsExecuting: (isExecuting: boolean) => void;
  setCurrentExecutionId: (executionId?: string) => void;
  setIterationContext: (context: { item?: any; index?: number; total?: number }) => void;
  dispatchNodeExecution: (nodeId: string, inputs: any[], context: ExecutionContext, dependencies: any) => Promise<any>;
}

/**
 * Executes a group node with new stateless execution model
 * @param groupNodeId The ID of the group node to execute
 * @param inputs The inputs passed to the group node (first input will be used)
 * @param context The execution context
 * @param dependencies The flow controller dependencies
 * @returns An array of results from the group execution
 */
export async function executeGroupNode(
  groupNodeId: string,
  inputs: any[],
  context: ExecutionContext,
  dependencies: GroupExecutorDependencies
): Promise<any[]> {
  const { 
    getNodes, 
    getEdges, 
    getNodeState, 
    setNodeState, 
    resetNodeStates, 
    getNodesInGroup,
    getDownstreamNodes
  } = dependencies;
  
  const allNodes = getNodes();
  const allEdges = getEdges();
  const groupNode = allNodes.find(n => n.id === groupNodeId) as Node<GroupNodeData>;
  
  if (!groupNode) {
    throw new Error(`Group node ${groupNodeId} not found`);
  }
  
  // Get the group's properties
  const groupData = groupNode.data;
  
  // Extract single input (new model uses first input from the array)
  const input = inputs.length > 0 ? inputs[0] : null;
  console.log(`[Group ${groupNodeId}] Received input:`, input);
  
  // Find all nodes within the group
  const nodesInGroup = getNodesInGroup(groupNodeId);
  const nodeIdsInGroup = new Set(nodesInGroup.map(n => n.id));
  
  // Find internal edges (edges where both source and target are inside the group)
  const internalEdges = allEdges.filter(edge => 
    nodeIdsInGroup.has(edge.source) && nodeIdsInGroup.has(edge.target)
  );
  
  // Find the group's internal root nodes (nodes without incoming edges in this group)
  const rootNodesInGroup = getRootNodesFromSubset(nodesInGroup, internalEdges);
  if (rootNodesInGroup.length === 0) {
    console.warn(`[Group ${groupNodeId}] No root nodes found inside group.`);
    return []; // No root nodes, return empty result
  }
  
  console.log(`[Group ${groupNodeId}] Found ${rootNodesInGroup.length} root nodes: [${rootNodesInGroup.join(', ')}]`);
  
  // Prepare execution context for the group
  const groupExecutionId = `group-${groupNodeId}-${context.executionId}`;
  const groupContext: ExecutionContext = {
    ...context,
    executionId: groupExecutionId // Create unique execution ID for group
  };
  
  // Add a console log to track the context
  console.log(`[Group ${groupNodeId}] Created group execution context:`, groupContext);
  
  // Reset states for nodes inside the group before execution
  resetNodeStates(Array.from(nodeIdsInGroup));
  
  // Get all downstream nodes from root nodes (the executable subgraph)
  const allDownstreamNodeIds = new Set<string>();
  rootNodesInGroup.forEach(nodeId => {
    const downstreamIds = getDownstreamNodes(nodeId, true, nodeIdsInGroup);
    downstreamIds.forEach(id => allDownstreamNodeIds.add(id));
  });
  
  // Create subgraph from the group
  const executableNodes = nodesInGroup.filter(n => allDownstreamNodeIds.has(n.id));
  console.log(`[Group ${groupNodeId}] Executing subgraph with ${executableNodes.length} nodes`);
  
  // Execute each root node with the input from the left handle
  const rootResults = [];
  for (const rootNodeId of rootNodesInGroup) {
    try {
      console.log(`[Group ${groupNodeId}] Injecting input into root node ${rootNodeId}`);
      
      // Dispatch the execution to the root node with the input
      const rootResult = await dependencies.dispatchNodeExecution(
        rootNodeId,
        [input], // Pass the input as an array with a single item
        groupContext,
        dependencies
      );
      
      rootResults.push({
        nodeId: rootNodeId,
        result: rootResult
      });
      
    } catch (error) {
      console.error(`[Group ${groupNodeId}] Error executing root node ${rootNodeId}:`, error);
      throw error; // Re-throw to stop group execution
    }
  }
  
  // Get a map of all node results from executing the subgraph
  const nodeResultsMap: Record<string, any> = {};
  rootResults.forEach(result => {
    nodeResultsMap[result.nodeId] = result.result;
  });
  
  // Get results from leaf nodes (nodes without outgoing edges in the group)
  const leafNodes = nodesInGroup.filter(n => !internalEdges.some(e => e.source === n.id));
  if (leafNodes.length === 0) {
    console.log(`[Group ${groupNodeId}] No leaf nodes found, using results from root nodes`);
    return rootResults.map(r => r.result);
  }
  
  // Collect results from the leaf nodes
  const leafResults = leafNodes
    .map(node => {
      const nodeState = getNodeState(node.id);
      return nodeState?.status === 'success' && nodeState?.executionId === groupExecutionId
        ? nodeState.result
        : undefined;
    })
    .filter(result => result !== undefined);
  
  console.log(`[Group ${groupNodeId}] Execution complete. Leaf results:`, leafResults);
  
  // Return the leaf results or an empty array if none were found
  return leafResults.length > 0 ? leafResults : [];
} 