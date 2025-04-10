import { Node, Edge } from 'reactflow';
import { NodeData, NodeType, LLMNodeData, APINodeData, OutputNodeData, JSONExtractorNodeData, InputNodeData, ConditionalNodeData, MergerNodeData, WebCrawlerNodeData } from '../types/nodes';
import { ExecutionContext, NodeState, defaultNodeState, ConditionalExecutionResult } from '../types/execution';
import { resolveTemplate } from '../utils/executionUtils'; // Corrected path if utils moved
import { getIncomers } from 'reactflow';
import { makeExecutionLogPrefix as createLogPrefix } from '../controller/executionDispatcher';

// Import specific executors
import { executeLlmNode } from './llmExecutor';
import { executeMergerNode } from './mergerExecutor';
import { executeApiNode } from './apiExecutor';
import { executeConditionalNode } from './conditionalExecutor';
import { executeInputNode } from './inputExecutor';
import { executeOutputNode } from './outputExecutor';
import { executeJsonExtractorNode } from './jsonExtractorExecutor';
import { executeWebCrawlerNode } from './webCrawlerExecutor';

// CRITICAL FIX: Utility function to safely execute node operations and track state updates
// This ensures consistent state management across all node types
async function safeExecuteAndTrack<T>({
  nodeId,
  nodeType,
  executionId,
  setNodeState,
  getNodeState,
  executeFn,
  context,
  debugId = ""
}: {
  nodeId: string;
  nodeType: NodeType;
  executionId: string;
  setNodeState: (nodeId: string, state: Partial<NodeState>) => void;
  getNodeState: (nodeId: string) => NodeState;
  executeFn: () => Promise<T>;
  context: ExecutionContext;
  debugId?: string;
}): Promise<T> {
  const startTime = Date.now();
  
  // Create a temporary node object for logging
  const tempNode: Node<NodeData> = {
    id: nodeId,
    type: nodeType,
    position: { x: 0, y: 0 },
    data: {} as NodeData
  };
  
  // Create standardized log prefix
  const logPrefix = createLogPrefix(tempNode, context, { tag: 'SafeExecute' });
  
  // Set initial running state
  setNodeState(nodeId, {
    status: 'running',
    executionId,
    error: undefined,
    result: undefined,
    _lastUpdate: Date.now()
  });
  
  // Verify state was set correctly
  const initialState = getNodeState(nodeId);
  console.log(`${logPrefix} STARTED:`, {
    executionId,
    iterationMode: context.iterationTracking?.executionMode,
    stateSet: initialState.status === 'running',
    executionIdMatch: initialState.executionId === executionId
  });
  
  try {
    // Execute the node function
    const result = await executeFn();
    const executionTime = Date.now() - startTime;
    
    // Set success state
    setNodeState(nodeId, {
      status: 'success',
      result,
      executionId,
      _lastUpdate: Date.now()
    });
    
    // Verify success state was set correctly
    const finalState = getNodeState(nodeId);
    
    console.log(`${logPrefix} SUCCEEDED in ${executionTime}ms:`, {
      executionId,
      hasResult: !!result,
      resultType: result ? (typeof result === 'object' ? (Array.isArray(result) ? `Array(${Array.isArray(result) ? result.length : 0})` : 'Object') : typeof result) : 'undefined',
      stateUpdated: finalState.status === 'success',
      executionIdMatch: finalState.executionId === executionId
    });
    
    return result;
  } catch (error: any) {
    const executionTime = Date.now() - startTime;
    console.error(`${logPrefix} FAILED in ${executionTime}ms:`, error);
    
    // Set error state
    setNodeState(nodeId, {
      status: 'error',
      error: error.message || 'Unknown error',
      executionId,
      _lastUpdate: Date.now()
    });
    
    // Verify error state was set correctly
    const errorState = getNodeState(nodeId);
    console.log(`${logPrefix} ERROR STATE:`, {
      message: error.message,
      stateUpdated: errorState.status === 'error',
      executionIdMatch: errorState.executionId === executionId
    });
    
    throw error;
  }
}

