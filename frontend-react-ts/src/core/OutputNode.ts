import { Node } from '../core/Node';
import { setNodeContent, getNodeContent } from '../store/useNodeContentStore';
import { FlowExecutionContext } from './FlowExecutionContext';
import { isEqual } from 'lodash';
import { OutputNodeContent } from '../store/useNodeContentStore';

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
    this.debouncedSetContent = debounce(setNodeContent, 100);
  }

  /**
   * Synchronize property from Zustand store before execution
   */
  syncPropertyFromStore(): void {
    const content = getNodeContent(this.id) as OutputNodeContent;
    if (content) {
      if (typeof content.format === 'string') this.property.format = content.format as 'json' | 'text';
      if (content.data !== undefined) this.property.data = content.data;
      if (typeof content.content === 'string') this.property.lastContent = content.content;
    }
  }
  
  /**
   * Execute the node's specific logic
   * Formats the input according to the output node's configuration
   * @param input The input to execute
   * @returns The formatted output
   */
  async execute(input: any): Promise<any> {    
    this.context?.log(`OutputNode(${this.id}): Processing output with format ${this.property.format}`);
    
    try {
      // Get current content from store to compare
      const currentContent = getNodeContent(this.id) as OutputNodeContent;
      
      // Check for null or undefined input
      if (input === null || input === undefined) {
        this.context?.log(`OutputNode(${this.id}): Received null or undefined input`);
        const fallbackMessage = "[No input provided to OutputNode]";
        
        // Only update if content has changed
        if (currentContent.content !== fallbackMessage) {
          // Update the node content with the fallback message
          this.updateContentIfChanged(fallbackMessage);
        }
        
        return fallbackMessage;
      }
      
      // Check for empty string input
      if (typeof input === 'string' && input.trim() === '') {
        this.context?.log(`OutputNode(${this.id}): Received empty string input`);
        const fallbackMessage = "[Empty string received by OutputNode]";
        
        // Only update if content has changed
        if (currentContent.content !== fallbackMessage) {
          this.updateContentIfChanged(fallbackMessage);
        }
        
        return fallbackMessage;
      }
      
      // Log the actual input we received
      this.context?.log(`OutputNode(${this.id}): Received input: ${JSON.stringify(input).substring(0, 200)}`);
      
      // Save the input to the data field (don't trigger updates yet)
      this.property.data = input;
      
      // Format the output according to the format field
      let formattedOutput: string;
      
      if (this.property.format === 'json') {
        try {
          formattedOutput = typeof input === 'string' 
            ? input 
            : JSON.stringify(input, null, 2);
        } catch (error) {
          formattedOutput = `Error formatting as JSON: ${error}`;
          this.context?.log(`OutputNode(${this.id}): ${formattedOutput}`);
        }
      } else {
        // Format as text
        formattedOutput = typeof input === 'string' 
          ? input 
          : JSON.stringify(input);
      }
      
      // Check if we still have an empty formatted output after processing
      if (!formattedOutput || formattedOutput.trim() === '') {
        formattedOutput = "[LLM generated empty response]";
        this.context?.log(`OutputNode(${this.id}): Formatted output was empty, using fallback message`);
      }
      
      this.context?.log(`OutputNode(${this.id}): Output formatted (${formattedOutput.length} chars)`);
      
      // Only update content if it has changed to prevent infinite updates
      this.updateContentIfChanged(formattedOutput);
      
      return formattedOutput;
    } catch (error) {
      // Log error but allow parent's process method to handle error marking
      this.context?.log(`OutputNode(${this.id}): Error processing output: ${error}`);
      console.error(`OutputNode(${this.id}): Error processing output: ${error}`);
      throw error;
    }
  }
  
  /**
   * Helper to update content only if it's changed from previous value
   * This prevents infinite update loops
   */
  private updateContentIfChanged(newContent: string): void {
    // Skip update if content hasn't changed
    if (this.property.lastContent === newContent) {
      this.context?.log(`OutputNode(${this.id}): Content unchanged, skipping update`);
      return;
    }
    
    // Check if the content is already in the store
    const existingContent = getNodeContent(this.id) as OutputNodeContent;
    if (existingContent && existingContent.content === newContent) {
      this.context?.log(`OutputNode(${this.id}): Content already in store, skipping update`);
      return;
    }
    
    // For arrays and objects, do a deep comparison
    if (this.property.lastContent && typeof this.property.lastContent === 'string' && 
        newContent && typeof newContent === 'string') {
      try {
        // If both are JSON strings, parse and compare
        if (this.property.lastContent.startsWith('[') || this.property.lastContent.startsWith('{')) {
          const lastObj = JSON.parse(this.property.lastContent);
          const newObj = JSON.parse(newContent);
          
          if (isEqual(lastObj, newObj)) {
            this.context?.log(`OutputNode(${this.id}): Content semantically unchanged, skipping update`);
            return;
          }
        }
      } catch (e) {
        // If there's an error in parsing, fall back to string comparison
        // which we've already done above
      }
    }
    
    // Update the last content tracker in memory
    this.property.lastContent = newContent;
    
    // Update the node content in the store with timestamp to force UI update
    const contentUpdate: OutputNodeContent = { 
      content: newContent,
      _forceUpdate: Date.now() 
    };
    
    // Use the debounced version to prevent too many updates in quick succession
    this.debouncedSetContent(this.id, contentUpdate);
    this.context?.log(`OutputNode(${this.id}): Updated UI content (length: ${newContent?.length || 0})`);
  }
} 