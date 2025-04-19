import { Node } from '../core/Node';
import { FlowExecutionContext } from './FlowExecutionContext';
import { OutputNodeContent, useNodeContentStore } from '../store/useNodeContentStore';

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
  
  // Debounced version of setNodeContent to prevent rapid updates
  private debouncedSetContent: (nodeId: string, content: OutputNodeContent) => void;
  
  /**
   * Constructor for OutputNode
   */
  constructor(
    id: string,
    property: OutputNodeProperty = { format: 'text', data: null },
    context?: FlowExecutionContext
  ) {
    super(id, 'output', property, context);
    
    // Initialize debounced content setter
    this.debouncedSetContent = debounce(useNodeContentStore.getState().setNodeContent, 100);
  }

  /**
   * Execute the node's specific logic
   * Formats the input according to the output node's configuration
   * @param input The input to execute
   * @returns The formatted output
   */
  async execute(input: any): Promise<any> {
    this.context?.log(`${this.type}(${this.id}): Executing`);

    // Get the latest content directly from the store within execute
    const nodeContent = useNodeContentStore.getState().getNodeContent<OutputNodeContent>(this.id, this.type);
    const format = nodeContent.format || 'text'; // Default to text if not set

    let outputData = input;
    
    if (format === 'json' && typeof input !== 'string') {
      try {
        // Attempt to stringify non-string input as JSON
        outputData = JSON.stringify(input, null, 2);
        this.context?.log(`${this.type}(${this.id}): Formatted input as JSON`);
      } catch (error) {
        // If stringify fails, fallback to string conversion
        outputData = String(input);
        this.context?.log(`${this.type}(${this.id}): Failed to format as JSON, using string representation`);
      }
    } else {
      // For text format or if input is already a string, ensure it's a string
      outputData = String(input);
      this.context?.log(`${this.type}(${this.id}): Using string representation (format: ${format})`);
    }

    // Store the formatted output in the node's content in the store
    useNodeContentStore.getState().setNodeContent(this.id, { content: outputData });
    this.context?.log(`${this.type}(${this.id}): Stored output in node content`);
    
    // Store the output in the execution context as well
    this.context?.storeOutput(this.id, outputData);

    // Output node should pass the input through, so return the original input
    // The formatted output is stored in the node content for display purposes.
    return input;
  }
} 