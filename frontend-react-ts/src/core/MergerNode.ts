import { Node } from '../core/Node';
import { FlowExecutionContext } from './FlowExecutionContext';
import { MergerNodeContent, useNodeContentStore } from '../store/useNodeContentStore';

interface MergerNodeProperty {
  strategy: 'array' | 'object';
  keys?: string[];
  // Reference to flow structure (will be provided by FlowRunner)
  nodes?: any[];
  edges?: any[];
  items?: any[]; // Ensure items is always present
}

/**
 * MergerNode accumulates inputs from multiple upstream nodes
 * and returns the entire collection on each execution.
 */
export class MergerNode extends Node {
  declare property: MergerNodeContent;
  private collectedItems: any[] = []; // Store items in memory during execution

  /**
   * Constructor for MergerNode
   */
  constructor(
    id: string, 
    property: Record<string, any> = {}, 
    context?: FlowExecutionContext
  ) {
    super(id, 'merger', property, context);
    // Initialize collectedItems from the store if needed, or ensure it starts empty
    const initialContent = useNodeContentStore.getState().getNodeContent<MergerNodeContent>(this.id, this.type);
    // Ensure stored items are treated as initial collection if they exist
    this.collectedItems = initialContent?.items || []; 
    this.context?.log(`${this.type}(${this.id}): Initialized with ${this.collectedItems.length} items from store/default.`);
  }

  /**
   * Execute the node's specific logic.
   * Adds the input (or its elements if it's an array) to the internal collection
   * and returns the *entire* updated collection.
   * @param input The input to execute
   * @returns The entire accumulated array of items.
   */
  async execute(input: any): Promise<any[] | null> { // Keep return type as potentially null if needed downstream, though likely always returns array
    this.context?.log(`${this.type}(${this.id}): Executing`);

    // Get latest config if needed for strategies (currently unused)
    // const nodeContent = useNodeContentStore.getState().getNodeContent<MergerNodeContent>(this.id, this.type);

    this.context?.log(`${this.type}(${this.id}): Received input type: ${typeof input}`);

    if (input !== null && input !== undefined) {
      // Directly modify the member variable collectedItems
      if (Array.isArray(input)) {
        // If input is an array, spread its elements into collectedItems
        this.collectedItems.push(...input);
        this.context?.log(`${this.type}(${this.id}): Input is an array. Added ${input.length} elements to collectedItems.`);
      } else {
        // If input is not an array, push the input itself as a single element
        this.collectedItems.push(input);
        this.context?.log(`${this.type}(${this.id}): Input is not an array. Added 1 element to collectedItems.`);
      }
      
      // --- Update Zustand store for UI display of accumulated items (Keep this) ---
      this.context?.log(`${this.type}(${this.id}): Updating UI store. Total collected items: ${this.collectedItems.length}`);
      useNodeContentStore.getState().setNodeContent(this.id, { items: [...this.collectedItems] }); // Update store with a copy
      // --- End UI Update ---
      
    } else {
      this.context?.log(`${this.type}(${this.id}): Received null/undefined input, not adding.`);
      // If input is null/undefined, do not modify collectedItems, just return current state
    }

    // Return the *entire* current accumulated list
    this.context?.log(`${this.type}(${this.id}): Returning current accumulated items (${this.collectedItems.length} items).`);
    return [...this.collectedItems]; // Return a copy of the accumulated array
  }

  /**
   * Merge all inputs as an object using item keys
   */
  private mergeAsObject(items: any[]): Record<string, any> {
    const result: Record<string, any> = {};
    items.forEach((item, index) => {
      const key = this.getItemKey(item, index);
      result[key] = item;
    });
    this.context?.log(`MergerNode(${this.id}): ${Object.keys(result).length}개 항목을 객체로 병합`);
    return result;
  }

  /**
   * Generate a key for an input item in object merge mode
   */
  private getItemKey(input: any, index: number): string {
    if (this.property.strategy === 'object' && this.property.keys && this.property.keys.length > 0) {
      for (const key of this.property.keys) {
        if (input && typeof input === 'object' && key in input) {
          return String(input[key]);
        }
      }
    }
    if (input && typeof input === 'object' && 'id' in input) {
      return String(input.id);
    }
    return `item_${index}`;
  }
} 