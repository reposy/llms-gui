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

// Extended type definition for GroupNodeData
interface ExtendedGroupNodeData extends GroupNodeData {
  iteratorConfig?: {
    path?: string;
    collectionMode?: 'all' | 'flatten' | 'first' | 'last';
    stopOnError?: boolean;
  };
  iterationConfig?: {
    path?: string;
    collectionMode?: 'all' | 'flatten' | 'first' | 'last';
    stopOnError?: boolean;
  };
}

// Extended type definition for ExecutionContext
interface ExtendedExecutionContext extends ExecutionContext {
  parentNodeId?: string;
  iterationData?: {
    item: any;
    index: number;
    total: number;
  };
}

// Extended type definition for NodeState
interface ExtendedNodeState extends NodeState {
  iterationStatus?: {
    currentIndex: number;
    totalItems: number;
    completed: boolean;
  };
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
}

/**
 * Executes a group node with iterator functionality
 * @param groupNodeId The ID of the group node to execute
 * @param inputs The inputs passed to the group node
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
    getDownstreamNodes,
    setIterationContext 
  } = dependencies;
  
  const allNodes = getNodes();
  const allEdges = getEdges();
  const groupNode = allNodes.find(n => n.id === groupNodeId) as Node<GroupNodeData>;
  
  if (!groupNode) {
    throw new Error(`Group node ${groupNodeId} not found`);
  }
  
  // Get the group's properties
  const groupData = groupNode.data;
  const isCollapsed = groupData.isCollapsed || false;
  const isIterator = !!groupData.iteratorConfig;
  
  // Find all nodes within the group
  const nodesInGroup = getNodesInGroup(groupNodeId);
  const nodeIdsInGroup = new Set(nodesInGroup.map(n => n.id));
  
  // Find internal edges (edges where both source and target are inside the group)
  const internalEdges = allEdges.filter(edge => 
    nodeIdsInGroup.has(edge.source) && nodeIdsInGroup.has(edge.target)
  );
  
  // Find the group's internal root nodes
  const rootNodesInGroup = getRootNodesFromSubset(nodesInGroup, internalEdges);
  if (rootNodesInGroup.length === 0) {
    console.warn(`[Group ${groupNodeId}] No root nodes found inside group.`);
    return []; // No root nodes, return empty result
  }
  
  // Prepare execution context for the group
  const groupExecutionId = `group-${groupNodeId}-${context.executionId}`;
  const groupContext: ExecutionContext = {
    ...context,
    executionId: groupExecutionId, // Create unique execution ID for group
    parentNodeId: groupNodeId      // Mark parent as the group node
  };
  
  // Reset states for nodes inside the group
  resetNodeStates(Array.from(nodeIdsInGroup));
  
  // Check if we need to execute in iterator mode
  if (isIterator && groupData.iteratorConfig) {
    return executeGroupIterator(
      groupNodeId, 
      rootNodesInGroup, 
      nodesInGroup, 
      internalEdges, 
      inputs, 
      groupContext, 
      dependencies
    );
  } else {
    // Non-iterator mode - simple execution
    // Get downstream nodes from root nodes
    const allDownstreamNodeIds = new Set<string>();
    rootNodesInGroup.forEach(nodeId => {
      const downstreamIds = getDownstreamNodes(nodeId, true, nodeIdsInGroup);
      downstreamIds.forEach(id => allDownstreamNodeIds.add(id));
    });
    
    // Create subgraph from the group
    const executableNodes = nodesInGroup.filter(n => allDownstreamNodeIds.has(n.id));
    console.log(`[Group ${groupNodeId}] Executing subgraph with ${executableNodes.length} nodes`);
    
    // Execute the subgraph within the group
    const results = await executeSubgraph(
      rootNodesInGroup, 
      executableNodes, 
      internalEdges, 
      groupContext,
      dependencies
    );
    
    // Get results from leaf nodes and ensure it's an array
    const leafResults = getLeafNodeResults(executableNodes, internalEdges, results);
    console.log(`[Group ${groupNodeId}] Execution complete. Leaf results:`, leafResults);
    
    // Explicitly ensure we return an array - either the array of leaf results or an array containing a single item
    return Array.isArray(leafResults) ? leafResults : [leafResults];
  }
}

/**
 * Executes a group in iterator mode over the input data
 */
