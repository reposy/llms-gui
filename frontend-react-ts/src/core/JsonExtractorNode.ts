import { Node } from './Node';
import { FlowExecutionContext } from './FlowExecutionContext';
import { getNodeContent } from '../store/useNodeContentStore';
import { JSONExtractorNodeContent } from '../store/useNodeContentStore';

/**
 * Interface for JSON Extractor node properties
 */
export interface JsonExtractorNodeProperty {
  path: string;
  label?: string;
  executionGraph?: Map<string, string[]>;
  nodes?: any[];
  edges?: any[];
  nodeFactory?: any;
}

/**
 * JSON Extractor node that extracts a nested value from JSON input using a dot path
 */
export class JsonExtractorNode extends Node {
  /**
   * Type assertion for property
   */
  declare property: JsonExtractorNodeProperty;

  /**
   * Constructor for JsonExtractorNode
   */
  constructor(
    id: string,
    property: Record<string, any> = {},
    context?: FlowExecutionContext
  ) {
    super(id, 'json-extractor', property, context);
    // Ensure path has a default value
    this.property.path = property.path || '';
  }

  /**
   * Synchronize property from Zustand store before execution
   */
  syncPropertyFromStore(): void {
    const content = getNodeContent(this.id) as JSONExtractorNodeContent;
    if (content) {
      if (typeof content.path === 'string') this.property.path = content.path;
      if (typeof content.label === 'string') this.property.label = content.label;
      if (content.executionGraph) this.property.executionGraph = content.executionGraph;
      if (content.nodes) this.property.nodes = content.nodes;
      if (content.edges) this.property.edges = content.edges;
      if (content.nodeFactory) this.property.nodeFactory = content.nodeFactory;
    }
  }

  /**
   * Execute the node's specific logic
   * @param input The input JSON to process
   * @returns The extracted value or null if not found
   */
  async execute(input: any): Promise<any> {
    this.context?.log(`JsonExtractorNode(${this.id}): Processing with path "${this.property.path}"`);
    
    // Handle null or undefined input
    if (input === null || input === undefined) {
      this.context?.log(`JsonExtractorNode(${this.id}): Input is ${input}, cannot extract value`);
      return null;
    }

    try {
      // Clone input to avoid side effects
      const safeInput = structuredClone(input);
      
      // Get the path from properties
      const path = this.property.path || '';
      
      if (!path) {
        this.context?.log(`JsonExtractorNode(${this.id}): No path specified, returning input as-is`);
        return safeInput;
      }

      // Split the path by dots to get individual keys
      const pathParts = path.split('.');
      
      this.context?.log(`JsonExtractorNode(${this.id}): Extracting path ${pathParts.join(' → ')}`);
      
      // Extract the nested value by traversing the path
      let currentValue = safeInput;
      
      for (let i = 0; i < pathParts.length; i++) {
        const part = pathParts[i];
        
        // Handle array indices (e.g., items[0])
        const arrayMatch = part.match(/^([^"]+)\[(\d+)\]$/);
        
        if (arrayMatch) {
          // Extract array name and index
          const [_, arrayName, indexStr] = arrayMatch;
          const index = parseInt(indexStr, 10);
          
          // First access the array
          if (currentValue[arrayName] === undefined || currentValue[arrayName] === null) {
            this.context?.log(`JsonExtractorNode(${this.id}): Path part '${arrayName}' not found`);
            return null;
          }
          
          currentValue = currentValue[arrayName];
          
          // Then access the index if it's an array
          if (!Array.isArray(currentValue)) {
            this.context?.log(`JsonExtractorNode(${this.id}): '${arrayName}' is not an array`);
            return null;
          }
          
          if (index >= currentValue.length) {
            this.context?.log(`JsonExtractorNode(${this.id}): Array index ${index} out of bounds`);
            return null;
          }
          
          currentValue = currentValue[index];
          this.context?.log(`JsonExtractorNode(${this.id}): Accessed array element ${arrayName}[${index}]`);
        } else {
          // Regular object property access
          if (currentValue[part] === undefined || currentValue[part] === null) {
            this.context?.log(`JsonExtractorNode(${this.id}): Path part '${part}' not found or null`);
            return null;
          }
          
          currentValue = currentValue[part];
          this.context?.log(`JsonExtractorNode(${this.id}): Accessed property '${part}'`);
        }
      }
      
      this.context?.log(`JsonExtractorNode(${this.id}): Successfully extracted value: ${
        typeof currentValue === 'object' 
          ? JSON.stringify(currentValue) 
          : currentValue
      }`);
      
      return currentValue;
    } catch (error) {
      this.context?.log(`JsonExtractorNode(${this.id}): Error extracting value - ${error}`);
      return null;
    }
  }
} 