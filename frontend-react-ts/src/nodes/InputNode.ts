import { Node } from '../core/Node';
import { getNodeContent, InputNodeContent } from '../store/useNodeContentStore';

/**
 * Input node properties
 */
interface InputNodeProperty {
  executionMode?: 'batch' | 'foreach';
  items?: any[];
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
   * Retrieves the items from node data, content store, or text
   * @returns Array of items to process
   */
  private getItems(): any[] {
    // Get the current node content from the store to ensure we have the latest settings
    const nodeContent = getNodeContent(this.id) as InputNodeContent;
    
    // Ensure we have the executionMode from the node content
    if (!this.property.executionMode && nodeContent && 'executionMode' in nodeContent) {
      this.property.executionMode = nodeContent.executionMode as 'batch' | 'foreach';
    }
    
    this.context.log(`InputNode(${this.id}): Retrieving items with executionMode=${this.property.executionMode || 'batch'}`);
    
    // First check property.items which contains runtime state
    if (this.property.items && Array.isArray(this.property.items) && this.property.items.length > 0) {
      this.context.log(`InputNode(${this.id}): Using ${this.property.items.length} items from property`);
      return [...this.property.items];
    }
    
    // If no items in property, check node content store
    if (nodeContent?.items && Array.isArray(nodeContent.items) && nodeContent.items.length > 0) {
      this.context.log(`InputNode(${this.id}): Using ${nodeContent.items.length} items from content store`);
      return [...nodeContent.items];
    }
    
    // Check for textBuffer in nodeContent
    if (nodeContent?.textBuffer) {
      const items = nodeContent.textBuffer.split(/\r?\n/).map((line: string) => line.trim()).filter((line: string) => line !== '');
      this.context.log(`InputNode(${this.id}): Created ${items.length} items from textBuffer`);
      return items;
    }
    
    // Check node data for text property as a last resort
    // Try to get the node data from the property
    if (this.property && typeof this.property === 'object' && 'text' in this.property) {
      const text = (this.property as any).text;
      if (text) {
        const items = text.split(/\r?\n/).map((line: string) => line.trim()).filter((line: string) => line !== '');
        this.context.log(`InputNode(${this.id}): Created ${items.length} items from node property text`);
        return items;
      }
    }
    
    this.context.log(`InputNode(${this.id}): No items found in node data or content store`);
    return [];
  }
  
  /**
   * Process the input node and execute child nodes based on execution mode
   * @param _ Input argument (typically ignored for InputNode)
   * @returns The array of items from this input node
   */
  async process(_: any): Promise<any> {
    try {
      // Mark node as running
      this.context.markNodeRunning(this.id);
      
      // Update property with latest execution mode from store
      const nodeContent = getNodeContent(this.id) as InputNodeContent;
      if (nodeContent && 'executionMode' in nodeContent) {
        this.property.executionMode = nodeContent.executionMode as 'batch' | 'foreach';
      }
      
      const executionMode = this.property.executionMode || 'batch';
      const items = this.getItems();
      
      // Store the result (full array) in node state
      this.context.storeOutput(this.id, items);
      
      if (items.length === 0) {
        this.context.log(`InputNode(${this.id}): No items to process`);
        return items;
      }
      
      const children = this.getChildNodes();
      
      if (children.length === 0) {
        this.context.log(`InputNode(${this.id}): No child nodes found to execute`);
        return items;
      }
      
      if (executionMode === 'foreach' && items.length > 0) {
        this.context.log(`InputNode(${this.id}): Executing in FOREACH mode with ${items.length} items`);
        
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          this.context.log(`InputNode(${this.id}): Processing item ${i+1}/${items.length} in foreach mode`);
          
          // Create a separate execution context for each iteration
          const iterContext = this.context.createIterationContext(i, items.length);
          
          for (const child of children) {
            // Update child's context with the iteration context
            child.context = iterContext;
            this.context.log(`InputNode(${this.id}): Executing child node ${child.id} with item ${i+1}`);
            await child.process(item);
          }
        }
      } else {
        // For batch mode, just forward the entire array to child nodes
        this.context.log(`InputNode(${this.id}): Executing in BATCH mode with ${items.length} items`);
        
        for (const child of children) {
          await child.process(items);
        }
      }
      
      // Mark node as successful
      this.context.markNodeSuccess(this.id, items);
      
      return items;
    } catch (error) {
      this.context.log(`InputNode(${this.id}): Execution failed: ${error}`);
      this.context.markNodeError(this.id, String(error));
      throw error;
    }
  }
} 