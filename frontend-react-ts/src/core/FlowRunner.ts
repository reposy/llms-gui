import { Node as ReactFlowNode, Edge } from '@xyflow/react';
import { v4 as uuidv4 } from 'uuid';
import { FlowExecutionContext } from './FlowExecutionContext';
import { NodeFactory } from './NodeFactory';
import { getRootNodeIds } from '../utils/flowUtils';
import { registerAllNodeTypes } from './NodeRegistry';
import { buildExecutionGraphFromFlow, getExecutionGraph } from '../store/useExecutionGraphStore';

/**
 * FlowRunner handles the execution of a flow, starting from root nodes
 */
export class FlowRunner {
  /**
   * Execute a flow starting from all root nodes
   * 
   * @param nodes Array of nodes in the flow
   * @param edges Array of edges connecting the nodes
   * @param nodeFactory Factory to create node instances
   * @returns Promise that resolves when all root nodes have completed execution
   */
  static async executeFlow(
    nodes: ReactFlowNode[], 
    edges: Edge[], 
    nodeFactory: NodeFactory
  ): Promise<void> {
    // Create a unique execution context for this run
    const executionId = uuidv4();
    const context = new FlowExecutionContext(executionId);
    
    context.log('Starting flow execution');
    
    // Build the execution graph to ensure accurate node relationships
    buildExecutionGraphFromFlow(nodes, edges);
    const executionGraph = getExecutionGraph();
    context.log(`Built execution graph with ${executionGraph.size} nodes`);
    
    // Find all root nodes (nodes with no incoming connections)
    const rootNodeIds = getRootNodeIds(nodes, edges);
    
    if (rootNodeIds.length === 0) {
      context.log('No root nodes found in the flow. Execution halted.');
      return;
    }
    
    context.log(`Found ${rootNodeIds.length} root nodes: ${rootNodeIds.join(', ')}`);
    
    // Execute each root node in sequence
    for (const rootNodeId of rootNodeIds) {
      try {
        // Skip if node has already been executed in this context
        if (context.hasExecutedNode(rootNodeId)) {
          context.log(`Skipping already executed root node: ${rootNodeId}`);
          continue;
        }

        // Find the node data
        const nodeData = nodes.find(node => node.id === rootNodeId);
        
        if (!nodeData) {
          context.log(`Root node ${rootNodeId} not found in nodes data. Skipping.`);
          continue;
        }
        
        context.log(`Executing root node: ${rootNodeId} (type: ${nodeData.type})`);
        
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
        context.markNodeExecuted(rootNodeId);
        
        context.log(`Completed execution of root node: ${rootNodeId}`);
      } catch (error) {
        context.log(`Error executing root node ${rootNodeId}: ${error}`);
        // Continue with other root nodes even if one fails
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
 * @returns Promise that resolves when the flow execution is complete
 */
export async function runFlow(nodes: ReactFlowNode[], edges: Edge[]): Promise<void> {
  // Create and initialize the node factory
  const nodeFactory = new NodeFactory();
  registerAllNodeTypes();
  
  // Execute the flow
  return FlowRunner.executeFlow(nodes, edges, nodeFactory);
} 