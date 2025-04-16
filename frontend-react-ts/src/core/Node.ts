import { findNodeById, getOutgoingConnections, getChildNodeIdsFromGraph, GraphNode } from '../utils/flowUtils';
import { FlowExecutionContext } from './FlowExecutionContext';

/**
 * Base Node class that all nodes extend
 */
export abstract class Node {
  /**
   * Node ID
   */
  public readonly id: string;
  
  /**
   * Node type (e.g., 'input', 'llm', 'api', 'output', etc.)
   */
  public readonly type: string;

  /**
   * Node properties (configuration) - to be overridden by subclasses
   */
  public property: Record<string, any> = {};

  /**
   * IDs of child nodes
   */
  private childIds: string[] = [];

  /**
   * Execution context for the node
   */
  protected context?: FlowExecutionContext;

  /**
   * Constructor for the base Node
   * @param id Node ID
   * @param type Node type
   * @param property Node properties
   * @param context Optional execution context
   */
  constructor(
    id: string, 
    type: string, 
    property: Record<string, any> = {},
    context?: FlowExecutionContext
  ) {
    this.id = id;
    this.type = type;
    this.property = property;
    this.context = context;
  }

  /**
   * Set child node IDs
   * @param childIds Array of child node IDs
   */
  setChildIds(childIds: string[]): void {
    this.childIds = childIds;
    this.context?.log(`${this.type}(${this.id}): Set ${childIds.length} child IDs: [${childIds.join(', ')}]`);
  }

  /**
   * Get child node IDs
   * @returns Array of child node IDs
   */
  getChildIds(): string[] {
    return this.childIds;
  }

  /**
   * Get array of child nodes using the node factory from property
   * @returns Array of child Node instances
   */
  getChildNodes(): Node[] {
    // Skip if no factory
    const nodeFactory = this.property.nodeFactory;
    if (!nodeFactory) {
      this.context?.log(`${this.type}(${this.id}): No node factory found in property`);
      return [];
    }
    
    // If we have nodes and edges in property, use those to determine childIds dynamically
    if (this.property.nodes && this.property.edges) {
      this.context?.log(`${this.type}(${this.id}): Using dynamic relationship resolution from edges`);
      
      // Get outgoing connections based on the edges
      const childNodeIds = this.property.edges
        .filter((edge: any) => edge.source === this.id)
        .map((edge: any) => edge.target);
      
      this.context?.log(`${this.type}(${this.id}): Found ${childNodeIds.length} child nodes from edges: [${childNodeIds.join(', ')}]`);
      
      // Create child node instances
      return childNodeIds
        .map((childId: string) => {
          const nodeData = this.property.nodes.find((n: any) => n.id === childId);
          if (!nodeData) {
            this.context?.log(`${this.type}(${this.id}): Child node data not found for ${childId}`);
            return null;
          }
          
          // Create the node instance with the same factory, nodes, edges
          const node = nodeFactory.create(
            nodeData.id,
            nodeData.type,
            nodeData.data,
            this.context
          );
          
          // Pass along graph structure to the child node
          node.property = {
            ...node.property,
            nodes: this.property.nodes,
            edges: this.property.edges,
            nodeFactory: this.property.nodeFactory
          };
          
          return node;
        })
        .filter(Boolean) as Node[];
    }
    
    // Fallback to stored childIds if edges aren't available
    this.context?.log(`${this.type}(${this.id}): Using stored childIds: [${this.childIds.join(', ')}]`);
    return this.childIds
      .map(childId => {
        const node = nodeFactory.getNode(childId);
        if (!node) {
          this.context?.log(`${this.type}(${this.id}): Child node ${childId} not found`);
        }
        return node;
      })
      .filter(Boolean) as Node[];
  }

  /**
   * Process input through this node and chain through child nodes
   * This provides common lifecycle management for all nodes
   * 
   * @param input The input to process
   * @returns The final result after all processing
   */
  async process(input: any) {
    // Skip if this node has already been executed in this context
    if (this.context?.hasExecutedNode(this.id)) {
      this.context.log(`${this.type}(${this.id}): Node already executed in this context, skipping`);
      return input; // Pass through the input to allow child nodes to continue
    }
    
    // Execute the node
    const result = await this.execute(input);
    
    // Mark the node as executed to prevent re-execution in cycles
    this.context?.markNodeExecuted(this.id);
    
    // If result is null, stop execution chain
    if (result === null) return;
    
    // Process child nodes with the result
    for (const child of this.getChildNodes()) {
      await child.process(result);
    }
  }

  /**
   * Execute the core functionality of the node
   * To be implemented by subclasses
   * 
   * @param input The input to process
   * @returns The processed result
   */
  abstract execute(input: any): Promise<any>;
} 