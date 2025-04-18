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
      // Filter out empty objects before pushing
      const isValidObject = (item: any) => 
        typeof item === 'object' && Object.keys(item).length > 0;

      if (Array.isArray(input)) {
        // Filter empty objects from input array
        const filteredInput = input.filter(item => item !== null && item !== undefined && (typeof item !== 'object' || isValidObject(item)));
        if (filteredInput.length > 0) {
            items.push(...filteredInput);
        }
      } else if (typeof input === 'object' && !isValidObject(input)){
        // Do not push empty objects
        this.context?.log(`${this.type}(${this.id}): Skipped adding empty object input.`);
      } else {
        items.push(input); // Push other valid types (string, number, non-empty objects, etc.)
      }

      // Only log and update store if items were actually added or changed
      if (items.length > nodeContent.items.length) { // Check if length increased
          this.context?.log(`${this.type}(${this.id}): Added valid input to items. New count: ${items.length}`);
          useNodeContentStore.getState().setNodeContent(this.id, { items });
      }
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