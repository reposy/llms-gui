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
 * and aggregates them according to a specified strategy.
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
    this.collectedItems = initialContent?.items || [];
    this.context?.log(`${this.type}(${this.id}): Initialized with ${this.collectedItems.length} items from store/default.`);
  }

  /**
   * Execute the node's specific logic
   * Always pushes input to Zustand's items array and returns the updated array
   * @param input The input to execute
   * @returns The merged result
   */
  async execute(input: any): Promise<any[] | null> {
    this.context?.log(`${this.type}(${this.id}): Executing`);
    
    // Get the latest content (strategy, keys) directly from the store
    // Note: Strategy and keys seem unused in the current simple merge logic,
    // but keeping the retrieval for potential future use.
    const nodeContent = useNodeContentStore.getState().getNodeContent<MergerNodeContent>(this.id, this.type);
    // const strategy = nodeContent.strategy || 'array'; // Default strategy
    // const keys = nodeContent.keys || [];

    this.context?.log(`${this.type}(${this.id}): Received input type: ${typeof input}`);

    // --- Start Modified Logic --- 
    let itemsToOutput: any[] = []; // Initialize an empty array for the output of this execution

    if (input !== null && input !== undefined) {
      if (Array.isArray(input)) {
        // If input is an array, spread its elements into the output array
        itemsToOutput.push(...input);
        this.context?.log(`${this.type}(${this.id}): Input is an array. Adding ${input.length} elements.`);
      } else {
        // If input is not an array, push the input itself as a single element
        itemsToOutput.push(input);
        this.context?.log(`${this.type}(${this.id}): Input is not an array. Adding 1 element.`);
      }
      
      // --- Keep the logic to update the persistent collectedItems --- 
      // This assumes collectedItems should store the history of *raw* inputs received.
      // If collectedItems should store the *processed* items (like itemsToOutput),
      // this part needs adjustment.
      this.collectedItems.push(input); // Store the original input
      this.context?.log(`${this.type}(${this.id}): Added raw input to persistent collection. Total raw inputs: ${this.collectedItems.length}`);
      useNodeContentStore.getState().setNodeContent(this.id, { items: [...this.collectedItems] });
      // --- End Persistent Collection Update --- 
      
    } else {
      this.context?.log(`${this.type}(${this.id}): Received null/undefined input, not adding.`);
      // If input is null/undefined, should we return an empty array or null?
      // Returning an empty array seems consistent with the type signature Promise<any[] | null>
      // and the goal of always producing an array output when possible.
    }

    this.context?.log(`${this.type}(${this.id}): Returning processed output array with ${itemsToOutput.length} items for this execution.`);
    return itemsToOutput; // Return the processed array for downstream nodes
    // --- End Modified Logic --- 

    // --- Original Logic (commented out) --- 
    // Add the received input to the internal collection
    // if (input !== null && input !== undefined) {
    //   this.collectedItems.push(input);
    //   this.context?.log(`${this.type}(${this.id}): Added input. Total items: ${this.collectedItems.length}`);
    // } else {
    //   this.context?.log(`${this.type}(${this.id}): Received null/undefined input, not adding.`);
    // }
    // // Update the store with the current collected items
    // useNodeContentStore.getState().setNodeContent(this.id, { items: [...this.collectedItems] });
    // // Store the current collection in the execution context output as well
    // this.context?.storeOutput(this.id, [...this.collectedItems]);
    // this.context?.log(`${this.type}(${this.id}): Returning current collection (${this.collectedItems.length} items)`);
    // return [...this.collectedItems]; // Return a copy of the array
    // --- End Original Logic --- 
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