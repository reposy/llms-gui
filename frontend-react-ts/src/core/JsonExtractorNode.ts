import { Node } from './Node';
import { FlowExecutionContext } from './FlowExecutionContext';
import { extractValue } from '../utils/flow/executionUtils.ts';
import { JSONExtractorNodeContent } from '../types/nodes.ts';

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
 * JSON Extractor node for extracting values from JSON objects.
 */
export class JsonExtractorNode extends Node {
  /**
   * Type assertion for property
   */
  declare property: JSONExtractorNodeContent;

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
   * Execute the JSON extraction
   */
  async execute(input: any): Promise<any> {
    this._log('Executing');
    
    if (input === null || input === undefined) {
      this._log('Input is null or undefined, returning null');
      return null;
    }

    // context가 있으면 context의 getNodeContentFunc를, 없으면 this.property를 사용
    let nodeContent: JSONExtractorNodeContent | undefined = undefined;
    if (this.context && typeof this.context.getNodeContentFunc === 'function') {
      nodeContent = this.context.getNodeContentFunc(this.id, this.type) as JSONExtractorNodeContent;
    } else {
      nodeContent = this.property as JSONExtractorNodeContent;
    }
    
    const path = nodeContent.path;
    const defaultValue = nodeContent.defaultValue;
    
    if (!path) {
      this._log('No path specified, returning input unchanged');
      return input;
    }

    this._log(`Extracting value at path: ${path}`);
    
    try {
      const result = extractValue(input, path);
      
      if (result === null || result === undefined) {
        if (defaultValue !== undefined) {
          this._log(`Path not found, using default value: ${JSON.stringify(defaultValue)}`);
          return defaultValue;
        } else {
          this._log('Path not found and no default value specified');
          return null;
        }
      }
      
      this._log(`Successfully extracted value: ${JSON.stringify(result).substring(0, 100)}${JSON.stringify(result).length > 100 ? '...' : ''}`);
      return result;
    } catch (error) {
      this._log(`Error extracting value: ${error instanceof Error ? error.message : String(error)}`);
      if (defaultValue !== undefined) {
        this._log(`Using default value: ${JSON.stringify(defaultValue)}`);
        return defaultValue;
      }
      throw error;
    }
  }
} 