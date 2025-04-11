import { Node } from '../core/Node';
import { FlowExecutionContext } from '../core/FlowExecutionContext';

/**
 * Input node properties
 */
interface InputNodeProperty {
  mode: 'batch' | 'foreach';
  items: any[];
}

/**
 * Input node that provides data to the flow
 */
export class InputNode extends Node {
  /**
   * Type assertion for the property
   */
  declare property: InputNodeProperty;
  
  /**
   * Process the input according to the input node's configuration
   * - In batch mode: returns all items as an array
   * - In foreach mode: processes items one by one
   */
  async process(input: any): Promise<any> {
    this.context.log(`InputNode(${this.id}): Processing in ${this.property.mode} mode`);
    
    if (!this.property.items || !Array.isArray(this.property.items)) {
      this.context.log(`InputNode(${this.id}): No items provided or items is not an array`);
      return [];
    }
    
    // In batch mode, return all items as an array
    if (this.property.mode === 'batch') {
      return this.property.items;
    }
    
    // In foreach mode, we would normally trigger child nodes for each item individually
    // However, for now, we'll just return the items and handle the foreach logic in execute()
    return this.property.items;
  }
  
  /**
   * Get child nodes that should be executed next
   * This will be implemented when we have node connections
   */
  getChildNodes(): Node[] {
    // For now, return empty array as we don't have node connections yet
    return [];
  }
  
  /**
   * Override execute for foreach mode to process items one by one
   */
  async execute(input: any): Promise<void> {
    this.input = structuredClone(input);
    const result = await this.process(input);
    
    // For foreach mode, process each item individually
    if (this.property.mode === 'foreach' && Array.isArray(result) && result.length > 0) {
      for (const item of result) {
        this.context.log(`InputNode(${this.id}): Processing item in foreach mode`);
        
        // Process each child with the current item
        for (const child of this.getChildNodes()) {
          await child.execute(item);
        }
      }
    } else {
      // For batch mode or non-array results, use the standard execution
      for (const child of this.getChildNodes()) {
        await child.execute(result);
      }
    }
  }
} 