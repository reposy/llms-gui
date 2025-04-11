import { Node as ReactFlowNode, Edge } from 'reactflow';
import { NodeData, NodeType } from '../types/nodes';
import { findNodeById, getOutgoingConnections, getChildNodeIdsFromGraph, GraphNode } from '../utils/flowUtils';
import { FlowExecutionContext } from './FlowExecutionContext';

/**
 * Abstract base class for all node types
 * Each node can process input and propagate results to child nodes
 */
export abstract class Node {
  id: string;
  input: any;
  property: any;
  context: FlowExecutionContext;

  constructor(id: string, property: any, context: FlowExecutionContext) {
    this.id = id;
    this.property = property;
    this.context = context;
    this.input = null;
  }

  /**
   * Execute this node with the given input and propagate to child nodes
   * @param input The input value to process
   */
  async execute(input: any): Promise<void> {
    this.input = structuredClone(input);
    const result = await this.process(input);
    
    // Get all child nodes and execute them
    for (const child of this.getChildNodes()) {
      await child.execute(result);
    }
  }

  /**
   * Process the input according to this node's specific logic
   * @param input The input value to process
   * @returns The processed result
   */
  abstract process(input: any): Promise<any>;

  /**
   * Get child nodes that should be executed next
   * This uses the current edge state to dynamically resolve child nodes
   * @returns Array of child node objects
   */
  getChildNodes(): Node[] {
    // Check if we have an execution graph available - if so, use it for faster child resolution
    if (this.property.executionGraph && this.property.executionGraph instanceof Map) {
      return this.getChildNodesFromGraph();
    }
    
    // Fallback to direct edge resolution if no graph is available
    return this.getChildNodesFromEdges();
  }
  
  /**
   * Get child nodes using the execution graph
   * This is more efficient for complex flows
   */
  private getChildNodesFromGraph(): Node[] {
    const executionGraph: Map<string, GraphNode> = this.property.executionGraph;
    const nodeFactory = this.property.nodeFactory;
    
    if (!executionGraph || !nodeFactory) {
      this.context.log(`Node(${this.id}): Missing execution graph or factory. Cannot resolve children.`);
      return [];
    }
    
    // Get child IDs from the graph
    const childIds = getChildNodeIdsFromGraph(this.id, executionGraph);
    
    if (childIds.length === 0) {
      return [];
    }
    
    this.context.log(`Node(${this.id}): Resolving ${childIds.length} child nodes from graph`);
    
    // Create node instances for all child IDs
    return childIds
      .map(childId => {
        const childNode = executionGraph.get(childId);
        if (!childNode) return null;
        
        try {
          // Create the node with the same context
          const node = nodeFactory.create(
            childId,
            childNode.type,
            childNode.data,
            this.context
          );
          
          // Pass along the execution graph to the child
          node.property = {
            ...node.property,
            nodes: this.property.nodes,
            edges: this.property.edges,
            nodeFactory: this.property.nodeFactory,
            executionGraph: this.property.executionGraph
          };
          
          return node;
        } catch (error) {
          this.context.log(`Node(${this.id}): Error creating child node ${childId}: ${error}`);
          return null;
        }
      })
      .filter((node): node is Node => node !== null);
  }
  
  /**
   * Get child nodes directly from the edges
   * Fallback method when no execution graph is available
   */
  private getChildNodesFromEdges(): Node[] {
    const { nodes, edges, nodeFactory } = this.property;
    
    if (!nodes || !edges || !nodeFactory) {
      this.context.log(`Node(${this.id}): Missing nodes, edges, or factory. Cannot resolve children.`);
      return [];
    }
    
    // Get outgoing connections for this node
    const outgoingConnections = getOutgoingConnections(this.id, edges);
    
    if (outgoingConnections.length === 0) {
      return [];
    }
    
    this.context.log(`Node(${this.id}): Resolving ${outgoingConnections.length} child nodes from edges`);
    
    // Map connection targets to actual nodes
    return outgoingConnections
      .map(connection => {
        const targetNode = findNodeById(connection.targetNodeId, nodes);
        if (!targetNode) return null;
        
        try {
          // Create the node with the same context
          const node = nodeFactory.create(
            targetNode.id,
            targetNode.type as string,
            targetNode.data,
            this.context
          );
          
          // Pass along the structure to the child
          node.property = {
            ...node.property,
            nodes: this.property.nodes,
            edges: this.property.edges,
            nodeFactory: this.property.nodeFactory,
            executionGraph: this.property.executionGraph
          };
          
          return node;
        } catch (error) {
          this.context.log(`Node(${this.id}): Error creating child node ${targetNode.id}: ${error}`);
          return null;
        }
      })
      .filter((node): node is Node => node !== null);
  }
} 