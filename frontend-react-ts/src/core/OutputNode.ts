import { Node } from '../core/Node';
import { setNodeContent } from '../store/useNodeContentStore';

/**
 * Output node properties
 */
interface OutputNodeProperty {
  format: 'json' | 'text';
  data: any;
}

/**
 * Interface for Output node content in the store
 */
interface OutputNodeContent {
  content?: string;
  _forceUpdate?: number;
}

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
   * Execute the node's specific logic
   * Formats the input according to the output node's configuration
   * @param input The input to execute
   * @returns The formatted output
   */
  async execute(input: any): Promise<any> {    
    console.log(`OutputNode(${this.id}): Processing output with format ${this.property.format}`);
    
    try {
      // Check for null or undefined input
      if (input === null || input === undefined) {
        console.log(`OutputNode(${this.id}): Received null or undefined input`);
        const fallbackMessage = "[No input provided to OutputNode]";
        
        // Update the node content with the fallback message
        const contentUpdate: OutputNodeContent = { 
          content: fallbackMessage,
          _forceUpdate: Date.now() 
        };
        
        setNodeContent(this.id, contentUpdate, true);
        console.log(`OutputNode(${this.id}): Set fallback message in UI`);
        
        return fallbackMessage;
      }
      
      // Check for empty string input
      if (typeof input === 'string' && input.trim() === '') {
        console.log(`OutputNode(${this.id}): Received empty string input`);
        const fallbackMessage = "[Empty string received by OutputNode]";
        
        // Update the node content with the fallback message
        const contentUpdate: OutputNodeContent = { 
          content: fallbackMessage,
          _forceUpdate: Date.now() 
        };
        
        setNodeContent(this.id, contentUpdate, true);
        console.log(`OutputNode(${this.id}): Set fallback message in UI`);
        
        return fallbackMessage;
      }
      
      // Log the actual input we received
      console.log(`OutputNode(${this.id}): Received input: ${JSON.stringify(input).substring(0, 200)}`);
      
      // Save the input to the data field
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
          console.log(`OutputNode(${this.id}): ${formattedOutput}`);
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
        console.log(`OutputNode(${this.id}): Formatted output was empty, using fallback message`);
      }
      
      console.log(`OutputNode(${this.id}): Output formatted: "${formattedOutput.substring(0, 100)}..."`);
      
      // Update the node content in the store with timestamp to force UI update
      const contentUpdate: OutputNodeContent = { 
        content: formattedOutput,
        _forceUpdate: Date.now() 
      };
      
      setNodeContent(this.id, contentUpdate, true);
      console.log(`OutputNode(${this.id}): Updated UI content (length: ${formattedOutput?.length || 0})`);
      
      return formattedOutput;
    } catch (error) {
      // Log error but allow parent's process method to handle error marking
      console.error(`OutputNode(${this.id}): Error processing output: ${error}`);
      throw error;
    }
  }
} 