/**
 * Helper function to extract values from node results while preserving metadata
 * This ensures consistent value extraction across different node types for both batch and foreach modes
 * 
 * Usage:
 * 1. Extract value from inputs: const { value, metadata } = extractValueFromNodeResult(inputs[0])
 * 2. Extract value from array items: items.map(item => extractValueFromNodeResult(item).value)
 */
export function extractValueFromNodeResult(result: any): { value: any; metadata?: any } {
  // If result is null or undefined, return empty result with no metadata
  if (result === null || result === undefined) {
    return { value: null };
  }
  
  // Check if the result has _meta property which indicates it's from input or other nodes
  // that use the metadata wrapper pattern
  if (result && typeof result === 'object' && '_meta' in result) {
    return {
      value: 'value' in result ? result.value : null,
      metadata: result._meta
    };
  }
  
  // For all other cases, return the result as is without metadata
  return { value: result };
}

/**
 * Extracts the value from a context's iterationItem, if present
 * This is a specialized version of extractValueFromNodeResult for context objects
 */
export function extractValueFromContext(context: ExecutionContext): { value: any; metadata?: any } {
  if (!context || !context.iterationItem) {
    return { value: null };
  }
  
  // If iterationItem is already normalized (has value and _meta)
  if (typeof context.iterationItem === 'object' && 
      context.iterationItem !== null && 
      'value' in context.iterationItem && 
      '_meta' in context.iterationItem) {
    return {
      value: context.iterationItem.value,
      metadata: context.iterationItem._meta
    };
  }
  
  // If iterationItem is not normalized, return it directly
  return { value: context.iterationItem };
}

interface DispatchParams {
  node: Node<NodeData>;
  nodes: Node<NodeData>[]; // All nodes in the flow
  edges: Edge[]; // All edges in the flow
  context: ExecutionContext;
  getNodeState: (nodeId: string) => NodeState;
  setNodeState: (nodeId: string, state: Partial<NodeState>) => void;
}

/**
 * Gathers inputs for a node and dispatches execution to the appropriate node-type-specific executor.
 */
