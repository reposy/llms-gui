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
    const creator = this.creators.get(type);
    
    if (!creator) {
      console.warn(`No creator registered for node type: ${type}. Falling back to PassthroughNode.`);
      return new PassthroughNode(id, property, context);
    }
    
    return creator(id, property, context);
  }
}

/**
 * Default passthrough node used when no specific implementation is available
 */
class PassthroughNode extends Node {
  process(input: any): Promise<any> {
    this.context.log(`PassthroughNode(${this.id}): No specific implementation for this type, passing through input`);
    return Promise.resolve(input);
  }
  
  getChildNodes(): Node[] {
    return [];
  }
}
