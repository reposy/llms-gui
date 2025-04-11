import { Edge, Node as ReactFlowNode } from 'reactflow';
import { NodeData } from '../types/nodes';
import { dispatchNodeExecution } from '../executors/executorDispatcher';
import { v4 as uuidv4 } from 'uuid';
import { ExecutionContext } from '../types/execution';
import { FlowExecutionContext } from '../core/FlowExecutionContext';
import { NodeFactory } from '../core/NodeFactory';
import { registerAllNodeTypes } from '../core/NodeRegistry';
import { buildExecutionGraphFromFlow, getExecutionGraph } from '../store/useExecutionGraphStore';

// Define the dependencies interface for flow controller functions
export interface FlowControllerDependencies {
  getNodes: () => ReactFlowNode<NodeData>[];
  getEdges: () => Edge[];
  getNodeState: (nodeId: string) => any;
  setNodeState: (nodeId: string, state: any) => void;
  resetNodeStates: (nodeIds?: string[]) => void;
  getDownstreamNodes: (nodeId: string) => string[];
  getNodesInGroup: (groupId: string) => ReactFlowNode<NodeData>[];
  setIsExecuting: (isExecuting: boolean) => void;
  setCurrentExecutionId: (executionId?: string) => void;
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
    const edges = getEdges();
    const startNode = nodes.find(node => node.id === startNodeId);
    
    if (!startNode) {
      throw new Error(`Start node ${startNodeId} not found`);
    }
    
    // Create execution context
    const executionId = `exec-${uuidv4()}`;
    const executionContext = new FlowExecutionContext(executionId);
    
    // Set trigger node
    executionContext.setTriggerNode(startNodeId);
    
    console.log(`[FlowExecution ${executionId}] Starting execution for node ${startNodeId}`);
    
    // Mark node as running using context
    executionContext.markNodeRunning(startNodeId);
    
    // Update execution controller state
    setCurrentExecutionId(executionId);
    setIsExecuting(true);

    // Build execution graph to ensure proper child node resolution
    buildExecutionGraphFromFlow(nodes, edges);
    const executionGraph = getExecutionGraph();
    
    // Create a node factory and register all node types
    const nodeFactory = new NodeFactory();
    registerAllNodeTypes(nodeFactory);
    
    // Create the node instance using the factory
    const nodeInstance = nodeFactory.create(
      startNode.id,
      startNode.type as string,
      startNode.data,
      executionContext
    );
    
    // Attach graph structure reference to the node property
    nodeInstance.property = {
      ...nodeInstance.property,
      nodes,
      edges,
      nodeFactory,
      executionGraph // Add the execution graph to allow for dynamic relationship resolution
    };
    
    // Execute the node with an empty input object
    // This will trigger child node propagation via Node.execute method
    console.log(`[FlowExecution ${executionId}] Executing node instance with proper chain propagation`);
    await nodeInstance.execute({});
    
    console.log(`[FlowController] Finished executing flow from node ${startNodeId}`);
  } catch (error: any) {
    console.error(`[FlowController] Error executing flow from node ${startNodeId}:`, error);
    const errorMessage = error.message || 'Unknown error';
    dependencies.setNodeState(startNodeId, { 
      status: 'error', 
      error: errorMessage
    });
  } finally {
    // Make sure to clean up
    setIsExecuting(false);
    setCurrentExecutionId(undefined);
  }
} 