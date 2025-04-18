import { Node } from './Node';
import { FlowExecutionContext } from './FlowExecutionContext';
import { getNodeContent, JSONExtractorNodeContent } from '../store/nodeContentStore';
import { syncNodeProperties, jsonExtractorNodeSyncConfig } from '../utils/nodePropertySync'; 

/**
 * JSON Extractor node properties
 */
export interface JsonExtractorNodeProperty {
  path: string;
  defaultValue?: string;
  input?: any;
  nodeFactory?: any;
  [key: string]: any;
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
    
    // Initialize default properties
    this.property = {
      ...property,
      path: property.path || '',
      defaultValue: property.defaultValue || ''
    };
  }

  /**
   * Synchronize property from Zustand store before execution
   */
  syncPropertyFromStore(): void {
    // 공통 유틸리티 사용하여 속성 동기화
    syncNodeProperties(this, jsonExtractorNodeSyncConfig, 'json-extractor');
  }

  /**
   * Execute the node's specific logic
   * @param input The input JSON to process
   * @returns The extracted value or null if not found
   */
  async execute(input: any): Promise<any> {
    try {
      this.context?.markNodeRunning(this.id);
      
      // Save input for reference
      this.property.input = input;
      
      // Log the settings
      this.context?.log(`JsonExtractorNode(${this.id}): Extracting with path: ${this.property.path}`);
      
      // Validate path
      if (!this.property.path) {
        const errorMsg = "JSON path is required";
        this.context?.log(`JsonExtractorNode(${this.id}): ${errorMsg}`);
        this.context?.markNodeError(this.id, errorMsg);
        throw new Error(errorMsg);
      }
      
      // Parse input if it's a string
      let jsonData: any;
      if (typeof input === 'string') {
        try {
          jsonData = JSON.parse(input);
        } catch (e) {
          const errorMsg = "Input is not valid JSON: " + String(e);
          this.context?.log(`JsonExtractorNode(${this.id}): ${errorMsg}`);
          this.context?.markNodeError(this.id, errorMsg);
          throw new Error(errorMsg);
        }
      } else if (input && typeof input === 'object') {
        jsonData = input;
      } else {
        const errorMsg = "Input must be a JSON object or string";
        this.context?.log(`JsonExtractorNode(${this.id}): ${errorMsg}`);
        this.context?.markNodeError(this.id, errorMsg);
        throw new Error(errorMsg);
      }
      
      // Extract value using path
      const extractedValue = this.extractValue(jsonData, this.property.path);
      
      // Return extracted value or default
      if (extractedValue === undefined) {
        const message = `Path '${this.property.path}' not found in input`;
        this.context?.log(`JsonExtractorNode(${this.id}): ${message}`);
        
        // Use default value if provided
        if (this.property.defaultValue) {
          this.context?.log(`JsonExtractorNode(${this.id}): Using default value: ${this.property.defaultValue}`);
          this.context?.storeOutput(this.id, this.property.defaultValue);
          return this.property.defaultValue;
        }
        
        // Return null if no default value
        this.context?.log(`JsonExtractorNode(${this.id}): No default value provided, returning null`);
        this.context?.storeOutput(this.id, null);
        return null;
      }
      
      this.context?.log(`JsonExtractorNode(${this.id}): Successfully extracted value`);
      this.context?.storeOutput(this.id, extractedValue);
      return extractedValue;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.context?.log(`JsonExtractorNode(${this.id}): Error: ${errorMessage}`);
      this.context?.markNodeError(this.id, errorMessage);
      return null;
    }
  }
  
  /**
   * Extract a value from an object using a simple path notation
   */
  private extractValue(obj: any, path: string): any {
    const keys = path.split('.');
    let result = obj;
    
    for (const key of keys) {
      // Handle array indexing with bracket notation [n]
      if (key.includes('[') && key.includes(']')) {
        const baseKey = key.split('[')[0];
        const indexMatch = key.match(/\[(\d+)\]/);
        
        if (!indexMatch) {
          this.context?.log(`JsonExtractorNode(${this.id}): Invalid array index in path: ${key}`);
          return undefined;
        }
        
        const index = parseInt(indexMatch[1], 10);
        
        // Get the array first (if it exists)
        if (baseKey) {
          if (result[baseKey] === undefined) return undefined;
          result = result[baseKey];
        }
        
        // Then access the index
        if (!Array.isArray(result)) {
          this.context?.log(`JsonExtractorNode(${this.id}): ${baseKey || 'value'} is not an array`);
          return undefined;
        }
        
        if (index >= result.length) {
          this.context?.log(`JsonExtractorNode(${this.id}): Array index ${index} out of bounds`);
          return undefined;
        }
        
        result = result[index];
      } else {
        // Regular property access
        if (result === undefined || result === null || !(key in result)) {
          return undefined;
        }
        result = result[key];
      }
    }
    
    return result;
  }
} 