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
   * Execute this node with the given input and propagate to child nodes
   * This overrides the base Node.execute method to ensure proper UI status updates
   * @param input The input value to process
   */
  async execute(input: any): Promise<void> {
    try {
      // Mark the node as running
      this.context.markNodeRunning(this.id);
      
      // Process the input according to this node's specific logic
      const result = await this.process(input);
      
      // Store the result in the execution context
      this.context.storeOutput(this.id, result);
      
      // Mark node as successful
      this.context.markNodeSuccess(this.id, result);
      
      // Get all child nodes and execute them with the result
      const childNodes = this.getChildNodes();
      
      if (childNodes.length > 0) {
        console.log(`OutputNode(${this.id}): Propagating result to ${childNodes.length} child nodes`);
        
        // Execute each child with the result
        for (const child of childNodes) {
          await child.execute(result);
        }
      } else {
        console.log(`OutputNode(${this.id}): No child nodes to execute`);
      }
    } catch (error) {
      console.error(`OutputNode(${this.id}): Execution failed: ${error}`);
      this.context.markNodeError(this.id, String(error));
      throw error;
    }
  }
  
  /**
   * Process the input according to the output node's configuration
   * Saves the input to the data field and formats it according to the format field
   */
  async process(input: any): Promise<any> {
    // Mark the node as running
    this.context.markNodeRunning(this.id);
    
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
        
        // Mark node as successful with the fallback message
        this.context.markNodeSuccess(this.id, fallbackMessage);
        
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
        
        // Mark node as successful with the fallback message
        this.context.markNodeSuccess(this.id, fallbackMessage);
        
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
      
      // Store the result in the execution context
      this.context.storeOutput(this.id, formattedOutput);
      
      // Mark node as successful
      this.context.markNodeSuccess(this.id, formattedOutput);
      
      // Get all child nodes and process them with the result
      const childNodes = this.getChildNodes();
      
      if (childNodes.length > 0) {
        console.log(`OutputNode(${this.id}): Propagating result to ${childNodes.length} child nodes`);
        
        // Process each child with the result
        for (const child of childNodes) {
          await child.process(formattedOutput);
        }
      } else {
        console.log(`OutputNode(${this.id}): No child nodes to process`);
      }
      
      // Return the formatted output for potential further processing
      return formattedOutput;
    } catch (error) {
      // Mark node as error
      console.error(`OutputNode(${this.id}): Error processing output: ${error}`);
      this.context.markNodeError(this.id, String(error));
      throw error;
    }
  }
} 