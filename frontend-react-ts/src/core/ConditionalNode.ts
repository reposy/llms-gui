import { Node } from '../core/Node';
import { findNodeById, getOutgoingConnections } from '../utils/flow/flowUtils.ts';
import { FlowExecutionContext } from './FlowExecutionContext';
import { getNodeContent } from '../store/useNodeContentStore.ts';
import { ConditionalNodeContent, useNodeContentStore } from '../store/useNodeContentStore.ts';
import { evaluateCondition } from '../utils/flow/executionUtils.ts';

/**
 * Available condition types
 */
export type ConditionType = 
  | 'numberGreaterThan'
  | 'numberLessThan'
  | 'equalTo'
  | 'containsSubstring'
  | 'jsonPathExistsTruthy'
  | 'contains';  // Legacy type for backward compatibility

/**
 * Conditional node properties
 */
interface ConditionalNodeProperty {
  condition?: string;         // Legacy property for backward compatibility
  conditionType?: ConditionType;
  conditionValue?: string | number;  // Legacy property name
  value?: string | number;    // New property name
  data?: any;                 // Node data from UI
  // References to flow structure and factory (added by FlowRunner)
  nodes?: any[];
  edges?: any[];
  nodeFactory?: any;
  executionGraph?: Map<string, any>;
}

/**
 * Conditional node that branches flow based on a condition
 */
export class ConditionalNode extends Node {
  /**
   * Type assertion for the property
   */
  declare property: ConditionalNodeContent;
  
  /**
   * Constructor for ConditionalNode
   */
  constructor(
    id: string,
    property: Record<string, any> = {},
    context?: FlowExecutionContext
  ) {
    super(id, 'conditional', property, context);
    // Initialize with default values if not provided
    this.property.conditionType = this.property.conditionType || 'equalTo';
    this.property.conditionValue = this.property.conditionValue || '';
  }

  /**
   * Execute the input according to the conditional node's configuration
   * Evaluates the condition and returns the appropriate path information
   * @param input The input to process
   * @returns The original input and path result for child propagation
   */
  async execute(input: any): Promise<any> {
    this.context?.log(`${this.type}(${this.id}): Executing`);

    // Get the latest content directly from the store within execute
    const nodeContent = useNodeContentStore.getState().getNodeContent<ConditionalNodeContent>(this.id, this.type);
    
    const { 
      conditionType = 'contains', // Default condition type
      conditionValue
    } = nodeContent;

    if (conditionValue === undefined || conditionValue === null) {
      const errorMsg = "Condition value is required for ConditionalNode.";
      this.context?.markNodeError(this.id, errorMsg);
      this.context?.log(`${this.type}(${this.id}): Error - ${errorMsg}`);
      // Allow execution to continue, but the condition will likely evaluate to false
      // Depending on the desired behavior, we might return null here instead.
    }

    this.context?.log(`${this.type}(${this.id}): Condition Type: ${conditionType}, Value: ${conditionValue}`);
    
    let conditionResult = false;
    try {
      conditionResult = evaluateCondition(input, conditionType, conditionValue);
      this.context?.log(`${this.type}(${this.id}): Condition evaluated to: ${conditionResult}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.context?.markNodeError(this.id, `Condition evaluation error: ${errorMessage}`);
      this.context?.log(`${this.type}(${this.id}): Error evaluating condition - ${errorMessage}`);
      // Treat evaluation errors as false? Or return null?
      // For now, let it proceed as false.
    }

    // Store the result of the condition evaluation
    this.context?.storeOutput(this.id, conditionResult);
    
    // The actual branching logic happens in the getChildNodes method
    // which needs to be overridden for ConditionalNode.
    // execute simply evaluates the condition and returns the input for potential chaining.
    return input; // Pass input along, branching is handled by custom getChildNodes
  }

  /**
   * Get child nodes based on the condition result path
   */
  getChildNodes(): Node[] {
    this.context?.log(`${this.type}(${this.id}): Custom getChildNodes executing`);
    const nodeFactory = this.property.nodeFactory;
    if (!nodeFactory || !this.property.nodes || !this.property.edges) {
      this.context?.log(`${this.type}(${this.id}): Missing factory, nodes, or edges for dynamic resolution`);
      return [];
    }
    
    // Get the result of the condition evaluation from the context
    const conditionResult = this.context?.getOutput(this.id) as boolean | undefined;
    // Default to false if result is not explicitly boolean true
    const outcome = conditionResult === true ? 'true' : 'false'; 
    
    this.context?.log(`${this.type}(${this.id}): Branching based on outcome: ${outcome}`);

    // Determine the source handle based on the outcome
    const sourceHandle = outcome === 'true' ? 'source-true' : 'source-false';

    // Find edges originating from the correct source handle
    const childNodeIds = this.property.edges
      .filter((edge: any) => edge.source === this.id && edge.sourceHandle === sourceHandle)
      .map((edge: any) => edge.target);
      
    this.context?.log(`${this.type}(${this.id}): Found ${childNodeIds.length} child nodes for outcome ${outcome}: [${childNodeIds.join(', ')}]`);

    // Create node instances for the children connected to the determined path
    return childNodeIds
      .map((childId: string) => {
        const nodeData = this.property.nodes.find((n: any) => n.id === childId);
        if (!nodeData) {
          this.context?.log(`${this.type}(${this.id}): Child node data not found for ${childId}`);
          return null;
        }
        
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
} 