async function executeGroupIterator(
  groupNodeId: string,
  rootNodeIds: string[],
  nodesInGroup: Node<NodeData>[],
  internalEdges: Edge[],
  inputs: any[],
  context: ExecutionContext,
  dependencies: GroupExecutorDependencies
): Promise<any[]> {
  const { setNodeState, setIterationContext } = dependencies;
  const groupNode = dependencies.getNodes().find(n => n.id === groupNodeId) as Node<GroupNodeData>;
  const iteratorConfig = groupNode.data.iteratorConfig!;
  
  // Extract items to iterate over from inputs based on configuration
  const iterationSource = extractIterationSource(inputs, iteratorConfig);
  
  if (!Array.isArray(iterationSource) || iterationSource.length === 0) {
    console.log(`[Group Iterator ${groupNodeId}] No items to iterate over.`);
    return [];
  }
  
  // Intermediate array to store results of each iteration
  const iterationResults: GroupExecutionItemResult[] = [];
  
  // Update group node state to indicate we're running iterations
  setNodeState(groupNodeId, { 
    status: 'success', 
    result: null,
    executionId: context.executionId,
    iterationStatus: {
      currentIndex: 0,
      totalItems: iterationSource.length,
      completed: false
    }
  });

  // Execute each item in the iteration source
  for (let i = 0; i < iterationSource.length; i++) {
    const item = iterationSource[i];
    console.log(`[Group Iterator ${groupNodeId}] Processing item ${i+1}/${iterationSource.length}:`, item);
    
    // Update iteration context
    setIterationContext({
      item,
      index: i,
      total: iterationSource.length
    });
    
    // Update group node state with current iteration
    setNodeState(groupNodeId, { 
      iterationStatus: {
        currentIndex: i,
        totalItems: iterationSource.length,
        completed: false
      }
    });
    
    // Create iteration-specific context
    const iterationContext: ExecutionContext = {
      ...context,
      executionId: `${context.executionId}-iter-${i}`,
      iterationData: {
        item,
        index: i,
        total: iterationSource.length
      }
    };
    
    try {
      // Execute the subgraph for this iteration
      const results = await executeSubgraph(
        rootNodeIds, 
        nodesInGroup, 
        internalEdges, 
        iterationContext,
        dependencies
      );
      
      // Extract leaf node results
      const leafResults = getLeafNodeResults(nodesInGroup, internalEdges, results);
      
      // Store the results for this iteration
      iterationResults.push({
        itemIndex: i,
        item,
        results: leafResults,
        success: true
      });
    } catch (error) {
      console.error(`[Group Iterator ${groupNodeId}] Error in iteration ${i}:`, error);
      
      // Store error result
      iterationResults.push({
        itemIndex: i,
        item,
        results: null,
        error: error instanceof Error ? error.message : String(error),
        success: false
      });
      
      // Decide if we should continue or abort based on iteratorConfig
      if (iteratorConfig.stopOnError) {
        console.log(`[Group Iterator ${groupNodeId}] Stopping iteration due to error and stopOnError=true`);
        break;
      }
    }
  }
  
  // Reset iteration context
  setIterationContext({});
  
  // Update group node state to indicate we're done
  setNodeState(groupNodeId, { 
    status: 'success',
    result: iterationResults,
    executionId: context.executionId,
    iterationStatus: {
      currentIndex: iterationSource.length - 1,
      totalItems: iterationSource.length,
      completed: true
    }
  });
  
  // Extract results based on configuration
  const results = extractResultsFromIterations(iterationResults, iteratorConfig);
  return results;
}

/**
 * Helper function to extract data to iterate over based on iterator configuration
 */