export async function dispatchNodeExecution(params: DispatchParams): Promise<any> {
  const { node, nodes, edges, context, getNodeState, setNodeState } = params;
  const nodeId = node.id;
  const { executionId, triggerNodeId } = context;
  const currentState = getNodeState(nodeId) || defaultNodeState;
  const nodeLastExecutionId = currentState.executionId;
  const nodeType = node.type as NodeType || 'unknown';
  
  // Create standardized log prefix
  const logPrefix = createLogPrefix(node, context);
  const debugLogPrefix = createLogPrefix(node, context, { tag: 'DEBUG', includeExecId: true });

  // CRITICAL FIX: Normalize iterationItem format to ensure consistent structure
  // This ensures all node executors receive iterationItem in the expected { value, _meta } format
  const normalizedContext = normalizeExecutionContext(context, nodeId, debugLogPrefix);
  
  // ENHANCED DEBUGGING: Log detailed execution context at the start of every node execution
  console.log(`${debugLogPrefix} START EXECUTION with context:`, {
    executionId: normalizedContext.executionId,
    hasIterationItem: normalizedContext.iterationItem !== undefined,
    isInSubExecution: normalizedContext.isSubExecution,
    iterationTracking: normalizedContext.iterationTracking ? {
      inputNodeId: normalizedContext.iterationTracking.inputNodeId,
      currentIndex: normalizedContext.iterationTracking.currentIndex,
      totalItems: normalizedContext.iterationTracking.totalItems,
      mode: normalizedContext.iterationTracking.executionMode
    } : null,
    iterationItemPreview: normalizedContext.iterationItem !== undefined ? 
      (typeof normalizedContext.iterationItem === 'object' ? 
        JSON.stringify(normalizedContext.iterationItem).substring(0, 100) : 
        String(normalizedContext.iterationItem)) : 
      'undefined'
  });
  
  // --- State Reset Logic ---
  if (nodeLastExecutionId !== executionId) {
    console.log(`${logPrefix} New executionId (${executionId} vs ${nodeLastExecutionId}). Resetting state.`);
    setNodeState(nodeId, {
      status: 'idle',
      result: null,
      error: undefined,
      executionId: executionId,
      lastTriggerNodeId: triggerNodeId,
      // Reset conditional specific fields
      activeOutputHandle: undefined,
      conditionResult: undefined,
    });
  } else {
    console.log(`${logPrefix} Same executionId (${executionId}). Not resetting state.`);
  }
  
  console.log(`${logPrefix} Setting status to running for execution ${executionId}`);
  // Set running state, clearing previous conditional results but keeping executionId
  setNodeState(nodeId, { 
    status: 'running', 
    executionId,
    activeOutputHandle: undefined, // Clear previous handle state
    conditionResult: undefined, // Clear previous boolean result
    _lastUpdate: Date.now() // Add timestamp for tracking when state was updated
  });

  // --- Input Gathering ---
  const incomers = getIncomers(node, nodes, edges);
  let inputs: any[] = [];
  console.log(`[Dispatch${debugLogPrefix}] (${nodeType}) Getting inputs from ${incomers.length} incomers.`);
  
  // Log detailed information about incoming nodes
  if (incomers.length > 0) {
    console.log(`[Dispatch${debugLogPrefix}] Input sources:`, incomers.map(incomer => ({
      id: incomer.id,
      type: incomer.type
    })));
  }
  
  // CRITICAL FIX: Enhanced execution ID compatibility check for foreach mode
  // This ensures inputs from related execution IDs (parent-child) are properly included
  const isExecutionIdCompatible = (sourceExecId: string | undefined): boolean => {
    if (!sourceExecId) return false;
    if (sourceExecId === executionId) return true;
    
    // For foreach mode, we need more sophisticated ID lineage compatibility
    if (normalizedContext.iterationTracking?.executionMode === 'foreach') {
      const originalExecId = normalizedContext.iterationTracking?.originalExecutionId || '';
      
      // Check for related execution IDs:
      // 1. Parent/child relationship (one ID starts with the other)
      const hasParentChildRelationship = 
        (executionId.startsWith(sourceExecId) || sourceExecId.startsWith(executionId));
      
      // 2. Sibling relationship (both from same original execution but different item index)
      const hasSiblingRelationship = 
        (sourceExecId.includes('-item-') && executionId.includes('-item-') &&
         sourceExecId.split('-item-')[0] === executionId.split('-item-')[0]);
         
      // 3. Original execution relationship (source is from before iteration began)
      const isFromOriginalExecution = 
        (originalExecId && sourceExecId === originalExecId);
        
      // CRITICAL FIX: Enhanced logging for execution ID compatibility checks
      console.log(`[ExecIdCheck${debugLogPrefix}] Checking compatibility for ${sourceExecId} and ${executionId}:`, {
        hasParentChild: hasParentChildRelationship, 
        hasSibling: hasSiblingRelationship,
        isFromOriginal: isFromOriginalExecution,
        originalExecId
      });
      
      return !!(hasParentChildRelationship || hasSiblingRelationship || isFromOriginalExecution);
    }
    
    return false;
  };
  
  for (const incomer of incomers) {
    const incomerState = getNodeState(incomer.id);
    
    // CRITICAL FIX: Use the enhanced compatibility check 
    if (incomerState?.status === 'success' && isExecutionIdCompatible(incomerState.executionId)) {
      const incomerResult = incomerState.result;
    
      // Log detailed information about the incomer result
      console.log(`[Dispatch${debugLogPrefix}] Input from ${incomer.id} (${incomer.type}):`, {
        resultType: typeof incomerResult,
        isArray: Array.isArray(incomerResult),
        hasMetadata: incomerResult && typeof incomerResult === 'object' && '_meta' in incomerResult,
        metadataType: incomerResult && typeof incomerResult === 'object' && '_meta' in incomerResult ? 
          incomerResult._meta.mode : 'none',
        valueType: incomerResult && typeof incomerResult === 'object' && 'value' in incomerResult ? 
          (Array.isArray(incomerResult.value) ? `array[${incomerResult.value.length}]` : typeof incomerResult.value) : 'none'
      });
      
      inputs.push(incomerState.result); // Push result directly
    } else if (incomerState?.status === 'error' && isExecutionIdCompatible(incomerState.executionId)) {
      console.log(`[Dispatch${debugLogPrefix}] Incomer ${incomer.id} had error in compatible execution. Propagating error.`);
      // Set current node state to error due to dependency failure
      const errorMessage = `Dependency ${incomer.id} failed.`;
      setNodeState(nodeId, { 
        status: 'error', 
        error: errorMessage, 
        executionId,
        _lastUpdate: Date.now()
      });
      throw new Error(errorMessage);
    } else if (!isExecutionIdCompatible(incomerState?.executionId)) {
      console.log(`[Dispatch${debugLogPrefix}] Input from ${incomer.id} skipped (Incompatible ExecID: ${incomerState?.executionId} vs ${executionId})`);
    } else if (incomerState?.status !== 'success') {
      console.log(`[Dispatch${debugLogPrefix}] Input from ${incomer.id} skipped (Status: ${incomerState?.status})`);
    } else {
        // Log any other cases where input might be skipped unexpectedly
        console.log(`[Dispatch${debugLogPrefix}] Input from ${incomer.id} skipped (State: ${JSON.stringify(incomerState)})`);
    }
  }
  console.log(`[Dispatch${debugLogPrefix}] (${nodeType}) Resolved inputs for execution ${executionId}, count: ${inputs.length}`);
  
  // --- Dispatch Logic ---
  // CRITICAL FIX: Use the safeExecuteAndTrack wrapper to ensure consistent state management
  try {
    // ENHANCED DEBUGGING: Special check for LLM nodes in foreach mode
    if (nodeType === 'llm' && normalizedContext.iterationTracking?.executionMode === 'foreach') {
      console.log(`[ExecutorDispatch${debugLogPrefix}] LLM NODE ${nodeId} in FOREACH mode:`, {
        hasIterationItem: normalizedContext.iterationItem !== undefined,
        iterationItemType: typeof normalizedContext.iterationItem,
        iterationItemValue: normalizedContext.iterationItem !== undefined ? 
          (typeof normalizedContext.iterationItem === 'object' ? 
            JSON.stringify(normalizedContext.iterationItem).substring(0, 100) : 
            String(normalizedContext.iterationItem)) : 
          'undefined',
        hasInputs: inputs.length > 0,
        firstInputPreview: inputs.length > 0 ? 
          (typeof inputs[0] === 'object' ? 
            JSON.stringify(inputs[0]).substring(0, 100) : 
            String(inputs[0])) : 
          'none',
        iterationTracking: normalizedContext.iterationTracking,
        currentNodeState: getNodeState(nodeId).status
      });
    }
    
    // Execute the appropriate executor function based on node type
    switch (nodeType) {
      case 'input': {
        return await safeExecuteAndTrack({
          nodeId,
          nodeType: 'input',
          executionId,
          setNodeState,
          getNodeState,
          context: normalizedContext,
          debugId: debugLogPrefix,
          executeFn: async () => await executeInputNode({ 
            node: node as Node<InputNodeData>, 
            inputs, 
            context: normalizedContext
          })
        });
      }
      case 'llm': {
        return await safeExecuteAndTrack({
          nodeId,
          nodeType: 'llm',
          executionId,
          setNodeState,
          getNodeState,
          context: normalizedContext,
          debugId: debugLogPrefix,
          executeFn: async () => await executeLlmNode({
            node: node as Node<LLMNodeData>,
            inputs,
            context: normalizedContext,
            setNodeState,
            resolveTemplate
          })
        });
      }
      case 'api': {
        return await safeExecuteAndTrack({
          nodeId,
          nodeType: 'api',
          executionId,
          setNodeState,
          getNodeState,
          context: normalizedContext,
          debugId: debugLogPrefix,
          executeFn: async () => await executeApiNode({ 
            node: node as Node<APINodeData>, 
            inputs, 
            context: normalizedContext, 
            setNodeState,
            resolveTemplate  
          })
        });
      }
      case 'output': {
        return await safeExecuteAndTrack({
          nodeId,
          nodeType: 'output',
          executionId,
          setNodeState,
          getNodeState,
          context: normalizedContext,
          debugId: debugLogPrefix,
          executeFn: async () => executeOutputNode({ 
            node: node as Node<OutputNodeData>, 
            inputs, 
            context: normalizedContext 
          })
        });
      }
      case 'json-extractor': {
        return await safeExecuteAndTrack({
          nodeId,
          nodeType: 'json-extractor',
          executionId,
          setNodeState,
          getNodeState,
          context: normalizedContext,
          debugId: debugLogPrefix,
          executeFn: async () => executeJsonExtractorNode({ 
            node: node as Node<JSONExtractorNodeData>, 
            inputs, 
            context: normalizedContext 
          })
        });
      }
      case 'conditional': {
        // Special case for conditional nodes due to additional state properties
        return await safeExecuteAndTrack({
          nodeId,
          nodeType: 'conditional',
          executionId,
          setNodeState,
          getNodeState,
          context: normalizedContext,
          debugId: debugLogPrefix,
          executeFn: async () => {
            // Execute and get the result object
            const conditionalResult: ConditionalExecutionResult = executeConditionalNode({ 
              node: node as Node<ConditionalNodeData>, 
              inputs, 
              context: normalizedContext 
            });
            
            // Store conditional path for UI/debugging (special case state update)
            setNodeState(nodeId, {
              status: 'success',
              executionId,
              activeOutputHandle: conditionalResult.outputHandle,
              _lastUpdate: Date.now()
            });
            
            return conditionalResult.value;
          }
        });
      }
      case 'merger': {
        return await safeExecuteAndTrack({
          nodeId,
          nodeType: 'merger',
          executionId,
          setNodeState,
          getNodeState,
          context: normalizedContext,
          debugId: debugLogPrefix,
          executeFn: async () => executeMergerNode({
            node: node as Node<MergerNodeData>,
            inputs,
            context: normalizedContext,
            setNodeState,
            getNodeState
          })
        });
      }
      case 'web-crawler': {
        return await safeExecuteAndTrack({
          nodeId,
          nodeType: 'web-crawler',
          executionId,
          setNodeState,
          getNodeState,
          context: normalizedContext,
          debugId: debugLogPrefix,
          executeFn: async () => await executeWebCrawlerNode({
            node: node as Node<WebCrawlerNodeData>,
            inputs,
            context: normalizedContext
          })
        });
      }
      case 'group':
        console.log(`[Dispatch${debugLogPrefix}] (Group) Node execution triggered, logic handled by executeFlowForGroup.`);
        return currentState.result; // Pass through result potentially set by controller
      default:
        console.warn(`[Dispatch${debugLogPrefix}] Unknown node type: ${nodeType}`);
        return inputs.length > 0 ? inputs[0] : null; // Default pass-through
    }
  } catch (error: any) {
    console.error(`[ExecutorDispatcher${debugLogPrefix}] Node ${nodeId} execution failed:`, error);
    
    // Update node state with error information - this is redundant with safeExecuteAndTrack,
    // but included as a fallback for node types that don't use it
    setNodeState(nodeId, {
      status: 'error',
      error: error.message || 'Unknown error during execution',
      executionId,
      _lastUpdate: Date.now()
    });
    
    // Rethrow to allow the flow controller to handle the error
    throw error;
  }
}

