import { Node as ReactFlowNode, Edge } from '@xyflow/react';
import { v4 as uuidv4 } from 'uuid';
import { FlowExecutionContext } from './FlowExecutionContext';
import { NodeFactory } from './NodeFactory';
import { getRootNodeIds } from '../utils/flow/flowUtils';
import { registerAllNodeTypes } from './NodeRegistry';
import { buildExecutionGraphFromFlow, getExecutionGraph } from '../store/useExecutionGraphStore';

/**
 * FlowRunner handles the execution of a flow, starting from root nodes
 */
export class FlowRunner {
  /**
   * Execute a flow starting from all root nodes or a specific node
   * 
   * @param nodes Array of nodes in the flow
   * @param edges Array of edges connecting the nodes
   * @param nodeFactory Factory to create node instances
   * @param startNodeId Optional ID of a specific node to start execution from
   * @returns Promise that resolves when the relevant part of the flow has completed execution
   */
  static async executeFlow(
    nodes: ReactFlowNode[], 
    edges: Edge[], 
    nodeFactory: NodeFactory,
    startNodeId?: string // Optional start node ID
  ): Promise<void> {
    // Create a unique execution context for this run
    const executionId = uuidv4();
    const context = new FlowExecutionContext(executionId);
    
    context.log(`Starting flow execution (Execution ID: ${executionId})${startNodeId ? ` from node ${startNodeId}` : ' from all root nodes'}`);
    
    // Build the execution graph to ensure accurate node relationships
    buildExecutionGraphFromFlow(nodes, edges);
    const executionGraph = getExecutionGraph();
    context.log(`Built execution graph with ${executionGraph.size} nodes`);
    
    // Determine the starting nodes
    let nodesToExecuteIds: string[] = [];
    if (startNodeId) {
      if (nodes.some(node => node.id === startNodeId)) {
        nodesToExecuteIds = [startNodeId];
        context.setTriggerNode(startNodeId); // Set the trigger node in context
      } else {
        context.log(`Start node ${startNodeId} not found in the flow. Execution halted.`);
        return;
      }
    } else {
      nodesToExecuteIds = getRootNodeIds(nodes, edges);
      if (nodesToExecuteIds.length === 0) {
        context.log('No root nodes found in the flow. Execution halted.');
        return;
      }
      // Trigger node might be ambiguous when running all roots
    }
    
    context.log(`Executing ${nodesToExecuteIds.length} starting node(s): ${nodesToExecuteIds.join(', ')}`);
    
    // Execute each starting node
    for (const nodeIdToExecute of nodesToExecuteIds) {
      try {
        // Skip if node has already been executed in this context (useful if startNodeId is part of a larger run later)
        if (context.hasExecutedNode(nodeIdToExecute)) {
          context.log(`Skipping already executed node: ${nodeIdToExecute}`);
          continue;
        }

        // Find the node data
        const nodeData = nodes.find(node => node.id === nodeIdToExecute);
        
        if (!nodeData) {
          context.log(`Node ${nodeIdToExecute} not found in nodes data. Skipping.`);
          continue;
        }
        
        context.log(`Executing node: ${nodeIdToExecute} (type: ${nodeData.type})`);
        
        // Create the node instance
        const nodeInstance = nodeFactory.create(
          nodeData.id,
          nodeData.type as string,
          nodeData.data,
          context
        );
        
        // Attach graph structure reference to the node property
        // This allows nodes to resolve their children dynamically based on current edges
        nodeInstance.property = {
          ...nodeInstance.property,
          nodes,
          edges,
          nodeFactory,
          executionGraph // Add the execution graph to allow for dynamic relationship resolution
        };
        
        // Execute the node with an empty input object
        await nodeInstance.process({});
        
        // Mark the node as executed to prevent re-execution
        context.markNodeExecuted(nodeIdToExecute);
        
        context.log(`Completed execution of node: ${nodeIdToExecute}`);
      } catch (error) {
        context.log(`Error executing node ${nodeIdToExecute}: ${error}`);
        // Continue with other nodes even if one fails
      }
    }
    
    context.log('Flow execution completed');
  }
}

/**
 * Simple helper function to run a flow
 * This creates the NodeFactory and registers all node types
 * 
 * @param nodes Array of nodes in the flow
 * @param edges Array of edges connecting the nodes
 * @param startNodeId Optional ID of a specific node to start execution from
 * @returns Promise that resolves when the flow execution is complete
 */
export async function runFlow(
  nodes: ReactFlowNode[], 
  edges: Edge[],
  startNodeId?: string // Optional start node ID
): Promise<void> {
  // Create and initialize the node factory
  const nodeFactory = new NodeFactory();
  registerAllNodeTypes();
  
  // Execute the flow, passing the startNodeId if provided
  return FlowRunner.executeFlow(nodes, edges, nodeFactory, startNodeId);
} 