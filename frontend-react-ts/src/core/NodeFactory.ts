import { Node } from './Node';
import { FlowExecutionContext } from './FlowExecutionContext';

/**
 * Factory for creating node instances by type
 */
export class NodeFactory {
  // Map of node types to creator functions
  private creators: Map<string, (id: string, property: any, context: FlowExecutionContext) => Node> = new Map();

  /**
   * Register a node type with its creator function
   * @param type The node type identifier
   * @param creator Function to create a node of this type
   */
  register(type: string, creator: (id: string, property: any, context: FlowExecutionContext) => Node): void {
    this.creators.set(type, creator);
    console.log(`Registered node type: ${type}`);
  }

  /**
   * Create a node instance of the specified type
   * @param id Node ID
   * @param type Node type
   * @param property Node configuration
   * @param context Execution context
   * @returns Node instance
   */
  create(id: string, type: string, property: any, context: FlowExecutionContext): Node {
    console.log(`[NodeFactory] Creating node ${id} of type ${type} with properties:`, property);
    
    // Get the creator function for this node type
    const creator = this.creators.get(type);
    
    if (!creator) {
      console.warn(`No creator registered for node type: ${type}. Falling back to PassthroughNode.`);
      return new PassthroughNode(id, property, context);
    }
    
    // Create node instance with property data
    const node = creator(id, property, context);
    console.log(`[NodeFactory] Created ${type} node instance ${id}`);
    
    return node;
  }
  
  /**
   * Create a node for a specific iteration context (foreach mode)
   * @param id Node ID
   * @param type Node type
   * @param property Node configuration 
   * @param context Parent execution context
   * @param iterationIndex Current iteration index
   * @param item Current item being processed
   * @returns Node instance with iteration context
   */
  createForIteration(
    id: string, 
    type: string, 
    property: any, 
    context: FlowExecutionContext, 
    iterationIndex: number, 
    item: any,
    totalItems: number
  ): Node {
    // Create an iteration-specific context
    const iterContext = new FlowExecutionContext(context.executionId);
    iterContext.setIterationContext({
      item: item,
      index: iterationIndex,
      total: totalItems
    });
    
    console.log(`[NodeFactory] Creating iteration node ${id} for item ${iterationIndex + 1}`);
    
    // Create the node with the iteration context
    return this.create(id, type, property, iterContext);
  }
}

/**
 * Default passthrough node used when no specific implementation is available
 */
class PassthroughNode extends Node {
  execute(input: any): Promise<any> {
    this.context.log(`PassthroughNode(${this.id}): No specific implementation for this type, passing through input`);
    return Promise.resolve(input);
  }
}
