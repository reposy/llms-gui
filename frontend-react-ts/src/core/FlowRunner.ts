import { Node as ReactFlowNode, Edge } from '@xyflow/react';
import { v4 as uuidv4 } from 'uuid';
import { FlowExecutionContext } from './FlowExecutionContext';
import { NodeFactory } from './NodeFactory';
import { getRootNodeIds } from '../utils/flow/flowUtils';
import { registerAllNodeTypes } from './NodeRegistry';
import { buildExecutionGraphFromFlow, getExecutionGraph } from '../store/useExecutionGraphStore';
import { NodeData } from '../types/nodes';
import { getNodeContent } from '../store/useNodeContentStore';
import { runFullFlowExecution } from './executionUtils'; // Import the new utility

/**
 * FlowRunner handles the execution of a flow, starting from root nodes
 * @deprecated Prefer using functions from executionUtils.ts directly.
 */
export class FlowRunner {
  /**
   * Execute a flow starting from all root nodes or a specific node
   * 
   * @param nodes Array of nodes in the flow (Using ReactFlowNode type)
   * @param edges Array of edges connecting the nodes
   * @param nodeFactory Factory to create node instances (Now likely unused here)
   * @param startNodeId Optional ID of a specific node to start execution from
   * @returns Promise that resolves when the relevant part of the flow has completed execution
   * @deprecated Use runFullFlowExecution from executionUtils instead.
   */
  static async executeFlow(
    nodes: ReactFlowNode<NodeData>[], // Parameter might become unused
    edges: Edge[], // Parameter might become unused
    nodeFactory: NodeFactory, // Parameter might become unused
    startNodeId?: string 
  ): Promise<void> {
    // The core logic is now moved to runFullFlowExecution
    // This function primarily acts as a compatibility layer or can be removed
    console.warn("FlowRunner.executeFlow is deprecated. Use runFullFlowExecution from executionUtils instead.");
    try {
      // We don't need nodes, edges, factory here as runFullFlowExecution handles context creation
      await runFullFlowExecution(startNodeId);
    } catch (error) {
      console.error("Error during flow execution triggered via FlowRunner:", error);
      // Re-throw error for the caller (e.g., runFlow helper)
      throw error;
    }
  }
}

/**
 * Simple helper function to run a flow
 * This creates the NodeFactory and registers all node types
 * 
 * @param nodesFromStore Array of nodes, potentially from Zustand store (might need type assertion)
 * @param edges Array of edges connecting the nodes
 * @param startNodeId Optional ID of a specific node to start execution from
 * @returns Promise that resolves when the flow execution is complete
 */
export async function runFlow(
  nodesFromStore: ReactFlowNode<NodeData | any>[], // Parameter might become unused
  edges: Edge[], // Parameter might become unused
  startNodeId?: string 
): Promise<void> {
  // ... (Type assertion for nodes remains useful if directly used, but maybe not needed) ...
  // const nodes: ReactFlowNode<NodeData>[] = nodesFromStore as ReactFlowNode<NodeData>[];

  // const nodeFactory = new NodeFactory(); // No longer needed here
  // registerAllNodeTypes(); // No longer needed here
  
  // Execute the flow using the new utility function
  // We don't need to pass nodes/edges/factory anymore
  // highlight-start
  console.log(`[runFlow] Triggering full flow execution ${startNodeId ? `from node ${startNodeId}`: 'from root nodes'}`);
  return runFullFlowExecution(startNodeId);
  // highlight-end
  
  // Old call:
  // return FlowRunner.executeFlow(nodes, edges, nodeFactory, startNodeId);
} 