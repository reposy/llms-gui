import { Node } from '../core/Node';
import { FlowExecutionContext } from '../core/FlowExecutionContext';
import { setNodeContent } from '../store/useNodeContentStore';

/**
 * Output node properties
 */
interface OutputNodeProperty {
  format: 'json' | 'text';
  data: any;
}

/**
 * Output node that displays or saves the result of a flow
 */
export class OutputNode extends Node {
  /**
   * Type assertion for the property
   */
  declare property: OutputNodeProperty;
  
  /**
   * Process the input according to the output node's configuration
   * Saves the input to the data field and formats it according to the format field
   */
  async process(input: any): Promise<any> {
    this.context.log(`OutputNode(${this.id}): Processing output with format ${this.property.format}`);
    
    // Log the actual input we received
    this.context.log(`OutputNode(${this.id}): Received input: ${JSON.stringify(input).substring(0, 200)}`);
    
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
        this.context.log(`OutputNode(${this.id}): ${formattedOutput}`);
      }
    } else {
      // Format as text
      formattedOutput = typeof input === 'string' 
        ? input 
        : JSON.stringify(input);
    }
    
    this.context.log(`OutputNode(${this.id}): Output formatted: "${formattedOutput.substring(0, 100)}..."`);
    
    // IMPORTANT: Update the node content store to reflect this output in the UI
    // This ensures the UI will update with the new content, bypassing potential equality checks
    setNodeContent(this.id, { 
      content: formattedOutput 
    }, true);
    
    // Also store in the execution context for later retrieval
    this.context.storeOutput(this.id, formattedOutput);
    
    // Return the formatted output for potential further processing
    return formattedOutput;
  }
} 