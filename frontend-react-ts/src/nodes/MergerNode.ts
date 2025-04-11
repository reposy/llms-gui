import { Node } from '../core/Node';
import { getOutgoingConnections } from '../utils/flowUtils';
import { setNodeContent, getNodeContent, MergerNodeContent } from '../store/useNodeContentStore';

interface MergerNodeProperty {
  strategy: 'array' | 'object';
  keys?: string[];
  // Reference to flow structure (will be provided by FlowRunner)
  nodes?: any[];
  edges?: any[];
}

/**
 * MergerNode accumulates inputs from multiple upstream nodes
 * and aggregates them according to a specified strategy.
 * 
 * This implementation is reactive and event-based, adding each
 * new input to the accumulated results immediately on arrival.
 */
export class MergerNode extends Node {
  declare property: MergerNodeProperty;

  /**
   * Process an input immediately as it arrives
   * Accumulates it with previous results and produces a merged output
   */
  async process(input: any): Promise<any> {
    // Get the current accumulated state from the store
    const nodeContent = getNodeContent(this.id) as MergerNodeContent;
    
    // Initialize accumulated items if not present
    const currentItems = nodeContent.items || [];
    const iterIndex = this.context.iterationIndex;

    // Log the input being processed
    if (iterIndex !== undefined) {
      this.context.log(`MergerNode(${this.id}): Adding iteration ${iterIndex + 1} input to accumulated results`);
    } else {
      this.context.log(`MergerNode(${this.id}): Adding new input to accumulated results`);
    }
    
    // Add the new input to our accumulated items
    const newItems = [...currentItems, input];
    
    // Update the node content store with the new accumulated state
    setNodeContent(this.id, { items: newItems });
    
    // Log the current accumulated state
    this.context.log(`MergerNode(${this.id}): Now have ${newItems.length} accumulated inputs`);
    
    // Merge based on the selected strategy
    const result = this.property.strategy === 'array' 
      ? this.mergeAsArray(newItems) 
      : this.mergeAsObject(newItems);
      
    return result;
  }

  /**
   * Generate a key for an input item in object merge mode
   */
  private getItemKey(input: any, index: number): string {
    // If keys are provided and we're using object strategy, try to extract a key
    if (this.property.strategy === 'object' && this.property.keys && this.property.keys.length > 0) {
      for (const key of this.property.keys) {
        if (input && typeof input === 'object' && key in input) {
          return String(input[key]);
        }
      }
    }
    
    // If the input is an object with an id property, use that
    if (input && typeof input === 'object' && 'id' in input) {
      return String(input.id);
    }
    
    // Use a sequential index as the default key
    return `item_${index}`;
  }

  /**
   * Merge all inputs as an array
   */
  private mergeAsArray(items: any[]): any[] {
    this.context.log(`MergerNode(${this.id}): Merged ${items.length} inputs as array`);
    return items;
  }

  /**
   * Merge all inputs as an object
   */
  private mergeAsObject(items: any[]): Record<string, any> {
    const result: Record<string, any> = {};
    
    // Convert items to object with keys
    items.forEach((item, index) => {
      const key = this.getItemKey(item, index);
      result[key] = item;
    });
    
    this.context.log(`MergerNode(${this.id}): Merged ${Object.keys(result).length} inputs as object`);
    return result;
  }
  
  /**
   * Override execute to provide stateless execution
   * Each execution adds one input to the merged result
   */
  async execute(input: any): Promise<void> {
    try {
      // Mark the node as running
      this.context.markNodeRunning(this.id);
      
      // Store the input for reference
      this.input = structuredClone(input);
      
      // Process the input (add to accumulator and generate merged result)
      const result = await this.process(input);
      
      // Store the result in the execution context
      this.context.storeOutput(this.id, result);
      
      // Get child nodes and propagate the merged result
      const childNodes = this.getChildNodes();
      
      if (childNodes.length > 0) {
        this.context.log(`MergerNode(${this.id}): Propagating merged result to ${childNodes.length} child nodes`);
        
        // Execute each child with the merged result
        for (const child of childNodes) {
          await child.execute(result);
        }
      } else {
        this.context.log(`MergerNode(${this.id}): No child nodes to execute with merged result`);
      }
    } catch (error) {
      this.context.log(`MergerNode(${this.id}): Execution failed: ${error}`);
      this.context.markNodeError(this.id, String(error));
      throw error;
    }
  }
} 