import { Edge, Node } from 'reactflow';
import { NodeData } from '../types/nodes';
import { dispatchNodeExecution } from '../executors/executorDispatcher';
import { v4 as uuidv4 } from 'uuid';
import { ExecutionContext } from '../types/execution';

// Define the dependencies interface for flow controller functions
export interface FlowControllerDependencies {
  getNodes: () => Node<NodeData>[];
  getEdges: () => Edge[];
  getNodeState: (nodeId: string) => any;
  setNodeState: (nodeId: string, state: any) => void;
  resetNodeStates: (nodeIds?: string[]) => void;
  getDownstreamNodes: (nodeId: string) => string[];
  getNodesInGroup: (groupId: string) => Node<NodeData>[];
  setIsExecuting: (isExecuting: boolean) => void;
  setCurrentExecutionId: (executionId?: string) => void;
  setIterationContext: (context: { item?: any; index?: number; total?: number }) => void;
}

/**
 * Execute a flow starting from a specific node
 * 
 * @param startNodeId ID of the node to start execution from
 * @param dependencies Dependencies needed for execution
 * @returns Promise that resolves when execution is complete
 */
export async function executeFlow(
  startNodeId: string,
  dependencies: FlowControllerDependencies
): Promise<void> {
  const { 
    getNodes, 
    getEdges, 
    setNodeState, 
    resetNodeStates, 
    setIsExecuting, 
    getDownstreamNodes,
    setCurrentExecutionId 
  } = dependencies;
  
  try {
    console.log(`[FlowController] Executing flow from node ${startNodeId}`);
    
    // Reset all downstream nodes
    const downstreamNodeIds = getDownstreamNodes(startNodeId);
    resetNodeStates([startNodeId, ...downstreamNodeIds]);
    
    // Get the start node
    const nodes = getNodes();
    const startNode = nodes.find(node => node.id === startNodeId);
    
    if (!startNode) {
      throw new Error(`Start node ${startNodeId} not found`);
    }
    
    // Create execution context
    const executionId = `exec-${uuidv4()}`;
    const executionContext: ExecutionContext = {
      executionId,
      triggerNodeId: startNodeId,
    };
    
    console.log(`[FlowExecution ${executionId}] Starting execution for node ${startNodeId}`);
    
    // Mark node as running
    setNodeState(startNodeId, { 
      status: 'running', 
      executionId,
      lastTriggerNodeId: startNodeId
    });
    
    // Execute the node
    const result = await dispatchNodeExecution({
      node: startNode,
      nodes,
      edges: getEdges(),
      context: executionContext,
      getNodeState: dependencies.getNodeState,
      setNodeState: dependencies.setNodeState
    });
    
    // Update node state with result
    setNodeState(startNodeId, { 
      status: 'success', 
      result, 
      error: undefined,
      executionId
    });
    
    console.log(`[FlowController] Finished executing flow from node ${startNodeId}`);
  } catch (error: any) {
    console.error(`[FlowController] Error executing flow from node ${startNodeId}:`, error);
    setNodeState(startNodeId, { 
      status: 'error', 
      error: error.message || 'Unknown error'
    });
  } finally {
    // Make sure to clean up
    setIsExecuting(false);
    setCurrentExecutionId(undefined);
  }
} 