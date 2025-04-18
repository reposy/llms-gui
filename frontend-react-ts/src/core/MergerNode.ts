import { Node } from '../core/Node';
import { FlowExecutionContext } from './FlowExecutionContext';
import { MergerNodeContent, useNodeContentStore } from '../store/useNodeContentStore';
import { syncNodeProperties, mergerNodeSyncConfig } from '../utils/nodePropertySync';

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
    const nodeContent = useNodeContentStore.getState().getNodeContent<MergerNodeContent>(this.id, this.type);
    const strategy = nodeContent.strategy || 'array'; // Default strategy
    const keys = nodeContent.keys || [];

    this.context?.log(`${this.type}(${this.id}): Strategy: ${strategy}, Input type: ${typeof input}`);

    // Add the received input to the internal collection
    if (input !== null && input !== undefined) {
      this.collectedItems.push(input);
      this.context?.log(`${this.type}(${this.id}): Added input. Total items: ${this.collectedItems.length}`);
    } else {
      this.context?.log(`${this.type}(${this.id}): Received null/undefined input, not adding.`);
    }

    // Update the store with the current collected items
    // This allows the UI to reflect the merged items progressively
    useNodeContentStore.getState().setNodeContent(this.id, { items: [...this.collectedItems] });
    
    // Store the current collection in the execution context output as well
    this.context?.storeOutput(this.id, [...this.collectedItems]);

    // Merger node inherently collects inputs. It doesn't immediately pass data onwards
    // unless specifically designed to do so based on some condition (e.g., number of inputs).
    // For now, we assume it collects all inputs until the flow completes
    // and the final collected array might be used by subsequent nodes if the flow
    // triggers them AFTER all inputs have potentially arrived at the merger.
    // A common pattern is for Merger to be followed by a node triggered manually or by a final event.
    
    // For simplicity in this pass, let's make it return the *current* collection.
    // This means downstream nodes will execute multiple times as items merge.
    // A more robust implementation might require knowing when *all* potential inputs
    // have arrived before propagating.
    this.context?.log(`${this.type}(${this.id}): Returning current collection (${this.collectedItems.length} items)`);
    return [...this.collectedItems]; // Return a copy of the array

    // --- Alternative: Return null to prevent immediate downstream execution --- 
    // this.context?.log(`${this.type}(${this.id}): Returning null to await more inputs.`);
    // return null; 
    // If returning null, a mechanism (e.g., a button on the Merger node UI, or 
    // a separate "trigger" node) would be needed to push the final merged 
    // result ([...this.collectedItems]) to the *actual* next node in the logical flow.
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