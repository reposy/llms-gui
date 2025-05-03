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
      const itemsToIterate = newItems;
      if (itemsToIterate.length === 0) {
        currentContext.log(`${this.type}(${this.id}): No items to iterate in Foreach mode.`);
        output = null; // Or handle as needed, maybe empty array?
      } else {
        // In foreach mode, trigger downstream nodes for each item combined with commonItems
        // The Input node itself might not output directly in this mode, downstream handles it.
        // This logic might belong in the core FlowRunner or GroupNode execution.
        // For now, we'll just return null as the node's direct output.
        currentContext.log(`${this.type}(${this.id}): Foreach mode selected. Downstream nodes will be triggered per item.`);
        output = null; // Input node output is null, triggers happen elsewhere
      }
      
    } else { // Batch mode
      currentContext.log(`${this.type}(${this.id}): Executing in Batch mode`);
      // Combine commonItems and items for batch output
      output = [...newCommonItems, ...newItems];
      currentContext.log(`${this.type}(${this.id}): Outputting combined items (Common: ${newCommonItems.length}, Element: ${newItems.length}, Total: ${output.length})`);
    }

    // Finalize execution
    if (output !== null) {
        currentContext.storeOutput(this.id, output); // Store the output in context
        currentContext.markNodeSuccess(this.id, { items: newItems, commonItems: newCommonItems });
        return output;
    } else {
        // Handle foreach completion - maybe mark success differently?
        currentContext.markNodeSuccess(this.id, { status: 'Foreach mode initiated', items: newItems, commonItems: newCommonItems });
        return null; // Return null as foreach mode output
    }
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

    if (chainingUpdateMode === 'common') {
      newCommonItems.push(...itemsToAdd);
      updatePerformed = true;
      context.log(`${this.type}(${this.id}): Appended to common items.`);
    } else if (chainingUpdateMode === 'replaceCommon') {
      newCommonItems = itemsToAdd;
      updatePerformed = true;
      context.log(`${this.type}(${this.id}): Replaced common items.`);
    } else if (chainingUpdateMode === 'element') {
      newItems.push(...itemsToAdd);
      updatePerformed = true;
      context.log(`${this.type}(${this.id}): Appended to element items.`);
    } else if (chainingUpdateMode === 'replaceElement') {
      newItems = itemsToAdd;
      updatePerformed = true;
      context.log(`${this.type}(${this.id}): Replaced element items.`);
    }
    // Note: chainingUpdateMode === 'none' is handled outside this method regarding logging.
    // No item update happens in that case.

    return { newItems, newCommonItems, updatePerformed };
  }
}