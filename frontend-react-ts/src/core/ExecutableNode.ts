import { Node } from '@xyflow/react';
import { FlowExecutionContext } from './FlowExecutionContext';
import { getOutgoingConnections, findNodeById } from '../utils/flowUtils';

/**
 * Interface for nodes that can be executed in a flow
 */
export interface ExecutableNode {
  /**
   * The unique ID of this node
   */
  nodeId: string;

  /**
   * Execute this node with the given input and context
   * @param input The input value to process
   * @param context The execution context
   * @returns The result of execution
   */
  execute(input: any, context: FlowExecutionContext): Promise<any>;

  /**
   * Get child nodes that should be executed next
   * @param context The execution context
   * @returns Array of child node IDs
   */
  getChildNodes(context: FlowExecutionContext): string[];

  /**
   * Process this node's specific logic
   * @param input The input value to process
   * @param context The execution context
   * @returns The processed result
   */
  process(input: any, context: FlowExecutionContext): Promise<any>;
}

/**
 * Base implementation of an executable node
 */
export abstract class BaseNode implements ExecutableNode {
  nodeId: string;

  constructor(nodeId: string) {
    this.nodeId = nodeId;
  }

  /**
   * Execute this node and store the output in the context
   */
  async execute(input: any, context: FlowExecutionContext): Promise<any> {
    console.log(`Executing node ${this.nodeId} with input:`, input);
    
    // Process the input according to this node's specific logic
    const output = await this.process(input, context);
    
    // Store the output in the context
    context.storeOutput(this.nodeId, output);
    
    return output;
  }

  /**
   * Gets the IDs of child nodes that should be executed next
   */
  getChildNodes(context: FlowExecutionContext): string[] {
    // context should have edges directly
    // getOutgoingConnections returns array of { targetNodeId, ... }
    if (!('edges' in context)) return [];
    // @ts-ignore
    const edges = context.edges;
    // @ts-ignore
    return getOutgoingConnections(this.nodeId, edges).map(conn => conn.targetNodeId);
  }

  /**
   * Abstract method to be implemented by each specific node type
   */
  abstract process(input: any, context: FlowExecutionContext): Promise<any>;
} 