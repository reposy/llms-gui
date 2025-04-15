import { Node } from '../core/Node';
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
   * Execute the node's specific logic
   * Accumulates the input with previous results and produces a merged output
   * @param input The input to execute
   * @returns The merged result
   */
  async execute(input: any): Promise<any> {
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
   * Resets the accumulated items to an empty array
   */
  resetItems(): void {
    this.context.log(`MergerNode(${this.id}): Resetting accumulated items`);
    setNodeContent(this.id, { items: [] });
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
} 