import { Node } from './Node';
import { FlowExecutionContext } from './FlowExecutionContext';
import { InputNodeContent, FileLikeObject } from '../types/nodes';
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
    const nodeContent = useNodeContentStore.getState().getNodeContent(this.id, 'input') as InputNodeContent;
    const currentContext = this.context;

    if (!currentContext) {
      console.warn(`[InputNode ${this.id}] Execution context is missing.`);
      return nodeContent.items || []; // Return existing items if no context
    }

    currentContext.log(`${this.type}(${this.id}): Executing Input Node`);
    currentContext.markNodeRunning(this.id);

    let newItems = [...(nodeContent.items || [])];
    let newCommonItems = [...(nodeContent.commonItems || [])];
    let updatePerformed = false;

    // Process chained input if provided
    if (input !== undefined && input !== null) {
      currentContext.log(`${this.type}(${this.id}): Received chained input: ${JSON.stringify(input)}`);
      const { chainingUpdateMode, accumulationMode } = nodeContent;

      // === Accumulation Control Start ===
      let canAccumulate = true;
      if (accumulationMode === 'none') {
        canAccumulate = false;
        currentContext.log(`${this.type}(${this.id}): Accumulation disabled (mode: none).`);
      } else if (accumulationMode === 'oncePerContext' && (chainingUpdateMode === 'common' || chainingUpdateMode === 'replaceCommon')) {
        // Initialize the Set in the context if it doesn't exist
        if (!currentContext.accumulatedOnceInputNodes) {
            currentContext.accumulatedOnceInputNodes = new Set<string>();
        }
        if (currentContext.accumulatedOnceInputNodes.has(this.id)) {
          currentContext.log(`${this.type}(${this.id}): Skipping common items update due to 'oncePerContext' mode.`);
          canAccumulate = false; // Specifically disable accumulation for common/replaceCommon
        }
      }
      // === Accumulation Control End ===
      
      const itemsToAdd = Array.isArray(input) ? input : [input];

      // Only perform accumulation if canAccumulate is true
      if (canAccumulate) {
        if (chainingUpdateMode === 'common') {
          newCommonItems.push(...itemsToAdd);
          updatePerformed = true;
          if (accumulationMode === 'oncePerContext') { // Mark only if in oncePerContext mode
            currentContext.accumulatedOnceInputNodes!.add(this.id); // Mark as updated
            currentContext.log(`${this.type}(${this.id}): Updated common items and marked for 'oncePerContext'.`);
          }
        } else if (chainingUpdateMode === 'replaceCommon') {
          newCommonItems = itemsToAdd;
          updatePerformed = true;
          if (accumulationMode === 'oncePerContext') { // Mark only if in oncePerContext mode
            currentContext.accumulatedOnceInputNodes!.add(this.id); // Mark as updated
            currentContext.log(`${this.type}(${this.id}): Replaced common items and marked for 'oncePerContext'.`);
          }
        } else if (chainingUpdateMode === 'element') {
          // Note: 'oncePerContext' currently doesn't apply to 'element' mode. 
          // If needed later, the canAccumulate logic might need refinement.
          newItems.push(...itemsToAdd);
          updatePerformed = true;
        } else if (chainingUpdateMode === 'replaceElement') {
          // Replace items with the new input
          newItems = itemsToAdd;
          updatePerformed = true;
          currentContext.log(`${this.type}(${this.id}): Replaced element items.`);
        }
      } // End of if(canAccumulate)
      
      if (chainingUpdateMode === 'none') {
        currentContext.log(`${this.type}(${this.id}): Chained input ignored due to chainingUpdateMode 'none'.`);
      }

      // Persist changes ONLY if accumulation occurred
      if (updatePerformed) {
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
}