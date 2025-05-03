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
  async execute(input?: any): Promise<any> {
    // Get node content via context function
    // const nodeContent = useNodeContentStore.getState().getNodeContent(this.id, 'input') as InputNodeContent;
    const currentContext = this.context;
    if (!currentContext || !currentContext.getNodeContentFunc) { // Add check for getNodeContentFunc
      console.warn(`[InputNode ${this.id}] Execution context or getNodeContentFunc is missing.`);
      // Attempt to get content directly as a fallback, though ideally context should always be valid
      const fallbackContent = useNodeContentStore.getState().getNodeContent(this.id, 'input') as InputNodeContent;
      return fallbackContent.items || [];
    }
    const nodeContent = currentContext.getNodeContentFunc(this.id, 'input') as InputNodeContent;

    currentContext.log(`${this.type}(${this.id}): Executing Input Node`);
    currentContext.markNodeRunning(this.id);

    let newItems = [...(nodeContent.items || [])];
    let newCommonItems = [...(nodeContent.commonItems || [])];
    let updatePerformed = false;

    // Process chained input if provided
    if (input !== undefined && input !== null) {
      currentContext.log(`${this.type}(${this.id}): Received chained input: ${JSON.stringify(input)}`);
      const { chainingUpdateMode, accumulationMode } = nodeContent;
      const itemsToAdd = Array.isArray(input) ? input : [input];

      // Determine if accumulation should happen and if marking is needed for oncePerContext
      const { shouldAccumulate, needsMarking } = this._shouldAccumulateInput(
        accumulationMode,
        chainingUpdateMode,
        currentContext
      );

      // Only perform accumulation if allowed
      if (shouldAccumulate) {
        const result = this._applyChainedInput(
          itemsToAdd,
          chainingUpdateMode,
          newItems,
          newCommonItems,
          currentContext
        );
        newItems = result.newItems;
        newCommonItems = result.newCommonItems;
        updatePerformed = result.updatePerformed;

        // Mark for oncePerContext if accumulation happened and marking is needed
        if (updatePerformed && needsMarking) {
           // Ensure the set exists before adding
           if (!currentContext.accumulatedOnceInputNodes) {
               currentContext.accumulatedOnceInputNodes = new Set<string>();
           }
          currentContext.accumulatedOnceInputNodes!.add(this.id);
          currentContext.log(`${this.type}(${this.id}): Marked node for 'oncePerContext' accumulation.`);
        }
      }
      
      // Log if chaining mode is 'none' (this happens regardless of accumulation)
      if (chainingUpdateMode === 'none') {
        currentContext.log(`${this.type}(${this.id}): Chained input ignored due to chainingUpdateMode 'none'.`);
      }

      // Persist changes ONLY if accumulation occurred
      if (updatePerformed) {
        // TODO: Ideally, the context should handle persistence too,
        // or return the updated content to the runner to handle.
        // For now, keep the direct store call, but acknowledge it's not ideal.
        useNodeContentStore.getState().setNodeContent(this.id, {
          items: newItems,
          commonItems: newCommonItems
        });
      }
    }

    // Determine output based on execution mode
    const executionMode = nodeContent.executionMode || 'batch';
    let output: any;

    if (executionMode === 'foreach') {
      currentContext.log(`${this.type}(${this.id}): Executing in Foreach mode`);
      // Combine commonItems and items for iteration as per the user's pseudo-code
      const itemsToIterate = [...newCommonItems, ...newItems]; 

      if (itemsToIterate.length === 0) {
        currentContext.log(`${this.type}(${this.id}): No items to iterate in Foreach mode.`);
        // Mark success even if no items, as the node itself executed.
        currentContext.markNodeSuccess(this.id, { status: 'Foreach completed (no items)', items: newItems, commonItems: newCommonItems });
        return null; // Return null to stop further chaining by Node.process
      } else {
        currentContext.log(`${this.type}(${this.id}): Found ${itemsToIterate.length} items to iterate.`);

        // Find child nodes connected to the output handle (assuming 'source' handle id)
        // Use the context which now holds nodes, edges, and nodeFactory
        const outputHandleId = `${this.id}-source`; // Standard handle ID format, adjust if different
        const outgoingEdges = currentContext.edges.filter(edge => edge.source === this.id /*&& edge.sourceHandle === outputHandleId*/); // Handle check might be needed if multiple source handles exist
        const childNodeIds = outgoingEdges.map(edge => edge.target);

        if (childNodeIds.length === 0) {
          currentContext.log(`${this.type}(${this.id}): No child nodes connected for Foreach execution.`);
          currentContext.markNodeSuccess(this.id, { status: 'Foreach completed (no children)', items: newItems, commonItems: newCommonItems });
          return null;
        }

        currentContext.log(`${this.type}(${this.id}): Found ${childNodeIds.length} child node(s): ${childNodeIds.join(', ')}`);

        // Instantiate child nodes ONCE before the loop
        const childNodeInstances: Node[] = [];
        for (const childId of childNodeIds) {
          const nodeData = currentContext.nodes.find(n => n.id === childId);
          if (nodeData && nodeData.type) {
            const childInstance = currentContext.nodeFactory.create(
              nodeData.id,
              nodeData.type,
              nodeData.data,
              currentContext // Pass the same context down!
            );
            childNodeInstances.push(childInstance);
          } else {
            currentContext.log(`${this.type}(${this.id}): Could not find node data or type for child node ${childId}. Skipping instantiation.`);
          }
        }

        // Iterate through each item and execute all child nodes for it
        for (let i = 0; i < itemsToIterate.length; i++) {
          const item = itemsToIterate[i];
          currentContext.log(`${this.type}(${this.id}): Processing item ${i + 1}/${itemsToIterate.length}: ${JSON.stringify(item)}`);
          // Set iteration context for potential use by children or logging
          currentContext.setIterationContext({ item: item, index: i, total: itemsToIterate.length });

          for (const childNodeInstance of childNodeInstances) {
            try {
              currentContext.log(`${this.type}(${this.id}): Triggering child node ${childNodeInstance.id} for item ${i + 1}`);
              await childNodeInstance.process(item);
              currentContext.log(`${this.type}(${this.id}): Child node ${childNodeInstance.id} completed for item ${i + 1}`);
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error);
              currentContext.log(`${this.type}(${this.id}): Error processing child node ${childNodeInstance.id} for item ${i + 1}: ${errorMessage}`);
              // Propagate error? Mark parent as error? Decide on error handling strategy.
              // For now, just log and continue iteration.
              currentContext.markNodeError(childNodeInstance.id, `Error during Foreach iteration: ${errorMessage}`);
            }
          }
          // Clear iteration context after processing an item? Or keep the last one?
          // currentContext.setIterationContext({}); // Optional: Reset iteration context
        }

        // Mark success after all iterations are done
        currentContext.markNodeSuccess(this.id, { status: `Foreach completed (${itemsToIterate.length} items)`, items: newItems, commonItems: newCommonItems });
        return null; // Crucial: Return null to prevent default chaining in Node.process
      }
    } else { // Batch mode
      currentContext.log(`${this.type}(${this.id}): Executing in Batch mode`);
      // Combine commonItems and items for batch output
      output = [...newCommonItems, ...newItems];
      currentContext.log(`${this.type}(${this.id}): Outputting combined items (Common: ${newCommonItems.length}, Element: ${newItems.length}, Total: ${output.length})`);
    }

    // Finalize execution
    currentContext.storeOutput(this.id, output); // Store the output in context (will be null for foreach)
    // Mark node success/error is handled within the if/else branches now
    // currentContext.markNodeSuccess(this.id, { items: newItems, commonItems: newCommonItems });
    return output; // Return the batch output or null for foreach

    /* // Old logic - replaced by specific marking within branches
    if (output !== null) {
        currentContext.storeOutput(this.id, output); // Store the output in context
        currentContext.markNodeSuccess(this.id, { items: newItems, commonItems: newCommonItems });
        return output;
    } else {
        // Handle foreach completion - maybe mark success differently?
        currentContext.markNodeSuccess(this.id, { status: 'Foreach mode initiated', items: newItems, commonItems: newCommonItems });
        return null; // Return null as foreach mode output
    }
    */
  }

  /**
   * Determines if the chained input should be accumulated based on the mode.
   * Also indicates if the node needs to be marked in the context for 'oncePerContext'.
   * @param accumulationMode Current accumulation mode
   * @param chainingUpdateMode Current chaining update mode
   * @param context Current execution context
   * @returns Object with `shouldAccumulate` (boolean) and `needsMarking` (boolean)
   */
  private _shouldAccumulateInput(
    accumulationMode: 'always' | 'oncePerContext' | 'none' | undefined,
    chainingUpdateMode: 'common' | 'replaceCommon' | 'element' | 'replaceElement' | 'none' | undefined,
    context: FlowExecutionContext
  ): { shouldAccumulate: boolean; needsMarking: boolean } {
    if (accumulationMode === 'none') {
      context.log(`${this.type}(${this.id}): Accumulation disabled (mode: none).`);
      return { shouldAccumulate: false, needsMarking: false };
    }

    const affectsCommonItems = chainingUpdateMode === 'common' || chainingUpdateMode === 'replaceCommon';

    if (accumulationMode === 'oncePerContext' && affectsCommonItems) {
      // Ensure the set exists before checking
      if (!context.accumulatedOnceInputNodes) {
        context.accumulatedOnceInputNodes = new Set<string>();
      }
      if (context.accumulatedOnceInputNodes.has(this.id)) {
        context.log(`${this.type}(${this.id}): Skipping common items accumulation due to 'oncePerContext' mode.`);
        return { shouldAccumulate: false, needsMarking: false };
      } else {
        // Needs accumulation AND marking after successful update
        return { shouldAccumulate: true, needsMarking: true }; 
      }
    }

    // Default case: Always accumulate, no special marking needed
    return { shouldAccumulate: true, needsMarking: false };
  }

  /**
   * Applies the chained input items to the appropriate lists based on chainingUpdateMode.
   * @param itemsToAdd The items received from the chained input
   * @param chainingUpdateMode The selected chaining update mode
   * @param currentItems The current element items list
   * @param currentCommonItems The current common items list
   * @param context Current execution context (for logging)
   * @returns Object with updated `newItems`, `newCommonItems`, and `updatePerformed` status
   */
  private _applyChainedInput(
    itemsToAdd: any[],
    chainingUpdateMode: 'common' | 'replaceCommon' | 'element' | 'replaceElement' | 'none' | undefined,
    currentItems: any[],
    currentCommonItems: any[],
    context: FlowExecutionContext
  ): { newItems: any[]; newCommonItems: any[]; updatePerformed: boolean } {
    let newItems = [...currentItems];
    let newCommonItems = [...currentCommonItems];
    let updatePerformed = false;

    // Filter items before applying them
    // Filter out empty objects and null/undefined values
    const validItemsToAdd = itemsToAdd.filter(item => {
        const isEmptyObject = typeof item === 'object' && item !== null && Object.keys(item).length === 0;
        const isNullOrUndefined = item === null || item === undefined;

        if (isEmptyObject) {
            context.log(`${this.type}(${this.id}): Filtering out empty object input.`);
        }
        if (isNullOrUndefined) {
             context.log(`${this.type}(${this.id}): Filtering out null or undefined input.`);
        }

        return !isEmptyObject && !isNullOrUndefined; // Keep only valid items
    });

    if (validItemsToAdd.length === 0 && itemsToAdd.length > 0) { // Log only if filtering actually removed all items
        context.log(`${this.type}(${this.id}): No valid items to apply after filtering.`);
    }
    
    // Proceed only if there are valid items after filtering
    if (validItemsToAdd.length === 0) {
        return { newItems, newCommonItems, updatePerformed: false }; // Return early
    }

    // Apply ONLY validItemsToAdd
    if (chainingUpdateMode === 'common') {
      newCommonItems.push(...validItemsToAdd);
      updatePerformed = true;
      context.log(`${this.type}(${this.id}): Appended ${validItemsToAdd.length} valid item(s) to common items.`);
    } else if (chainingUpdateMode === 'replaceCommon') {
      newCommonItems = validItemsToAdd;
      updatePerformed = true;
      context.log(`${this.type}(${this.id}): Replaced common items with ${validItemsToAdd.length} valid item(s).`);
    } else if (chainingUpdateMode === 'element') {
      newItems.push(...validItemsToAdd);
      updatePerformed = true;
      context.log(`${this.type}(${this.id}): Appended ${validItemsToAdd.length} valid item(s) to element items.`);
    } else if (chainingUpdateMode === 'replaceElement') {
      newItems = validItemsToAdd;
      updatePerformed = true;
      context.log(`${this.type}(${this.id}): Replaced element items with ${validItemsToAdd.length} valid item(s).`);
    }
    // Note: chainingUpdateMode === 'none' is handled outside this method regarding logging.
    // No item update happens in that case.

    return { newItems, newCommonItems, updatePerformed };
  }
}