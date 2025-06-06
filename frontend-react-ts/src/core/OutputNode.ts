import { Node } from '../core/Node';
import { FlowExecutionContext } from './FlowExecutionContext';
import { OutputNodeProperty } from '../types/nodes';

/**
 * Interface for Output node content in the store
 */
// interface OutputNodeProperty {
//   content?: string;
//   _forceUpdate?: number;
// }

// Debounce helper to prevent too many updates
const debounce = (func: Function, wait: number) => {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: any[]) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      func(...args);
      timeout = null;
    }, wait);
  };
};

/**
 * Output node that displays or saves the result of a flow
 * Updated to work with object-oriented execution architecture
 * No longer depends on execution context
 */
export class OutputNode extends Node {
  /**
   * Type assertion for the property
   */
  declare property: OutputNodeProperty;
  
  /**
   * Constructor for OutputNode
   */
  constructor(
    id: string,
    property: OutputNodeProperty = { type: 'output', format: 'text', content: '', mode: 'read' },
    context?: FlowExecutionContext
  ) {
    super(id, 'output', property);
    // 생성자에서 context를 명시적으로 설정
    if (context) {
      this.context = context;
    }
    // debouncedSetContent 등 zustand 관련 코드 완전 제거
  }
  /**
   * Execute the node's specific logic
   * Formats the input according to the output node's configuration
   * @param input The input to execute
   * @returns The formatted output
   */
  async execute(input: any): Promise<any> {
    this._log('Executing');
    let nodeContent: OutputNodeProperty = this.property;
    if (this.context && typeof this.context.getNodePropertyFunc === 'function') {
      nodeContent = this.context.getNodePropertyFunc(this.id, this.type) as OutputNodeProperty;
    }
    const format = nodeContent.format || 'text';
    let outputData = input;
    if (format === 'json' && typeof input !== 'string') {
      try {
        outputData = JSON.stringify(input, null, 2);
        this._log('Formatted input as JSON');
      } catch (error) {
        outputData = String(input);
        this._log('Failed to format as JSON, using string representation');
      }
    } else {
      outputData = String(input);
      this._log(`Using string representation (format: ${format})`);
    }
    return outputData;
  }
} 