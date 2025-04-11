import { Node } from '../core/Node';
import { FlowExecutionContext } from '../core/FlowExecutionContext';

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
    
    this.context.log(`OutputNode(${this.id}): Output: ${formattedOutput}`);
    
    // Return the input unchanged for potential further processing
    return input;
  }
  
  /**
   * Get child nodes that should be executed next
   * Output nodes typically don't have child nodes
   */
  getChildNodes(): Node[] {
    // Output nodes are usually terminal nodes, but we could support chaining if needed
    return [];
  }
} 