function extractIterationSource(
  inputs: any[], 
  iteratorConfig: NonNullable<GroupNodeData['iteratorConfig']>
): any[] {
  if (!inputs || inputs.length === 0) {
    return [];
  }
  
  const input = inputs[0]; // Always use the first input for iteration
  
  if (Array.isArray(input)) {
    return input; // If input is already an array, use it directly
  }
  
  // If input is an object and path is specified, try to extract array at path
  if (typeof input === 'object' && input !== null && iteratorConfig.path) {
    try {
      // Simple path extraction logic (could be enhanced for complex paths)
      const pathParts = iteratorConfig.path.split('.');
      let result = input;
      
      for (const part of pathParts) {
        if (result === null || result === undefined) break;
        result = result[part];
      }
      
      if (Array.isArray(result)) {
        return result;
      }
    } catch (error) {
      console.error(`Error extracting array at path ${iteratorConfig.path}:`, error);
    }
  }
  
  return []; // Default to empty array if we couldn't extract valid iteration source
}

/**
 * Extract final results from iterations based on configuration
 */
function extractResultsFromIterations(
  iterationResults: GroupExecutionItemResult[],
  iteratorConfig: NonNullable<GroupNodeData['iteratorConfig']>
): any[] {
  // Filter to successful iterations only
  const successfulResults = iterationResults.filter(r => r.success);
  
  // Extract result values based on the configuration
  const collectionMode = iteratorConfig.collectionMode || 'all';
  
  switch (collectionMode) {
    case 'all':
      // Return all results
      return successfulResults.map(r => r.results);
      
    case 'flatten':
      // Flatten array results
      return successfulResults.flatMap(r => {
        if (Array.isArray(r.results)) {
          return r.results;
        }
        return [r.results];
      });
      
    case 'first':
      // Return only the first result
      return successfulResults.length > 0 ? [successfulResults[0].results] : [];
      
    case 'last':
      // Return only the last result
      return successfulResults.length > 0 ? [successfulResults[successfulResults.length - 1].results] : [];
      
    default:
      return successfulResults.map(r => r.results);
  }
}

/**
 * Helper function to get results from leaf nodes in a subgraph
 * Returns an array of results from leaf nodes (nodes without outgoing edges)
 */
function getLeafNodeResults(
  nodes: Node<NodeData>[], 
  edges: Edge[], 
  nodeResults: Record<string, any>
): any[] {
  // Find leaf nodes (no outgoing edges)
  const leafNodeIds = nodes
    .map(n => n.id)
    .filter(id => !edges.some(e => e.source === id));
  
  console.log(`[GroupExecutor] Found ${leafNodeIds.length} leaf nodes:`, leafNodeIds);
  
  if (leafNodeIds.length === 0) {
    // If no leaf nodes, return all results as an array
    console.log(`[GroupExecutor] No leaf nodes found, returning all results`);
    return Object.values(nodeResults);
  }
  
  // Collect results from all leaf nodes
  const leafResults = leafNodeIds
    .map(id => {
      console.log(`[GroupExecutor] Getting result from leaf node ${id}:`, nodeResults[id]);
      return nodeResults[id];
    })
    .filter(r => r !== undefined);
  
  // Always return as an array for consistency
  return leafResults.length === 0 ? [] : leafResults;
}

/**
 * Executes a subgraph of nodes starting from specified root nodes.
 * Handles dependency management and parallel execution.
 * 
 * This is a simplified version of the executeSubgraph function from flowController.ts,
 * adapted for use within the group executor.
 */
async function executeSubgraph(
  startNodes: string[],
  nodesInSubgraph: Node<NodeData>[],
  edgesInSubgraph: Edge[],
  executionContext: ExecutionContext,
  dependencies: GroupExecutorDependencies
): Promise<Record<string, any>> {
  // Import the function from the main flow controller
  // In a real implementation, we'd extract the shared logic to avoid duplication
  const { executeSubgraph } = await import('./flowController');
  
  // Call the main executeSubgraph function
  return executeSubgraph(
    startNodes,
    nodesInSubgraph,
    edgesInSubgraph,
    executionContext,
    dependencies
  );
} 