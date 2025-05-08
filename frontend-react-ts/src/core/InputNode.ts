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
   * Processes chained input, updating items and commonItems based on modes.
   * @param input The input from the previous node.
   * @param nodeContent The current content of this input node.
   * @param currentContext The execution context.
   * @returns An object containing the updated newItems, newCommonItems, and whether an update was performed.
   */
  private _processChainedInput(
    input: any,
    nodeContent: InputNodeContent,
    currentContext: FlowExecutionContext
  ): { newItems: any[]; newCommonItems: any[]; updatePerformed: boolean } {
    let newItems = [...(nodeContent.items || [])];
    let newCommonItems = [...(nodeContent.commonItems || [])];
    let updatePerformed = false;

    if (input !== undefined && input !== null) {
      currentContext.log(`${this.type}(${this.id}): Received chained input.`); // Simplified log
      const { chainingUpdateMode, accumulationMode } = nodeContent;
      const itemsToAdd = Array.isArray(input) ? input : [input];

      const { shouldAccumulate, needsMarking } = this._shouldAccumulateInput(
        accumulationMode,
        chainingUpdateMode,
        currentContext
      );

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

        if (updatePerformed && needsMarking) {
          if (!currentContext.accumulatedOnceInputNodes) {
            currentContext.accumulatedOnceInputNodes = new Set<string>();
          }
          currentContext.accumulatedOnceInputNodes!.add(this.id);
          currentContext.log(`${this.type}(${this.id}): Marked node for 'oncePerContext' accumulation.`);
        }
      }
      
      if (chainingUpdateMode === 'none') {
        currentContext.log(`${this.type}(${this.id}): Chained input ignored due to chainingUpdateMode 'none'.`);
      }

      if (updatePerformed) {
        // TODO: Ideally, the context should handle persistence too,
        // or return the updated content to the runner to handle.
        // For now, keep the direct store call, but acknowledge it's not ideal.
        useNodeContentStore.getState().setNodeContent(this.id, {
          items: newItems,
          commonItems: newCommonItems,
        });
      }
    }
    return { newItems, newCommonItems, updatePerformed };
  }

  /**
   * Retrieves and instantiates child nodes connected to this InputNode.
   * Uses the current execution context to get up-to-date graph information.
   * @param currentContext The execution context.
   * @returns An array of instantiated child Node objects.
   */
  private _getConnectedChildNodeInstances(currentContext: FlowExecutionContext): Node[] {
    // const outputHandleId = `${this.id}-source`; // Assuming a single, default output handle
    const outgoingEdges = currentContext.edges.filter(edge => edge.source === this.id);
    const childNodeIds = outgoingEdges.map(edge => edge.target);

    if (childNodeIds.length === 0) {
      currentContext.log(`${this.type}(${this.id}): No child nodes directly connected for Foreach/sequential execution.`);
      return [];
    }

    currentContext.log(`${this.type}(${this.id}): Found ${childNodeIds.length} connected child node ID(s): ${childNodeIds.join(', ')}`);

    const childNodeInstances: Node[] = [];
    for (const childId of childNodeIds) {
      const nodeData = currentContext.nodes.find(n => n.id === childId);
      if (nodeData && nodeData.type) {
        try {
          const childInstance = currentContext.nodeFactory.create(
            nodeData.id,
            nodeData.type,
            nodeData.data,
            currentContext // Pass the same context down
          );
          childNodeInstances.push(childInstance);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          currentContext.log(`${this.type}(${this.id}): Error instantiating child node ${childId} (type: ${nodeData.type}): ${errorMessage}`);
          // Optionally, re-throw or handle more gracefully if a child cannot be created
        }
      } else {
        currentContext.log(`${this.type}(${this.id}): Could not find node data or type for child ID ${childId}. Skipping instantiation.`);
      }
    }
    return childNodeInstances;
  }

  /**
   * Executes the ForEach mode logic.
   * @param newItems The current individual items.
   * @param newCommonItems The current common items.
   * @param currentContext The execution context.
   * @returns Null, as ForEach mode handles its own child execution and stops default chaining.
   */
  private async _executeForeachMode(
    newItems: any[],
    newCommonItems: any[],
    currentContext: FlowExecutionContext
  ): Promise<null> {
    currentContext.log(`${this.type}(${this.id}): Executing in Foreach mode`);
    const itemsToIterate = [...newCommonItems, ...newItems];

    if (itemsToIterate.length === 0) {
      currentContext.log(`${this.type}(${this.id}): No items to iterate in Foreach mode.`);
      currentContext.markNodeSuccess(this.id, { status: 'Foreach completed (no items)', items: newItems, commonItems: newCommonItems });
      return null;
    }

    currentContext.log(`${this.type}(${this.id}): Found ${itemsToIterate.length} items to iterate.`);
    
    // Find child nodes connected to this node
    const childNodeInstances = this._getConnectedChildNodeInstances(currentContext);

    if (childNodeInstances.length === 0) {
      currentContext.log(`${this.type}(${this.id}): No child nodes connected or instantiated for Foreach execution.`);
      currentContext.markNodeSuccess(this.id, { status: 'Foreach completed (no children to execute)', items: newItems, commonItems: newCommonItems });
      return null;
    }

    for (let i = 0; i < itemsToIterate.length; i++) {
      const item = itemsToIterate[i];
      currentContext.log(`${this.type}(${this.id}): Processing item ${i + 1}/${itemsToIterate.length}`); // Simplified log
      currentContext.setIterationContext({ item: item, index: i, total: itemsToIterate.length });

      for (const childNodeInstance of childNodeInstances) {
        try {
          currentContext.log(`${this.type}(${this.id}): Triggering child node ${childNodeInstance.id} for item ${i + 1}`);
          await childNodeInstance.process(item);
          currentContext.log(`${this.type}(${this.id}): Child node ${childNodeInstance.id} completed for item ${i + 1}`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          currentContext.log(`${this.type}(${this.id}): Error processing child node ${childNodeInstance.id} for item ${i + 1}: ${errorMessage}`);
          currentContext.markNodeError(childNodeInstance.id, `Error during Foreach iteration: ${errorMessage}`);
        }
      }
    }

    currentContext.markNodeSuccess(this.id, { status: `Foreach completed (${itemsToIterate.length} items)`, items: newItems, commonItems: newCommonItems });
    return null; // Crucial: Return null to prevent default chaining in Node.process
  }

  /**
   * Executes the Batch mode logic.
   * @param newItems The current individual items.
   * @param newCommonItems The current common items.
   * @param currentContext The execution context.
   * @returns The combined array of common and individual items.
   */
  private _executeBatchMode(
    newItems: any[],
    newCommonItems: any[],
    currentContext: FlowExecutionContext
  ): any[] {
    currentContext.log(`${this.type}(${this.id}): Executing in Batch mode`);
    const output = [...newCommonItems, ...newItems];
    currentContext.log(`${this.type}(${this.id}): Outputting combined items (Common: ${newCommonItems.length}, Element: ${newItems.length}, Total: ${output.length})`);
    return output;
  }

  /**
   * Main execution method for the InputNode.
   * It processes chained inputs, then executes in either ForEach or Batch mode.
   * @param input The input from a previous node.
   * @returns The output for Batch mode, or null for ForEach mode.
   */
  async execute(input?: any): Promise<any> {
    const currentContext = this.context;
    if (!currentContext || !currentContext.getNodeContentFunc) {
      console.warn(`[InputNode ${this.id}] Execution context or getNodeContentFunc is missing. Cannot proceed robustly.`);
      // Fallback to direct store access if context is not properly set up.
      // This indicates an issue in context creation or propagation.
      const fallbackContent = useNodeContentStore.getState().getNodeContent(this.id, 'input') as InputNodeContent;
      return fallbackContent.items || []; 
    }

    const nodeContent = currentContext.getNodeContentFunc(this.id, 'input') as InputNodeContent;
    currentContext.log(`${this.type}(${this.id}): Executing Input Node`);
    // Node.process will mark it as running. If InputNode overrides process, it should handle this.
    // currentContext.markNodeRunning(this.id); // This is usually handled by Node.process

    const { newItems, newCommonItems } = this._processChainedInput(input, nodeContent, currentContext);

    const executionMode = nodeContent.executionMode || 'batch';
    let output: any;

    if (executionMode === 'foreach') {
      output = await this._executeForeachMode(newItems, newCommonItems, currentContext);
    } else { // Batch mode
      output = this._executeBatchMode(newItems, newCommonItems, currentContext);
    }

    // Storing output and marking success are now primarily handled by Node.process,
    // except for Foreach which marks its own success and returns null.
    // For Batch mode, Node.process will use the returned output.
    // If output is null (from Foreach), Node.process will also mark success with null.
    // currentContext.storeOutput(this.id, output); // Node.process handles this
    
    // Old comments removed:
    // currentContext.markNodeSuccess(this.id, { items: newItems, commonItems: newCommonItems });
    // Old logic block /* ... */ removed.

    return output;
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