/**
 * Extracts inputs for a node from the node states of its incoming connections.
 */
function extractInputs(
  node: Node<NodeData>,
  nodes: Node<NodeData>[],
  edges: Edge[],
  context: ExecutionContext,
  getNodeState: (nodeId: string) => NodeState
): any[] {
  // Create standardized log prefix
  const logPrefix = createLogPrefix(node, context);
    
  // Find all edges that lead to this node
  const incomingEdges = edges.filter(edge => edge.target === node.id);
  if (incomingEdges.length === 0) {
    console.log(`${logPrefix} Node has no incoming edges.`);
    return [];
  }
  
  // Get the source node IDs
  const sourceNodeIds = incomingEdges.map(edge => edge.source);
  
  // CRITICAL FIX: Added improved ExecID lineage tracking for ForEach execution
  console.log(`${logPrefix} Extracting inputs from sources:`, sourceNodeIds);
  console.log(`${logPrefix} Current execution context:`, {
    executionId: context.executionId,
    hasIterationItem: !!context.iterationItem,
    iterationMode: context.iterationTracking?.executionMode,
    currentIndex: context.iterationTracking?.currentIndex,
    totalItems: context.iterationTracking?.totalItems,
    originalExecutionId: context.iterationTracking?.originalExecutionId
  });
  
  // Get the state for each source node
  const inputs = sourceNodeIds.map(sourceId => {
    const sourceState = getNodeState(sourceId);
    
    // CRITICAL FIX: Check for compatible ExecID lineage, not just exact match
    const isExactExecIdMatch = sourceState?.executionId === context.executionId;
    
    // For foreach mode, we need to handle execution ID lineage matching
    let isCompatibleExecId = isExactExecIdMatch;
    
    // Check if we're in a foreach context by examining the execution IDs
    if (!isExactExecIdMatch && context.iterationTracking?.executionMode === 'foreach') {
      // In foreach mode, we can have related execution IDs
      const currentExecId = context.executionId || '';
      const sourceExecId = sourceState?.executionId || '';
      const originalExecId = context.iterationTracking?.originalExecutionId || '';
      
      // Consider execID part of the same lineage if:
      // 1. If we're in a foreach iteration and the source result is from the same iteration
      // 2. If the source has the original execID of this iteration (parent to iteration)
      // 3. If source has execID that is a parent/child of the current execID
      isCompatibleExecId = !!(
        // Handle case where source is from same iteration family
        (currentExecId.startsWith(sourceExecId) || sourceExecId.startsWith(currentExecId)) ||
        // Handle case where source is from original execution before iteration began
        (originalExecId && sourceExecId === originalExecId) ||
        // Handle foreach-item executions
        (sourceExecId.includes('-item-') && currentExecId.includes('-item-') && 
         sourceExecId.split('-item-')[0] === currentExecId.split('-item-')[0])
      );
    }
    
    // Log the input extract decision
    console.log(`${logPrefix} Source node ${sourceId} state:`, {
      status: sourceState?.status,
      sourceExecId: sourceState?.executionId,
      currentExecId: context.executionId,
      isCompatible: isCompatibleExecId,
      hasResult: !!sourceState?.result,
      resultTimestamp: sourceState?._lastUpdate
    });
    
    // Only include results from nodes that have a state with matching execution ID
    if (sourceState?.status === 'success' && isCompatibleExecId) {
      return sourceState.result;
    } else {
      console.log(`${logPrefix} Input from node ${sourceId} skipped. ${sourceState ? 
        `(${sourceState.status !== 'success' ? 'Not Success' : 'Stale ExecID'}: ${sourceState.executionId || 'undefined'} vs ${context.executionId})` : 
        'No state found'}`);
      return undefined;
    }
  });
  
  console.log(`${logPrefix} Extracted inputs:`, inputs);
  return inputs;
}

