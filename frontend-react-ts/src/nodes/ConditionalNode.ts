import { Node } from '../core/Node';
import { FlowExecutionContext } from '../core/FlowExecutionContext';
import { findNodeById, getOutgoingConnections } from '../utils/flowUtils';

/**
 * Conditional node properties
 */
interface ConditionalNodeProperty {
  condition: string;
  trueNodeIds?: string[];  // IDs of nodes to execute if condition is true
  falseNodeIds?: string[]; // IDs of nodes to execute if condition is false
  // References to flow structure and factory (added by FlowRunner)
  nodes?: any[];
  edges?: any[];
  nodeFactory?: any;
  executionGraph?: Map<string, any>;
}

/**
 * Condition evaluation result type
 */
interface ConditionResult {
  path: 'true' | 'false';
  result: any;
}

/**
 * Conditional node that branches flow based on a condition
 */
export class ConditionalNode extends Node {
  /**
   * Type assertion for the property
   */
  declare property: ConditionalNodeProperty;
  
  /**
   * Process the input according to the conditional node's configuration
   * Evaluates the condition and returns appropriate result
   */
  async process(input: any): Promise<ConditionResult> {
    this.context.log(`ConditionalNode(${this.id}): Evaluating condition: ${this.property.condition}`);
    
    // Clone input to avoid side effects
    const safeInput = structuredClone(input);
    
    // Evaluate the condition
    let conditionResult = false;
    try {
      // Create a safe evaluation context with only the input variable
      const evalContext = { input: safeInput };
      
      // Use Function constructor for safer evaluation
      const evalFunc = new Function('input', `return Boolean(${this.property.condition});`);
      conditionResult = evalFunc.call(null, safeInput);
      
      this.context.log(`ConditionalNode(${this.id}): Condition evaluated to ${conditionResult}`);
    } catch (error) {
      this.context.log(`ConditionalNode(${this.id}): Error evaluating condition: ${error}`);
      // Default to false on error
      conditionResult = false;
    }
    
    // Return the result with the appropriate path
    return {
      path: conditionResult ? 'true' : 'false',
      result: input
    };
  }
  
  /**
   * Get child nodes that should be executed next
   * We override the base getChildNodes to only return nodes on the active path
   */
  getChildNodes(): Node[] {
    // This implementation is not used since we override execute()
    // to call getChildNodesForPath() directly with the evaluation result
    return [];
  }
  
  /**
   * Override execute to handle conditional branching
   */
  async execute(input: any): Promise<void> {
    this.input = structuredClone(input);
    const result = await this.process(input);
    
    // Lookup the appropriate child nodes based on the evaluation path (true or false)
    const childNodesToExecute = this.getChildNodesForPath(result.path);
    
    this.context.log(`ConditionalNode(${this.id}): Following '${result.path}' path with ${childNodesToExecute.length} child nodes`);
    
    // Execute all child nodes on the selected path
    for (const child of childNodesToExecute) {
      await child.execute(result.result);
    }
  }
  
  /**
   * Helper method to get child nodes for a specific path
   * @param path The path to get child nodes for ('true' or 'false')
   */
  private getChildNodesForPath(path: 'true' | 'false'): Node[] {
    const { nodes, edges, nodeFactory } = this.property;
    
    if (!nodes || !edges || !nodeFactory) {
      this.context.log(`ConditionalNode(${this.id}): Missing nodes, edges, or factory. Cannot resolve child nodes.`);
      return [];
    }
    
    // Map the path to the corresponding sourceHandle
    const sourceHandle = path === 'true' ? 'trueHandle' : 'falseHandle';
    
    // Get outgoing connections that match the specified path
    const pathConnections = getOutgoingConnections(this.id, edges)
      .filter(connection => connection.sourceHandle === sourceHandle);
    
    if (pathConnections.length === 0) {
      this.context.log(`ConditionalNode(${this.id}): No connections found for path '${path}' (handle: ${sourceHandle})`);
      return [];
    }
    
    this.context.log(`ConditionalNode(${this.id}): Found ${pathConnections.length} connections for path '${path}'`);
    
    // Create node instances for all connected nodes on this path
    return pathConnections
      .map(connection => {
        const targetNode = findNodeById(connection.targetNodeId, nodes);
        if (!targetNode) {
          this.context.log(`ConditionalNode(${this.id}): Could not find target node ${connection.targetNodeId}`);
          return null;
        }
        
        try {
          // Create the node instance using the factory
          const node = nodeFactory.create(
            targetNode.id,
            targetNode.type as string,
            targetNode.data,
            this.context
          );
          
          // Pass along the flow structure and execution graph to the child
          node.property = {
            ...node.property,
            nodes: this.property.nodes,
            edges: this.property.edges,
            nodeFactory: this.property.nodeFactory,
            executionGraph: this.property.executionGraph
          };
          
          return node;
        } catch (error) {
          this.context.log(`ConditionalNode(${this.id}): Error creating child node: ${error}`);
          return null;
        }
      })
      .filter((node): node is Node => node !== null);
  }
} 