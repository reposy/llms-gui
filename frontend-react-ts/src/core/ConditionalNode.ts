import { Node } from '../core/Node';
import { FlowExecutionContext } from './FlowExecutionContext';
import { ConditionalNodeContent } from '../types/nodes.ts';
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
    super(id, 'conditional', property);
    
    // 생성자에서 context를 명시적으로 설정
    if (context) {
      this.context = context;
    }
    
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
    this._log('Executing'); // Will use inherited _log

    let nodeContent: ConditionalNodeContent | undefined = undefined;
    if (this.context && typeof this.context.getNodeContentFunc === 'function') {
      nodeContent = this.context.getNodeContentFunc(this.id, this.type) as ConditionalNodeContent;
    } else {
      nodeContent = this.property as ConditionalNodeContent;
    }
    
    const { 
      conditionType = 'contains', 
      conditionValue
    } = nodeContent;

    if (conditionValue === undefined || conditionValue === null) {
      const errorMsg = "Condition value is required for ConditionalNode.";
      this.context?.markNodeError(this.id, errorMsg);
      this._log(`Error - ${errorMsg}`); // Will use inherited _log
    }

    this._log(`Condition Type: ${conditionType}, Value: ${String(conditionValue)}`); // Will use inherited _log
    
    let conditionResult = false;
    try {
      conditionResult = evaluateCondition(input, conditionType, conditionValue);
      this._log(`Condition evaluated to: ${conditionResult}`); // Will use inherited _log
      // Store the result in the context's output for this node so getChildNodes can use it.
      this.context?.storeOutput(this.id, conditionResult);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.context?.markNodeError(this.id, `Condition evaluation error: ${errorMessage}`);
      this._log(`Error evaluating condition - ${errorMessage}`); // Will use inherited _log
      // Store false in context if evaluation fails, to ensure defined path.
      this.context?.storeOutput(this.id, false);
    }
    
    // The actual branching logic happens in the getChildNodes method.
    // execute simply evaluates the condition and returns the input.
    return input; 
  }

  /**
   * Get child nodes based on the condition result path
   */
  getChildNodes(): Node[] {
    this._log('Custom getChildNodes executing'); // Will use inherited _log
    
    if (!this.context) {
      console.error(`[ConditionalNode:${this.id}] CRITICAL - this.context is UNDEFINED in getChildNodes.`);
      return [];
    }
    const { nodeFactory, nodes: contextNodes, edges: contextEdges } = this.context;

    if (!nodeFactory || !contextNodes || !contextEdges) {
      this._log('Missing factory, nodes, or edges from context for dynamic resolution'); // Will use inherited _log
      return [];
    }
    
    // Get the result of the condition evaluation from this node's output in the context
    const outputs = this.context.getOutput(this.id);
    // Condition result should be the last (or only) output stored by execute()
    const conditionResult = outputs.length > 0 ? outputs[outputs.length -1] as boolean : undefined; 
    
    const outcome = conditionResult === true ? 'true' : 'false'; 
    
    this._log(`Branching based on outcome: ${outcome}`); // Will use inherited _log

    const sourceHandle = outcome === 'true' ? `${this.id}-source-true` : `${this.id}-source-false`;
    this._log(`Looking for edges from sourceHandle: ${sourceHandle}`);


    const childNodeIds = contextEdges
      .filter((edge: any) => edge.source === this.id && edge.sourceHandle === sourceHandle)
      .map((edge: any) => edge.target);
      
    this._log(`Found ${childNodeIds.length} child nodes for outcome ${outcome}: [${childNodeIds.join(', ')}]`); // Will use inherited _log

    return childNodeIds
      .map((childId: string) => {
        const nodeData = contextNodes.find((n: any) => n.id === childId);
        if (!nodeData) {
          this._log(`Child node data not found for ${childId}`); // Will use inherited _log
          return null;
        }
        
        if (typeof nodeData.type !== 'string') {
          this._log(`Child node data for ${childId} has invalid or missing type: ${nodeData.type}. Skipping creation.`);
          return null;
        }

        try {
            const nodeInstance = nodeFactory.create(
              nodeData.id,
              nodeData.type,
              nodeData.data,
              this.context // Pass context to child creation
            );
            return nodeInstance;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this._log(`Error creating child node instance ${childId} (type: ${nodeData?.type}): ${errorMessage}`);
            return null;
        }
      })
      .filter((node): node is Node => node !== null);
  }
} 