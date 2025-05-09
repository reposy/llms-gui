import { Node } from './Node';
import { FlowExecutionContext } from './FlowExecutionContext';
import { InputNodeContent } from '../types/nodes';
import { createDefaultNodeContent } from '../store/useNodeContentStore.ts';
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
    property: InputNodeContent = createDefaultNodeContent('input', id) as InputNodeContent,
    context?: FlowExecutionContext
  ) {
    super(id, 'input', property);
    
    // 생성자에서 context를 명시적으로 설정
    if (context) {
      this.context = context;
    }
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

    // 유효한 input인 경우에만 처리 (undefined, null, empty string 등 제외)
    if (input !== undefined && input !== null && input !== '' && 
        !(typeof input === 'string' && input.trim() === '') &&
        !(Array.isArray(input) && input.length === 0) &&
        !(typeof input === 'object' && input !== null && Object.keys(input).length === 0)) {
      this._log(`Received valid chained input.`); 
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
          this._log(`Marked node for 'oncePerContext' accumulation.`);
        }
      }
      
      if (chainingUpdateMode === 'none') {
        this._log(`Chained input ignored due to chainingUpdateMode 'none'.`);
      }

      if (updatePerformed) {
        useNodeContentStore.getState().setNodeContent(this.id, {
          items: newItems,
          commonItems: newCommonItems,
        });
        this._log(`Updated node content with items: ${newItems.length}, commonItems: ${newCommonItems.length}`);
      }
    } else if (input !== undefined) {
      this._log(`Received empty or invalid input. Skipping chained input processing.`);
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
    const outgoingEdges = currentContext.edges.filter(edge => edge.source === this.id);
    const childNodeIds = outgoingEdges.map(edge => edge.target);

    if (childNodeIds.length === 0) {
      this._log(`No child nodes directly connected for Foreach/sequential execution.`);
      return [];
    }

    this._log(`Found ${childNodeIds.length} connected child node ID(s): ${childNodeIds.join(', ')}`);

    const childNodeInstances: Node[] = [];
    for (const childId of childNodeIds) {
      const nodeData = currentContext.nodes.find(n => n.id === childId);
      if (nodeData && nodeData.type) {
        try {
          const childInstance = currentContext.nodeFactory.create(
            nodeData.id,
            nodeData.type,
            nodeData.data,
            currentContext 
          );
          childNodeInstances.push(childInstance);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          this._log(`Error instantiating child node ${childId} (type: ${nodeData.type}): ${errorMessage}`);
        }
      } else {
        this._log(`Could not find node data or type for child ID ${childId}. Skipping instantiation.`);
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
    this._log(`Executing in Foreach mode`);
    const itemsToIterate = [...newCommonItems, ...newItems];

    if (itemsToIterate.length === 0) {
      this._log(`No items to iterate in Foreach mode.`);
      currentContext.markNodeSuccess(this.id, { status: 'Foreach completed (no items)', items: newItems, commonItems: newCommonItems });
      return null;
    }

    this._log(`Found ${itemsToIterate.length} items to iterate.`);
    
    const childNodeInstances = this._getConnectedChildNodeInstances(currentContext);

    if (childNodeInstances.length === 0) {
      this._log(`No child nodes connected or instantiated for Foreach execution.`);
      currentContext.markNodeSuccess(this.id, { status: 'Foreach completed (no children to execute)', items: newItems, commonItems: newCommonItems });
      return null;
    }

    for (let i = 0; i < itemsToIterate.length; i++) {
      const item = itemsToIterate[i];
      this._log(`Processing item ${i + 1}/${itemsToIterate.length}`);
      currentContext.setIterationContext({ item: item, index: i, total: itemsToIterate.length });

      for (const childNodeInstance of childNodeInstances) {
        try {
          this._log(`Triggering child node ${childNodeInstance.id} for item ${i + 1}`);
          await childNodeInstance.process(item, currentContext);
          this._log(`Child node ${childNodeInstance.id} completed for item ${i + 1}`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          this._log(`Error processing child node ${childNodeInstance.id} for item ${i + 1}: ${errorMessage}`);
          currentContext.markNodeError(childNodeInstance.id, `Error during Foreach iteration: ${errorMessage}`);
        }
      }
    }
    currentContext.iterationItem = undefined;
    currentContext.iterationIndex = undefined;
    currentContext.iterationTotal = undefined;
    currentContext.markNodeSuccess(this.id, { status: `Foreach completed (${itemsToIterate.length} items)`, items: newItems, commonItems: newCommonItems });
    return null; 
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
    this._log(`Executing in Batch mode`);
    const output = [...newCommonItems, ...newItems];
    this._log(`Outputting combined items (Common: ${newCommonItems.length}, Element: ${newItems.length}, Total: ${output.length})`);
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
      console.error(`[InputNode:${this.id}] Critical: Execution context or getNodeContentFunc is missing. Cannot proceed robustly.`);
      const fallbackContent = useNodeContentStore.getState().getNodeContent(this.id, 'input') as InputNodeContent;
      return fallbackContent?.items || []; 
    }

    const nodeContent = currentContext.getNodeContentFunc(this.id, 'input') as InputNodeContent;
    this._log('Executing Input Node');

    const { newItems, newCommonItems, updatePerformed } = this._processChainedInput(input, nodeContent, currentContext);
    
    // If chained input processing led to an update, nodeContent might be stale.
    // Re-fetch or use returned newItems/newCommonItems directly.
    const currentItems = updatePerformed ? newItems : (nodeContent.items || []);
    const currentCommonItems = updatePerformed ? newCommonItems : (nodeContent.commonItems || []);

    const iterateEachRow = nodeContent.iterateEachRow || false;
    const executionMode = iterateEachRow ? 'foreach' : 'batch';
    
    this._log(`Using execution mode: ${executionMode} (iterateEachRow: ${iterateEachRow})`);
    
    let output: any;

    if (executionMode === 'foreach') {
      output = await this._executeForeachMode(currentItems, currentCommonItems, currentContext);
    } else { // batch mode
      output = this._executeBatchMode(currentItems, currentCommonItems, currentContext);
    }
    
    // Store the final state of items (especially important for Batch mode if inputs were processed)
    // For ForEach, items might have been used but not directly outputted by `execute`
    // This ensures UI consistency with the data state after execution.
    if (updatePerformed || executionMode === 'batch') {
        // If newItems or newCommonItems were updated by _processChainedInput,
        // they are already stored. Otherwise, store the latest nodeContent derived items.
        if (!updatePerformed) { // Only store if _processChainedInput didn't already.
            useNodeContentStore.getState().setNodeContent(this.id, {
                items: currentItems,
                commonItems: currentCommonItems,
            });
            this._log(`Final items state stored. Items: ${currentItems.length}, CommonItems: ${currentCommonItems.length}`);
        }
    }
    return output;
  }

  /**
   * Determines if the current input should be accumulated based on the node's strategy.
   * @param accumulationMode The accumulation strategy ('always', 'oncePerContext', 'none').
   * @param chainingUpdateMode How the input updates items ('common', 'element', etc.).
   * @param context The current flow execution context.
   * @returns An object indicating if accumulation should occur and if the node needs marking for 'oncePerContext'.
   */
  private _shouldAccumulateInput(
    accumulationMode: 'always' | 'oncePerContext' | 'none' | undefined,
    chainingUpdateMode: 'common' | 'replaceCommon' | 'element' | 'replaceElement' | 'none' | undefined,
    context: FlowExecutionContext
  ): { shouldAccumulate: boolean; needsMarking: boolean } {
    if (chainingUpdateMode === 'none' || accumulationMode === 'none') {
      this._log(`Accumulation skipped: chainingUpdateMode is '${chainingUpdateMode}' or accumulationMode is '${accumulationMode}'.`);
      return { shouldAccumulate: false, needsMarking: false };
    }

    if (accumulationMode === 'oncePerContext') {
      const alreadyAccumulated = context.accumulatedOnceInputNodes?.has(this.id);
      if (alreadyAccumulated) {
        this._log(`Accumulation skipped for 'oncePerContext': Node ${this.id} has already accumulated in this context.`);
        return { shouldAccumulate: false, needsMarking: false };
      }
      return { shouldAccumulate: true, needsMarking: true };
    }
    // Default to 'always' or if accumulationMode is undefined (treat as 'always')
    return { shouldAccumulate: true, needsMarking: false };
  }

  /**
   * Applies the chained input to the node's items or commonItems based on the update mode.
   * @param itemsToAdd The items received from the upstream node.
   * @param chainingUpdateMode The strategy for updating ('common', 'replaceCommon', 'element', 'replaceElement').
   * @param currentItems The current 'items' of the InputNode.
   * @param currentCommonItems The current 'commonItems' of the InputNode.
   * @param currentContext The execution context.
   * @returns An object with the new items, new commonItems, and a flag indicating if an update occurred.
   */
  private _applyChainedInput(
    itemsToAdd: any[],
    chainingUpdateMode: 'common' | 'replaceCommon' | 'element' | 'replaceElement' | 'none' | undefined,
    currentItems: any[],
    currentCommonItems: any[],
    currentContext: FlowExecutionContext 
  ): { newItems: any[]; newCommonItems: any[]; updatePerformed: boolean } {
    let newItems = [...currentItems];
    let newCommonItems = [...currentCommonItems];
    let updatePerformed = false;

    switch (chainingUpdateMode) {
      case 'common':
        newCommonItems.push(...itemsToAdd);
        this._log(`Added items to commonItems. New count: ${newCommonItems.length}.`);
        updatePerformed = true;
        break;
      case 'replaceCommon':
        newCommonItems = [...itemsToAdd];
        this._log(`Replaced commonItems. New count: ${newCommonItems.length}.`);
        updatePerformed = true;
        break;
      case 'element':
        newItems.push(...itemsToAdd);
        this._log(`Added items to items array. New count: ${newItems.length}.`);
        updatePerformed = true;
        break;
      case 'replaceElement':
        newItems = [...itemsToAdd];
        this._log(`Replaced items array. New count: ${newItems.length}.`);
        updatePerformed = true;
        break;
      default:
        break;
    }
    return { newItems, newCommonItems, updatePerformed };
  }
}