import { Node } from './Node';
import { FlowExecutionContext } from './FlowExecutionContext';
import { extractValue } from '../utils/flow/executionUtils.ts';
import { useNodeContentStore } from '../store/useNodeContentStore.ts';
import { JSONExtractorNodeData } from '../types/nodes.ts';

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
  declare property: JSONExtractorNodeData;

  /**
   * Constructor for JsonExtractorNode
   */
  constructor(
    id: string,
    property: Record<string, any> = {},
    context?: FlowExecutionContext
  ) {
    super(id, 'json-extractor', property);
    
    // 생성자에서 context를 명시적으로 설정
    if (context) {
      this.context = context;
    }
  }


  /**
   * Execute the node's specific logic
   * @param input The input JSON to process
   * @returns The extracted value or null if not found
   */
  async execute(input: any): Promise<any> {
    this._log('Executing');

    // Get the latest content directly from the store within execute
    const nodeContent = useNodeContentStore.getState().getNodeContent(this.id, this.type) as JSONExtractorNodeData;
    
    const { 
      path,
      defaultValue = null // Default value if path not found or error
    } = nodeContent;

    if (!path) {
      const errorMsg = "JSON Path is required for JSONExtractorNode.";
      this.context?.markNodeError(this.id, errorMsg);
      this._log(`Error - ${errorMsg}`);
      return defaultValue; // Return default value on configuration error
    }

    this._log(`Extracting path: ${path}`);

    try {
      // Input can be a JSON string or a JavaScript object
      let jsonInput = input;
      if (typeof input === 'string') {
        try {
          jsonInput = JSON.parse(input);
          this._log('Parsed string input as JSON');
        } catch (parseError) {
          // If parsing fails, pass the raw string to extractValue, which might handle basic paths
          this._log('Input string is not valid JSON, attempting extraction on raw string.');
          // No need to throw error here, let extractValue handle the raw string
        }
      }
      
      // Use extractValue function
      const result = extractValue(jsonInput, path);
      
      if (result === undefined) {
        this._log('Path not found or extraction failed, returning default value');
        return defaultValue;
      } else {
        this._log('Extraction successful');
        return result;
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.context?.markNodeError(this.id, errorMessage);
      this._log(`Error - ${errorMessage}`);
      return defaultValue;
    }
  }
} 