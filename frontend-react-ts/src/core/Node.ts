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
   * Main entry point for node execution
   * This method handles setup, execution, and propagation to child nodes
   * All node implementations should use this as their primary entry point
   * @param input The input value to process
   * @returns The execution result
   */
  async process(input: any): Promise<any> {
    try {
      // Mark the node as running
      this.context.markNodeRunning(this.id);
      
      // Clone input to avoid side effects
      this.input = structuredClone(input);
      
      // Execute the node's specific logic
      const result = await this.execute(input);
      
      // Store the result in the execution context
      if (result !== undefined) {
        this.context.storeOutput(this.id, result);
      }

      // Mark node as successful
      this.context.markNodeSuccess(this.id, result);
      
      // If result is null or undefined, don't propagate to children
      if (result === null || result === undefined) {
        this.context.log(`Node(${this.id}): Result is ${result === null ? 'null' : 'undefined'}, not propagating to children`);
        return result;
      }
      
      // Get all child nodes and propagate the result
      const childNodes = this.getChildNodes();
      
      if (childNodes.length > 0) {
        this.context.log(`Node(${this.id}): Propagating result to ${childNodes.length} child nodes`);
        
        // Process each child with the result
        for (const child of childNodes) {
          await child.process(result);
        }
      } else {
        this.context.log(`Node(${this.id}): No child nodes to process`);
      }
      
      return result;
    } catch (error) {
      // Mark this node as failed and log the error
      this.context.log(`Node(${this.id}): Execution failed: ${error}`);
      this.context.markNodeError(this.id, String(error));
      
      // Re-throw to allow parent nodes to handle the error
      throw error;
    }
  }

  /**
   * Executes the node's specific logic
   * Each node type must implement this method with its specific functionality
   * @param input The input value to execute
   * @returns The execution result
   */
  abstract execute(input: any): Promise<any>;

  /**
   * Get child nodes that should be executed next
   * This uses the current edge state to dynamically resolve child nodes
   * @returns Array of child node objects
   */
  getChildNodes(): Node[] {
    // Check if we have an execution graph available - if so, use it for faster child resolution
    if (this.property.executionGraph && this.property.executionGraph instanceof Map) {
      this.context.log(`Node(${this.id}): Using execution graph to resolve child nodes`);
      return this.getChildNodesFromGraph();
    }
    
    // Fallback to direct edge resolution if no graph is available
    this.context.log(`Node(${this.id}): No execution graph found, using edges to resolve child nodes`);
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
      this.context.log(`Node(${this.id}): No child nodes found in execution graph.`);
      return [];
    }
    
    this.context.log(`Node(${this.id}): Resolving ${childIds.length} child nodes from graph: ${childIds.join(', ')}`);
    
    // Create node instances for all child IDs
    const childNodes = childIds
      .map(childId => {
        const childNode = executionGraph.get(childId);
        if (!childNode) {
          this.context.log(`Node(${this.id}): Child node ${childId} not found in execution graph`);
          return null;
        }
        
        try {
          // Create the node with the same context to maintain execution flow
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
          
          this.context.log(`Node(${this.id}): Successfully created child node ${childId} of type ${childNode.type}`);
          return node;
        } catch (error) {
          this.context.log(`Node(${this.id}): Error creating child node ${childId}: ${error}`);
          return null;
        }
      })
      .filter((node): node is Node => node !== null);

    this.context.log(`Node(${this.id}): Returning ${childNodes.length} child nodes from graph`);
    return childNodes;
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
      this.context.log(`Node(${this.id}): No outgoing connections found in edges.`);
      return [];
    }
    
    this.context.log(`Node(${this.id}): Resolving ${outgoingConnections.length} child nodes from edges: ${outgoingConnections.map(c => c.targetNodeId).join(', ')}`);
    
    // Map connection targets to actual nodes
    const childNodes = outgoingConnections
      .map(connection => {
        const targetNode = findNodeById(connection.targetNodeId, nodes);
        if (!targetNode) {
          this.context.log(`Node(${this.id}): Target node ${connection.targetNodeId} not found in nodes`);
          return null;
        }
        
        try {
          // Create the node with the same context to maintain execution flow
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
          
          this.context.log(`Node(${this.id}): Successfully created child node ${targetNode.id} of type ${targetNode.type}`);
          return node;
        } catch (error) {
          this.context.log(`Node(${this.id}): Error creating child node ${targetNode.id}: ${error}`);
          return null;
        }
      })
      .filter((node): node is Node => node !== null);

    this.context.log(`Node(${this.id}): Returning ${childNodes.length} child nodes from edges`);
    return childNodes;
  }
} 