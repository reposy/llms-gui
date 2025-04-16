import { Node } from '../core/Node';
import { findNodeById, getOutgoingConnections } from '../utils/flowUtils';
import { FlowExecutionContext } from './FlowExecutionContext';

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
    // Debug the full property object
    this.context?.log(`ConditionalNode(${this.id}): Full property: ${JSON.stringify(this.property)}`);
    
    // Normalize property structure for backward compatibility
    this.normalizeProperties();
    
    // Log the condition info based on what's available
    if (this.property.conditionType) {
      this.context?.log(`ConditionalNode(${this.id}): Processing condition type: ${this.property.conditionType}, value: ${this.property.value}`);
    } else if (this.property.condition) {
      this.context?.log(`ConditionalNode(${this.id}): Processing legacy condition: ${this.property.condition}`);
    } else {
      this.context?.log(`ConditionalNode(${this.id}): No condition or condition type found`);
    }
    
    // Debug the input received
    this.context?.log(`ConditionalNode(${this.id}): Received input: ${typeof input === 'object' ? JSON.stringify(input) : input}`);
    
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
      
      this.context?.log(`ConditionalNode(${this.id}): Condition evaluated to ${conditionResult}`);
    } catch (error) {
      this.context?.log(`ConditionalNode(${this.id}): Error evaluating condition: ${error}`);
      // Default to false on error
      conditionResult = false;
    }
    
    // Determine which path to follow based on condition result
    const path = conditionResult ? 'true' : 'false';
    this.context?.log(`ConditionalNode(${this.id}): Result: following '${path}' path`);
    
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
      this.context?.log(`ConditionalNode(${this.id}): Found data property, checking for UI settings`);
      const { data } = this.property;
      
      // Extract values from UI data format if available
      if (data.conditionType) {
        this.property.conditionType = this.mapConditionType(data.conditionType);
        this.context?.log(`ConditionalNode(${this.id}): Found condition type in data: ${data.conditionType} -> ${this.property.conditionType}`);
      }
      
      if ('conditionValue' in data) {
        this.property.value = data.conditionValue;
        this.context?.log(`ConditionalNode(${this.id}): Found condition value in data: ${data.conditionValue}`);
      }
    }
    
    // Handle legacy conditionValue (used in UI) vs value (used in our implementation)
    if (this.property.conditionValue !== undefined && this.property.value === undefined) {
      this.property.value = this.property.conditionValue;
      this.context?.log(`ConditionalNode(${this.id}): Normalized conditionValue to value: ${this.property.value}`);
    }

    // Map the legacy 'contains' to 'containsSubstring'
    if (this.property.conditionType === 'contains') {
      this.property.conditionType = 'containsSubstring';
      this.context?.log(`ConditionalNode(${this.id}): Mapped 'contains' to 'containsSubstring'`);
    }

    // If no conditionType but we have a condition expression, use legacy mode
    if (!this.property.conditionType && this.property.condition) {
      this.context?.log(`ConditionalNode(${this.id}): Using legacy condition expression`);
    }
    
    // Default to a simple equality check if no condition is specified
    if (!this.property.conditionType && !this.property.condition) {
      this.property.conditionType = 'equalTo';
      this.property.value = "true"; // Default to checking if input is truthy - use string to match type
      this.context?.log(`ConditionalNode(${this.id}): No condition specified, defaulting to equalTo: true`);
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
        this.context?.log(`ConditionalNode(${this.id}): Unknown UI condition type: ${uiType}, falling back to equalTo`);
        return 'equalTo';
    }
  }

  /**
   * Evaluate the condition based on the condition type
   */
  private evaluateCondition(input: any): boolean {
    const { conditionType, value } = this.property;
    
    if (!conditionType) {
      this.context?.log(`ConditionalNode(${this.id}): No condition type specified`);
      return false;
    }

    // For primitive types like numbers and strings
    const inputValue = input && typeof input === 'object' && 'value' in input ? input.value : input;
    this.context?.log(`ConditionalNode(${this.id}): Evaluating ${inputValue} against condition ${conditionType} ${value}`);

    switch (conditionType) {
      case 'numberGreaterThan':
        // Convert input to number if it's a primitive value, otherwise try to compare directly
        if (typeof inputValue === 'object') {
          this.context?.log(`ConditionalNode(${this.id}): Input is an object, cannot do number comparison`);
          return false;
        }
        
        const numInput = Number(inputValue);
        const numValue = Number(value);
        
        if (isNaN(numInput) || isNaN(numValue)) {
          this.context?.log(`ConditionalNode(${this.id}): Invalid number conversion - input: ${numInput}, value: ${numValue}`);
          return false;
        }
        
        this.context?.log(`ConditionalNode(${this.id}): Comparing ${numInput} > ${numValue}`);
        return numInput > numValue;

      case 'numberLessThan':
        if (typeof inputValue === 'object') {
          this.context?.log(`ConditionalNode(${this.id}): Input is an object, cannot do number comparison`);
          return false;
        }
        
        const numInput2 = Number(inputValue);
        const numValue2 = Number(value);
        
        if (isNaN(numInput2) || isNaN(numValue2)) {
          this.context?.log(`ConditionalNode(${this.id}): Invalid number conversion - input: ${numInput2}, value: ${numValue2}`);
          return false;
        }
        
        this.context?.log(`ConditionalNode(${this.id}): Comparing ${numInput2} < ${numValue2}`);
        return numInput2 < numValue2;

      case 'equalTo':
        // For primitive values do direct comparison
        if (typeof inputValue !== 'object') {
          const result = String(inputValue) === String(value);
          this.context?.log(`ConditionalNode(${this.id}): Comparing equality: ${inputValue} === ${value} is ${result}`);
          return result;
        }
        // For objects, compare stringified versions
        return JSON.stringify(inputValue) === JSON.stringify(value);

      case 'containsSubstring':
        if (typeof inputValue !== 'string') {
          this.context?.log(`ConditionalNode(${this.id}): Cannot check substring on non-string input: ${typeof inputValue}`);
          return false;
        }
        
        if (typeof value !== 'string') {
          this.context?.log(`ConditionalNode(${this.id}): Cannot check substring with non-string value: ${typeof value}`);
          return false;
        }
        
        const containsResult = inputValue.includes(value);
        this.context?.log(`ConditionalNode(${this.id}): Checking if "${inputValue}" contains "${value}": ${containsResult}`);
        return containsResult;

      case 'jsonPathExistsTruthy':
        // Allow input to be either a string that's JSON parseable, or an object
        let jsonObject: any;
        
        if (typeof inputValue === 'string') {
          try {
            jsonObject = JSON.parse(inputValue);
            this.context?.log(`ConditionalNode(${this.id}): Parsed input string as JSON object`);
          } catch (e) {
            this.context?.log(`ConditionalNode(${this.id}): Cannot parse input as JSON: ${e}`);
            return false;
          }
        } else if (typeof inputValue === 'object' && inputValue !== null) {
          jsonObject = inputValue;
          this.context?.log(`ConditionalNode(${this.id}): Using input as JSON object directly`);
        } else {
          this.context?.log(`ConditionalNode(${this.id}): Input is not a JSON object or JSON string`);
          return false;
        }
        
        // Get the path to check
        const pathToCheck = typeof value === 'string' ? value : String(value);
        this.context?.log(`ConditionalNode(${this.id}): Checking JSON path: ${pathToCheck}`);
        
        // Split the path by dots and traverse the object
        const pathParts = pathToCheck.split('.');
        let current = jsonObject;
        
        for (const part of pathParts) {
          if (current === undefined || current === null) {
            this.context?.log(`ConditionalNode(${this.id}): Path traversal stopped at null/undefined value`);
            return false;
          }
          
          current = current[part];
        }
        
        const pathExists = Boolean(current);
        this.context?.log(`ConditionalNode(${this.id}): JSON path exists and is truthy: ${pathExists}`);
        return pathExists;

      default:
        this.context?.log(`ConditionalNode(${this.id}): Unknown condition type: ${conditionType}`);
        return false;
    }
  }

  /**
   * Get child nodes based on the condition result path
   */
  getChildNodes(): Node[] {
    const executionGraph = this.property.executionGraph;
    const nodeFactory = this.property.nodeFactory;

    if (!executionGraph || !nodeFactory) {
      return [];
    }

    return this.getChildNodesForPath('true');
  }

  /**
   * Get child nodes specifically for the given path result
   */
  private getChildNodesForPath(path: 'true' | 'false'): Node[] {
    const { nodes, edges, nodeFactory } = this.property;
    
    if (!nodes || !edges || !nodeFactory) {
      this.context?.log(`ConditionalNode(${this.id}): Missing nodes, edges, or factory. Cannot resolve child nodes.`);
      return [];
    }
    
    // Map the path to the corresponding sourceHandle
    const sourceHandle = path === 'true' ? 'trueHandle' : 'falseHandle';
    
    // Get outgoing connections that match the specified path
    const pathConnections = getOutgoingConnections(this.id, edges)
      .filter(connection => connection.sourceHandle === sourceHandle);
    
    if (pathConnections.length === 0) {
      this.context?.log(`ConditionalNode(${this.id}): No connections found for path '${path}' (handle: ${sourceHandle})`);
      return [];
    }
    
    this.context?.log(`ConditionalNode(${this.id}): Found ${pathConnections.length} connections for path '${path}'`);
    
    // Create node instances for all connected nodes on this path
    return pathConnections
      .map(connection => {
        const targetNode = findNodeById(connection.targetNodeId, nodes);
        if (!targetNode) {
          this.context?.log(`ConditionalNode(${this.id}): Could not find target node ${connection.targetNodeId}`);
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
          this.context?.log(`ConditionalNode(${this.id}): Error creating child node: ${error}`);
          return null;
        }
      })
      .filter((node): node is Node => node !== null);
  }
} 