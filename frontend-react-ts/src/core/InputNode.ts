import { Node } from './Node';
import { FlowExecutionContext } from './FlowExecutionContext';
import { InputNodeContent } from '../types/nodes';
import { useNodeContentStore } from '../store/useNodeContentStore';

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
    const nodeContent = useNodeContentStore.getState().getNodeContent(this.id, this.type) as InputNodeContent;

    // Use nodeContent for logic
    const chainingItems = nodeContent?.chainingItems || [];
    const commonItems = nodeContent?.commonItems || [];
    const items = nodeContent?.items || [];
    const iterateEachRow = nodeContent?.iterateEachRow;
    // Explicitly assert the type before the switch statement
    const mode = (nodeContent.chainingUpdateMode || 'element') as 'common' | 'replaceCommon' | 'element' | 'none';
    
    this.context?.log(`${this.type}(${this.id}): Start state - Chaining: ${chainingItems.length}, Common: ${commonItems.length}, Items: ${items.length}, Iterate: ${iterateEachRow}, ChainingMode: ${mode}`);

    // --- Step 1 & 2: Process Input --- 
    let processedChainingInputs: any[] = [];
    let processedCommonInputs: any[] | null = null; // Use null to differentiate from empty array if no update needed
    let processedElementInputs: any[] | null = null;// Use null

    if (input !== null && input !== undefined) {
      const inputsToProcess = Array.isArray(input) ? input : [input];

      // Helper to check if an item is a valid object (not empty) - ADD BACK
      const isValidObject = (item: any) => 
        typeof item === 'object' && item !== null && Object.keys(item).length > 0;

      // Helper to filter valid inputs
      const getValidInputs = (arr: any[]) => arr.filter(item => 
         item !== null && item !== undefined && (typeof item !== 'object' || isValidObject(item))
      );

      const validInputs = getValidInputs(inputsToProcess);

      if (validInputs.length > 0) {
        // 1. Always process for chainingItems
        processedChainingInputs = [...chainingItems, ...validInputs]; // Append to existing chaining items
        this.context?.log(`${this.type}(${this.id}): Processed ${validInputs.length} valid input(s) for chainingItems. New potential count: ${processedChainingInputs.length}`);

        // 2. Process based on chainingUpdateMode
        switch (mode) { // Use the asserted type variable
          case 'replaceCommon':
            processedCommonInputs = [...validInputs]; // Replace with new valid inputs
            this.context?.log(`${this.type}(${this.id}): Mode 'replaceCommon'. Prepared ${validInputs.length} item(s) to replace commonItems.`);
            break;
          case 'common':
            processedCommonInputs = [...commonItems, ...validInputs]; // Append to existing common items
            this.context?.log(`${this.type}(${this.id}): Mode 'common'. Prepared ${validInputs.length} item(s) to append to commonItems. New potential count: ${processedCommonInputs.length}`);
            break;
          case 'element':
            processedElementInputs = [...items, ...validInputs]; // Append to existing element items
            this.context?.log(`${this.type}(${this.id}): Mode 'element'. Prepared ${validInputs.length} item(s) to append to items. New potential count: ${processedElementInputs.length}`);
            break;
          case 'none':
            // Do nothing for common or element items
            this.context?.log(`${this.type}(${this.id}): Mode 'none'. No updates to common/element items.`);
            break;
        }
      } else {
        this.context?.log(`${this.type}(${this.id}): Input received, but contained no valid items after filtering.`);
      }
    }

    // --- Update Store if anything changed ---
    const updatePayload: Partial<InputNodeContent> = {};
    let storeNeedsUpdate = false;

    // Check if chainingItems changed (always check if valid inputs were processed)
    if (processedChainingInputs.length > chainingItems.length) {
      updatePayload.chainingItems = processedChainingInputs;
      storeNeedsUpdate = true;
      this.context?.log(`${this.type}(${this.id}): Staging chainingItems update.`);
    }

    // Check if commonItems changed
    if (processedCommonInputs !== null) { // Only update if processedCommonInputs was assigned
      // Simple length comparison might not be enough if items were replaced but count is same
      // For simplicity, we update if it was processed. More robust check could compare arrays.
       updatePayload.commonItems = processedCommonInputs;
       storeNeedsUpdate = true;
       this.context?.log(`${this.type}(${this.id}): Staging commonItems update.`);
    }
    
    // Check if items changed
    if (processedElementInputs !== null) { // Only update if processedElementInputs was assigned
       updatePayload.items = processedElementInputs;
       storeNeedsUpdate = true;
       this.context?.log(`${this.type}(${this.id}): Staging items update.`);
    }

    if (storeNeedsUpdate) {
        this.context?.log(`${this.type}(${this.id}): Updating node content store with staged changes.`);
        useNodeContentStore.getState().setNodeContent(this.id, updatePayload);
    }

    // --- Step 3: Determine Output / Execution --- 
    // Re-fetch the potentially updated state for output generation
    const finalNodeContent = useNodeContentStore.getState().getNodeContent(this.id, this.type) as InputNodeContent;
    const finalCommonItems = finalNodeContent?.commonItems || [];
    const finalItems = finalNodeContent?.items || [];
    const finalIterateEachRow = finalNodeContent?.iterateEachRow;

    if (finalIterateEachRow) {
      this.context?.log(`${this.type}(${this.id}): Running in ForEach mode`);
      // Process each item individually
      for (const item of finalItems) { // Use finalItems for iteration
        const childNodes = this.getChildNodes();
        for (const child of childNodes) {
          // Combine common items with the current item
          const combinedInput = [...finalCommonItems, item]; // Use finalCommonItems
          this.context?.log(`${this.type}(${this.id}): Passing combined input to child: ${finalCommonItems.length} common + 1 individual`);
          // Pass the combined input to child node
          // Note: process might need context or further refinement based on child node needs
          await child.process(combinedInput);
        }
      }
      this.context?.log(`${this.type}(${this.id}): Finished ForEach mode processing`);
      // Return null to stop chaining from this node after foreach completes
      return null;
    } else {
      // If iterateEachRow is false (Batch mode)
      // Return combined common items and individual items
      const combinedOutput = [...finalCommonItems, ...finalItems]; // Use final states
      this.context?.log(`${this.type}(${this.id}): Running in Batch mode, returning ${combinedOutput.length} items (${finalCommonItems.length} common + ${finalItems.length} individual)`);
      
      // Return a copy of the combined array
      return [...combinedOutput];
    }
  }
}