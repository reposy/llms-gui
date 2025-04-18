import { Node } from './Node';
import { FlowExecutionContext } from './FlowExecutionContext';
import { InputNodeContent, useNodeContentStore } from '../store/useNodeContentStore';

/**
 * Input node properties
 */
export interface InputNodeProperty {
  items: any[];
  iterateEachRow: boolean;
  nodeFactory?: any;
  [key: string]: any;
}

/**
 * Input node that provides data to the flow
 */
export class InputNode extends Node {
  /**
   * Type assertion for the property
   */
  declare property: InputNodeContent;
  
  /**
   * Constructor for InputNode
   */
  constructor(
    id: string, 
    property: Record<string, any> = {},
    context?: FlowExecutionContext
  ) {
    super(id, 'input', property, context);
  }

  /**
   * Execute the input node, handling batch vs foreach logic
   * Always pushes input to Zustand's items array and returns the updated array (batch) or null (foreach)
   * @param input The input to execute
   * @returns The items from this input node or null in foreach mode
   */
  async execute(input: any): Promise<any> {
    this.context?.log(`${this.type}(${this.id}): Executing`);

    // Get the latest content directly from the store within execute
    const nodeContent = useNodeContentStore.getState().getNodeContent<InputNodeContent>(this.id, this.type);

    // Use nodeContent for logic instead of this.property
    const items = nodeContent.items || [];
    const iterateEachRow = nodeContent.iterateEachRow;
    
    this.context?.log(`${this.type}(${this.id}): Found ${items.length} items, iterateEachRow: ${iterateEachRow}`);

    // Append the input to the items if it's not null/undefined
    // This allows chaining into an Input node
    if (input !== null && input !== undefined) {
      if (Array.isArray(input)) {
        items.push(...input);
      } else {
        items.push(input);
      }
      this.context?.log(`${this.type}(${this.id}): Added input to items. New count: ${items.length}`);
      // Update the store content immediately if input was added
      // Note: This might trigger UI updates if the store is reactive
      useNodeContentStore.getState().setNodeContent(this.id, { items });
    }

    // If iterateEachRow is true (ForEach mode)
    if (iterateEachRow) {
      this.context?.log(`${this.type}(${this.id}): Running in ForEach mode`);
      // Process each item individually
      for (const item of items) {
        const childNodes = this.getChildNodes();
        for (const child of childNodes) {
          // Use a deep copy of the context for parallel execution? 
          // Need to consider if context needs to be isolated per branch.
          await child.process(item);
        }
      }
      this.context?.log(`${this.type}(${this.id}): Finished ForEach mode processing`);
      // Return null to stop chaining from this node after foreach completes
      return null;
    } else {
      // If iterateEachRow is false (Batch mode)
      this.context?.log(`${this.type}(${this.id}): Running in Batch mode, returning all items`);
      // Return the whole items array for the next node to process
      // Note: We are returning the items array directly, which might be mutated by downstream nodes.
      // Consider returning a copy if mutation is a concern: return [...items];
      return items;
    }
  }
}