/**
 * Normalizes the execution context to ensure iterationItem has a consistent structure
 * This is critical for template resolution and ensures all executors receive iterationItem
 * in the expected { value, _meta } format
 */
export function normalizeExecutionContext(
  context: ExecutionContext, 
  nodeId: string,
  debugPrefix: string
): ExecutionContext {
  // Create a deep copy of the context to avoid mutations
  const normalizedContext = { ...context };
  
  // Check if we're in foreach mode
  const isForEachMode = normalizedContext.iterationTracking?.executionMode === 'foreach';
  
  // Normalize iterationItem if it exists but doesn't have the expected structure
  if (normalizedContext.iterationItem !== undefined) {
    // Check if iterationItem is already in the expected format
    const hasExpectedFormat = 
      typeof normalizedContext.iterationItem === 'object' &&
      normalizedContext.iterationItem !== null &&
      'value' in normalizedContext.iterationItem &&
      '_meta' in normalizedContext.iterationItem;
    
    if (!hasExpectedFormat) {
      console.log(`${debugPrefix} NORMALIZING ITERATION ITEM:`, {
        beforeType: typeof normalizedContext.iterationItem,
        isDirectValue: typeof normalizedContext.iterationItem !== 'object' || 
                      normalizedContext.iterationItem === null ||
                      (!('value' in normalizedContext.iterationItem) && !('_meta' in normalizedContext.iterationItem)),
        hasValueButNoMeta: typeof normalizedContext.iterationItem === 'object' && 
                          normalizedContext.iterationItem !== null &&
                          'value' in normalizedContext.iterationItem && 
                          !('_meta' in normalizedContext.iterationItem),
        hasMetaButNoValue: typeof normalizedContext.iterationItem === 'object' && 
                          normalizedContext.iterationItem !== null &&
                          !('value' in normalizedContext.iterationItem) && 
                          '_meta' in normalizedContext.iterationItem
      });
      
      // Wrap the raw value in the expected structure with inferred metadata
      normalizedContext.iterationItem = {
        value: normalizedContext.iterationItem,
        _meta: {
          wrapped: true,
          inferred: true,
          timestamp: Date.now(),
          sourceId: nodeId,
          executionId: normalizedContext.executionId,
          originalExecutionId: normalizedContext.iterationTracking?.originalExecutionId || normalizedContext.executionId,
          mode: normalizedContext.iterationTracking?.executionMode || 'foreach-item'
        }
      };
      
      // Set the hasIterationItem flag explicitly
      normalizedContext.hasIterationItem = true;
      
      // Set inputType for debugging
      normalizedContext.inputType = typeof normalizedContext.iterationItem.value === 'object' ? 
                                   'object' : typeof normalizedContext.iterationItem.value;
      
      // Log the normalized structure for debugging
      console.log(`${debugPrefix} NORMALIZED ITEM STRUCTURE:`, {
        now: {
          hasValue: 'value' in normalizedContext.iterationItem,
          hasMeta: '_meta' in normalizedContext.iterationItem,
          valueType: typeof normalizedContext.iterationItem.value,
          valuePreview: typeof normalizedContext.iterationItem.value === 'object' ?
                       JSON.stringify(normalizedContext.iterationItem.value).substring(0, 100) :
                       String(normalizedContext.iterationItem.value)
        }
      });
    } else {
      // Item already has correct structure, just ensure hasIterationItem flag is set
      normalizedContext.hasIterationItem = true;
      
      // Set inputType for debugging
      normalizedContext.inputType = typeof normalizedContext.iterationItem.value === 'object' ? 
                                   'object' : typeof normalizedContext.iterationItem.value;
      
      // Log the existing structure for debugging
      console.log(`${debugPrefix} ITERATION ITEM ALREADY NORMALIZED:`, {
        valueType: typeof normalizedContext.iterationItem.value,
        metaMode: normalizedContext.iterationItem._meta?.mode || 'unknown'
      });
    }
  } else if (isForEachMode) {
    // CRITICAL WARNING: If we're in foreach mode but have no iterationItem, that's a problem
    console.warn(`${debugPrefix} CRITICAL WARNING: Context is in foreach mode but has no iterationItem!`, {
      executionId: normalizedContext.executionId,
      nodeId,
      iterationTracking: normalizedContext.iterationTracking
    });
    
    // Create a placeholder item to prevent template resolution failures
    normalizedContext.iterationItem = {
      value: `[Missing iteration item for node ${nodeId}]`,
      _meta: {
        wrapped: true,
        inferred: true,
        timestamp: Date.now(),
        sourceId: nodeId,
        executionId: normalizedContext.executionId,
        originalExecutionId: normalizedContext.iterationTracking?.originalExecutionId || normalizedContext.executionId,
        mode: 'foreach-item',
        isPlaceholder: true,
        error: 'missing-iteration-item'
      }
    };
    
    // Set the hasIterationItem flag and input type
    normalizedContext.hasIterationItem = true;
    normalizedContext.inputType = 'string';
    
    console.log(`${debugPrefix} CREATED PLACEHOLDER ITERATION ITEM for foreach mode to prevent failures.`);
  }

  return normalizedContext;
}