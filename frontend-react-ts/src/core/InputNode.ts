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
   * Execute the input node according to the new requirements.
   * 1. Always add input to chainingItems.
   * 2. Optionally add input to commonItems or items based on chainingUpdateMode.
   * 3. Return combined items for Batch mode or trigger children for ForEach mode.
   * @param input The input to execute
   * @returns The combined items array (Batch) or null (ForEach)
   */
  async execute(input: any): Promise<any> {
    this.context?.log(`${this.type}(${this.id}): Executing`);

    // Get the latest content directly from the store within execute
    const nodeContent = useNodeContentStore.getState().getNodeContent<InputNodeContent>(this.id, this.type);

    // Use nodeContent for logic
    const chainingItems = nodeContent.chainingItems || [];
    const commonItems = nodeContent.commonItems || [];
    const items = nodeContent.items || [];
    const iterateEachRow = nodeContent.iterateEachRow;
    const chainingUpdateMode = nodeContent.chainingUpdateMode || 'element';
    
    this.context?.log(`${this.type}(${this.id}): Start state - Chaining: ${chainingItems.length}, Common: ${commonItems.length}, Items: ${items.length}, Iterate: ${iterateEachRow}, ChainingMode: ${chainingUpdateMode}`);

    // --- Step 1 & 2: Process Input --- 
    let didUpdateChaining = false;
    let didUpdateCommon = false;
    let didUpdateItems = false;

    if (input !== null && input !== undefined) {
      // Helper to check if an item is a valid object (not empty)
      const isValidObject = (item: any) => 
        typeof item === 'object' && item !== null && Object.keys(item).length > 0;

      // Helper to process a single input item or an array of items
      const processAndAdd = (itemToAdd: any, targetArray: any[], arrayName: string): boolean => {
        if (itemToAdd !== null && itemToAdd !== undefined) {
          if (typeof itemToAdd === 'object' && !isValidObject(itemToAdd)) {
            this.context?.log(`${this.type}(${this.id}): Skipped adding empty object to ${arrayName}.`);
            return false;
          } else {
            targetArray.push(itemToAdd);
            this.context?.log(`${this.type}(${this.id}): Added input to ${arrayName}. New count: ${targetArray.length}`);
            return true;
          }
        } 
        return false;
      };
      
      // Always add to chainingItems
      if (Array.isArray(input)) {
        input.forEach(singleInput => {
          if (processAndAdd(singleInput, chainingItems, 'chainingItems')) {
            didUpdateChaining = true;
          }
        });
      } else {
        if (processAndAdd(input, chainingItems, 'chainingItems')) {
          didUpdateChaining = true;
        }
      }

      // Optionally add to commonItems or items based on chainingUpdateMode
      if (chainingUpdateMode !== 'none') {
        const targetArray = chainingUpdateMode === 'common' ? commonItems : items;
        const targetName = chainingUpdateMode === 'common' ? 'commonItems' : 'items';

        if (Array.isArray(input)) {
           input.forEach(singleInput => {
            if(processAndAdd(singleInput, targetArray, targetName)) {
              if (chainingUpdateMode === 'common') didUpdateCommon = true;
              else didUpdateItems = true;
            }
          });
        } else {
           if(processAndAdd(input, targetArray, targetName)) {
              if (chainingUpdateMode === 'common') didUpdateCommon = true;
              else didUpdateItems = true;
           }
        }
      }
      
      // --- Update Store if anything changed ---
      const updatePayload: Partial<InputNodeContent> = {};
      if (didUpdateChaining) updatePayload.chainingItems = chainingItems;
      if (didUpdateCommon) updatePayload.commonItems = commonItems;
      if (didUpdateItems) updatePayload.items = items;

      if (Object.keys(updatePayload).length > 0) {
          this.context?.log(`${this.type}(${this.id}): Updating node content store.`);
          useNodeContentStore.getState().setNodeContent(this.id, updatePayload);
      }
    }

    // --- Step 3: Determine Output / Execution --- 
    if (iterateEachRow) {
      this.context?.log(`${this.type}(${this.id}): Running in ForEach mode`);
      // Process each item individually
      for (const item of items) {
        const childNodes = this.getChildNodes();
        for (const child of childNodes) {
          // Combine common items with the current item
          const combinedInput = [...commonItems, item];
          this.context?.log(`${this.type}(${this.id}): Passing combined input to child: ${commonItems.length} common + 1 individual`);
          // Pass the combined input to child node
          await child.process(combinedInput);
        }
      }
      this.context?.log(`${this.type}(${this.id}): Finished ForEach mode processing`);
      // Return null to stop chaining from this node after foreach completes
      return null;
    } else {
      // If iterateEachRow is false (Batch mode)
      // Return combined common items and individual items
      const combinedOutput = [...commonItems, ...items];
      this.context?.log(`${this.type}(${this.id}): Running in Batch mode, returning ${combinedOutput.length} items (${commonItems.length} common + ${items.length} individual)`);
      
      // Return a copy of the combined array
      return [...combinedOutput];
    }
  }
}