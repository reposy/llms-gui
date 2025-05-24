import { Node } from '../core/Node';
import { FlowExecutionContext } from './FlowExecutionContext';
import { OutputNodeContent } from '../types/nodes';

/**
 * Output node properties
 */
interface OutputNodeProperty {
  format: 'json' | 'text';
  data: any;
  lastContent?: string; // Track last content to avoid redundant updates
}

/**
 * Interface for Output node content in the store
 */
// interface OutputNodeContent {
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
    property: OutputNodeProperty = { format: 'text', data: null },
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

    // context가 있으면 context의 getNodeContentFunc를, 없으면 this.property를 사용
    let nodeContent: OutputNodeContent | undefined = undefined;
    if (this.context && typeof this.context.getNodeContentFunc === 'function') {
      nodeContent = this.context.getNodeContentFunc(this.id, this.type) as OutputNodeContent;
    } else {
      nodeContent = this.property as OutputNodeContent;
    }
    const format = nodeContent.format || 'text'; // Default to text if not set

    let outputData = input;
    
    if (format === 'json' && typeof input !== 'string') {
      try {
        // Attempt to stringify non-string input as JSON
        outputData = JSON.stringify(input, null, 2);
        this._log('Formatted input as JSON');
      } catch (error) {
        // If stringify fails, fallback to string conversion
        outputData = String(input);
        this._log('Failed to format as JSON, using string representation');
      }
    } else {
      // For text format or if input is already a string, ensure it's a string
      outputData = String(input);
      this._log(`Using string representation (format: ${format})`);
    }

    // OutputNode는 형식화된 결과를 반환합니다.
    return outputData;
  }
} 