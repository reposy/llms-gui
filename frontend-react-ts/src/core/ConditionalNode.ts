import { Node } from '../core/Node';
import { findNodeById, getOutgoingConnections } from '../utils/flowUtils';

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
  declare property: ConditionalNodeProperty;
  
  /**
   * Execute the input according to the conditional node's configuration
   * Evaluates the condition and returns the appropriate path information
   * @param input The input to process
   * @returns The original input and path result for child propagation
   */
  async execute(input: any): Promise<any> {
    // Debug the full property object
    this.context.log(`ConditionalNode(${this.id}): Full property: ${JSON.stringify(this.property)}`);
    
    // Normalize property structure for backward compatibility
    this.normalizeProperties();
    
    // Log the condition info based on what's available
    if (this.property.conditionType) {
      this.context.log(`ConditionalNode(${this.id}): Processing condition type: ${this.property.conditionType}, value: ${this.property.value}`);
    } else if (this.property.condition) {
      this.context.log(`ConditionalNode(${this.id}): Processing legacy condition: ${this.property.condition}`);
    } else {
      this.context.log(`ConditionalNode(${this.id}): No condition or condition type found`);
    }
    
    // Debug the input received
    this.context.log(`ConditionalNode(${this.id}): Received input: ${typeof input === 'object' ? JSON.stringify(input) : input}`);
    
    // Clone input to avoid side effects
    const safeInput = structuredClone(input);
    
    // Evaluate the condition based on condition type or legacy condition
    let conditionResult = false;
    try {
      if (this.property.conditionType) {
        conditionResult = this.evaluateCondition(safeInput);
      } else if (this.property.condition) {
        // Legacy condition evaluation using Function constructor
        const evalFunc = new Function('input', `return Boolean(${this.property.condition});`);
        conditionResult = evalFunc.call(null, safeInput);
      }
      
      this.context.log(`ConditionalNode(${this.id}): Condition evaluated to ${conditionResult}`);
    } catch (error) {
      this.context.log(`ConditionalNode(${this.id}): Error evaluating condition: ${error}`);
      // Default to false on error
      conditionResult = false;
    }
    
    // Determine which path to follow based on condition result
    const path = conditionResult ? 'true' : 'false';
    this.context.log(`ConditionalNode(${this.id}): Result: following '${path}' path`);
    
    // Store the path result with the input for potential UI feedback
    const result = {
      input: safeInput,
      path: path,
      conditionResult: conditionResult
    };
    
    // Return the result with condition evaluation for process() to handle propagation
    return result;
  }

  /**
   * Normalize properties to handle legacy and new property names
   */
  private normalizeProperties(): void {
    // Check for UI-specific data format and extract relevant fields
    if (this.property.data) {
      this.context.log(`ConditionalNode(${this.id}): Found data property, checking for UI settings`);
      const { data } = this.property;
      
      // Extract values from UI data format if available
      if (data.conditionType) {
        this.property.conditionType = this.mapConditionType(data.conditionType);
        this.context.log(`ConditionalNode(${this.id}): Found condition type in data: ${data.conditionType} -> ${this.property.conditionType}`);
      }
      
      if ('conditionValue' in data) {
        this.property.value = data.conditionValue;
        this.context.log(`ConditionalNode(${this.id}): Found condition value in data: ${data.conditionValue}`);
      }
    }
    
    // Handle legacy conditionValue (used in UI) vs value (used in our implementation)
    if (this.property.conditionValue !== undefined && this.property.value === undefined) {
      this.property.value = this.property.conditionValue;
      this.context.log(`ConditionalNode(${this.id}): Normalized conditionValue to value: ${this.property.value}`);
    }

    // Map the legacy 'contains' to 'containsSubstring'
    if (this.property.conditionType === 'contains') {
      this.property.conditionType = 'containsSubstring';
      this.context.log(`ConditionalNode(${this.id}): Mapped 'contains' to 'containsSubstring'`);
    }

    // If no conditionType but we have a condition expression, use legacy mode
    if (!this.property.conditionType && this.property.condition) {
      this.context.log(`ConditionalNode(${this.id}): Using legacy condition expression`);
    }
    
    // Default to a simple equality check if no condition is specified
    if (!this.property.conditionType && !this.property.condition) {
      this.property.conditionType = 'equalTo';
      this.property.value = "true"; // Default to checking if input is truthy - use string to match type
      this.context.log(`ConditionalNode(${this.id}): No condition specified, defaulting to equalTo: true`);
    }
  }

  /**
   * Map UI condition type to internal condition type
   */
  private mapConditionType(uiType: string): ConditionType {
    switch (uiType) {
      case 'Number Greater Than':
        return 'numberGreaterThan';
      case 'Number Less Than':
        return 'numberLessThan';
      case 'Equal To':
        return 'equalTo';
      case 'Contains Substring':
      case 'contains':
        return 'containsSubstring';
      case 'JSON Path Exists/Truthy':
        return 'jsonPathExistsTruthy';
      default:
        this.context.log(`ConditionalNode(${this.id}): Unknown UI condition type: ${uiType}, falling back to equalTo`);
        return 'equalTo';
    }
  }

  /**
   * Evaluate the condition based on the condition type
   */
  private evaluateCondition(input: any): boolean {
    const { conditionType, value } = this.property;
    
    if (!conditionType) {
      this.context.log(`ConditionalNode(${this.id}): No condition type specified`);
      return false;
    }

    // For primitive types like numbers and strings
    const inputValue = input && typeof input === 'object' && 'value' in input ? input.value : input;
    this.context.log(`ConditionalNode(${this.id}): Evaluating ${inputValue} against condition ${conditionType} ${value}`);

    switch (conditionType) {
      case 'numberGreaterThan':
        // Convert input to number if it's a primitive value, otherwise try to compare directly
        if (typeof inputValue === 'object') {
          this.context.log(`ConditionalNode(${this.id}): Input is an object, cannot do number comparison`);
          return false;
        }
        
        const numInput = Number(inputValue);
        const numValue = Number(value);
        
        if (isNaN(numInput) || isNaN(numValue)) {
          this.context.log(`ConditionalNode(${this.id}): Invalid number conversion - input: ${numInput}, value: ${numValue}`);
          return false;
        }
        
        this.context.log(`ConditionalNode(${this.id}): Comparing ${numInput} > ${numValue}`);
        return numInput > numValue;

      case 'numberLessThan':
        if (typeof inputValue === 'object') {
          this.context.log(`ConditionalNode(${this.id}): Input is an object, cannot do number comparison`);
          return false;
        }
        
        const numInput2 = Number(inputValue);
        const numValue2 = Number(value);
        
        if (isNaN(numInput2) || isNaN(numValue2)) {
          this.context.log(`ConditionalNode(${this.id}): Invalid number conversion - input: ${numInput2}, value: ${numValue2}`);
          return false;
        }
        
        this.context.log(`ConditionalNode(${this.id}): Comparing ${numInput2} < ${numValue2}`);
        return numInput2 < numValue2;

      case 'equalTo':
        // For primitive values do direct comparison
        if (typeof inputValue !== 'object') {
          const result = String(inputValue) === String(value);
          this.context.log(`ConditionalNode(${this.id}): Comparing equality: ${inputValue} === ${value} is ${result}`);
          return result;
        }
        // For objects, compare stringified versions
        return JSON.stringify(inputValue) === JSON.stringify(value);

      case 'containsSubstring':
        // Only strings can contain substrings
        if (typeof inputValue !== 'string') {
          const inputStr = String(inputValue);
          const valueStr = String(value);
          const result = inputStr.includes(valueStr);
          this.context.log(`ConditionalNode(${this.id}): Checking contains: ${inputStr}.includes(${valueStr}) is ${result}`);
          return result;
        }
        return inputValue.includes(String(value));

      case 'jsonPathExistsTruthy':
        // Path should be a string like "data.user.name"
        try {
          const path = String(value).split('.');
          let current = inputValue;
          
          // Navigate through the path
          for (const key of path) {
            if (current === null || current === undefined || typeof current !== 'object') {
              return false;
            }
            current = current[key];
          }
          
          // Check if the final value is truthy
          return Boolean(current);
        } catch (e) {
          return false;
        }

      default:
        this.context.log(`ConditionalNode(${this.id}): Unknown condition type: ${conditionType}`);
        return false;
    }
  }
  
  /**
   * Get child nodes that should be executed based on the condition result
   * Overrides the base getChildNodes() to filter for only the appropriate path
   * @returns Array of child nodes for the selected path
   */
  getChildNodes(): Node[] {
    const output = this.context.getOutput(this.id);
    
    if (!output || typeof output !== 'object' || !('path' in output)) {
      this.context.log(`ConditionalNode(${this.id}): No valid output with path found, returning no child nodes`);
      return [];
    }
    
    const path = output.path as 'true' | 'false';
    return this.getChildNodesForPath(path);
  }

  /**
   * Get child nodes for a specific conditional path
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