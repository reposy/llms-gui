import { Node, Edge } from 'reactflow';
import { NodeData, NodeType, InputNodeData } from '../types/nodes';
import { ExecutionContext, NodeState } from '../types/execution';
import { executeGroupNode, GroupExecutorDependencies } from './groupExecutor';
import { executeSubgraph } from './flowController';
import { dispatchNodeExecution as originalDispatchNodeExecution } from '../executors/executorDispatcher';
import { updateNode } from '../store/useFlowStructureStore';
import { getNodeContent, InputNodeContent } from '../store/useNodeContentStore';

/**
 * Dependencies required by the execution dispatcher
 */
export interface ExecutionDispatcherDependencies extends GroupExecutorDependencies {
  getNodes: () => Node<NodeData>[];
  getEdges: () => Edge[];
  getNodeState: (nodeId: string) => NodeState;
  setNodeState: (nodeId: string, state: Partial<NodeState>) => void;
  getDownstreamNodes: (nodeId: string, includeStartNode: boolean, subsetNodeIds?: Set<string>) => string[];
}

/**
 * Dispatches execution to the appropriate executor based on node type.
 * This centralized dispatcher ensures clear separation of concerns between
 * different node type executors and provides a clean API for the flow controller.
 */
export async function dispatchNodeExecution(
  nodeId: string,
  inputs: any[],
  context: ExecutionContext,
  dependencies: ExecutionDispatcherDependencies
): Promise<any> {
  const { getNodes, getNodeState, setNodeState, getEdges } = dependencies;
  const node = getNodes().find(n => n.id === nodeId);
  
  if (!node) {
    throw new Error(`Node ${nodeId} not found.`);
  }
  
  // Use standardized log prefix for consistent logging
  const logPrefix = makeExecutionLogPrefix(node, context);
  console.log(`${logPrefix} Dispatching execution for node ${nodeId}`);
  console.log(`${logPrefix} Context:`, {
    executionId: context.executionId,
    hasIterationItem: context.iterationItem !== undefined,
    iterationItem: context.iterationItem,
    iterationTracking: context.iterationTracking ? {
      inputNodeId: context.iterationTracking.inputNodeId,
      currentIndex: context.iterationTracking.currentIndex,
      totalItems: context.iterationTracking.totalItems
    } : null
  });
  
  // Special handling for group nodes
  if (node.type === 'group') {
    const groupResults = await executeGroupNode(
      nodeId,
      inputs,
      context,
      dependencies
    );
    
    // Set the node state with the results to ensure they're available for chaining
    dependencies.setNodeState(nodeId, {
      status: 'success',
      result: groupResults, // Store the array of results from the group's leaf nodes
      executionId: context.executionId
    });
    
    console.log(`${logPrefix} Group node execution complete. Result:`, groupResults);
    return groupResults; // Return the results for chaining to downstream nodes
  }
  
  // Special handling for Input nodes with iterateEachRow option
  if (node.type === 'input') {
    const inputNodeId = node.id;
    const inputNodeData = node.data as InputNodeData;
    
    // CRITICAL FIX: Get the latest content from store to ensure we have current flags
    const storeContent = getNodeContent(inputNodeId) as InputNodeContent;
    const iterateEachRow = storeContent.iterateEachRow ?? inputNodeData.iterateEachRow;
    
    // Add explicit logging to help debug the issue
    console.log(`${logPrefix} Input node execution mode check:`, {
      fromNodeData: inputNodeData.iterateEachRow,
      fromContentStore: storeContent.iterateEachRow,
      finalMode: iterateEachRow ? 'foreach' : 'batch',
      inputItems: inputNodeData.items?.length || 0,
      storeItems: storeContent.items?.length || 0
    });
    
    // Check if this is an input node in foreach mode
    if (iterateEachRow) {
      console.log(`${logPrefix} Input node is in foreach mode. Handling iteration.`);
      return await handleInputNodeIteration(
        node as Node<InputNodeData>,
        context,
        dependencies
      );
    }
    
    // Normal execution for input node in batch mode
    console.log(`${logPrefix} Input node is in batch mode. Using standard execution.`);
    // We still use the standard executor for batch mode
    const result = await originalDispatchNodeExecution({
      node,
      nodes: getNodes(),
      edges: dependencies.getEdges(),
      context,
      getNodeState: dependencies.getNodeState,
      setNodeState: dependencies.setNodeState
    });
    
    console.log(`${logPrefix} Input node (batch mode) execution complete. Result:`, 
      result && typeof result === 'object' && result._meta 
        ? { meta: result._meta, valueType: Array.isArray(result.value) ? `Array(${result.value.length})` : typeof result.value }
        : result
    );
    
    return result;
  }
  
  // For other node types, use the original dispatcher from executorDispatcher.ts
  return await originalDispatchNodeExecution({
    node,
    nodes: getNodes(),
    edges: dependencies.getEdges(),
    context,
    getNodeState: dependencies.getNodeState,
    setNodeState: dependencies.setNodeState
  });
}

/**
 * Special handler for input nodes with iterateEachRow option.
 * Executes downstream nodes once for each row in the input.
 */
async function handleInputNodeIteration(
  inputNode: Node<InputNodeData>,
  context: ExecutionContext,
  dependencies: ExecutionDispatcherDependencies
): Promise<any[]> {
  const { getNodes, getEdges, getNodeState, setNodeState, getDownstreamNodes } = dependencies;
  const inputNodeId = inputNode.id;
  
  // CRITICAL FIX: Get the latest content from store to ensure we have current items and settings
  const storeContent = getNodeContent(inputNodeId) as InputNodeContent;
  const executeInParallel = storeContent.executeInParallel ?? inputNode.data.executeInParallel;
  
  // Merge the node data with store content to get the most up-to-date state
  const inputData = {
    ...inputNode.data,
    items: storeContent.items ?? inputNode.data.items,
    iterateEachRow: storeContent.iterateEachRow ?? inputNode.data.iterateEachRow,
    executeInParallel: executeInParallel
  };
  
  console.log(`[InputIteration ${inputNodeId}] Node data after sync with content store:`, {
    fromNodeData: {
      iterateEachRow: inputNode.data.iterateEachRow,
      executeInParallel: inputNode.data.executeInParallel,
      itemsCount: inputNode.data.items?.length || 0
    },
    fromContentStore: {
      iterateEachRow: storeContent.iterateEachRow,
      executeInParallel: storeContent.executeInParallel,
      itemsCount: storeContent.items?.length || 0
    },
    mergedState: {
      iterateEachRow: inputData.iterateEachRow,
      executeInParallel: inputData.executeInParallel,
      itemsCount: inputData.items?.length || 0
    }
  });
  
  const originalExecutionId = context.executionId;
  
  // Get the items to iterate over
  const items = inputData.items || [];
  if (items.length === 0) {
    console.log(`[InputIteration ${inputNodeId}] No items to iterate over.`);
    setNodeState(inputNodeId, { 
      status: 'success', 
      result: [], 
      executionId: originalExecutionId 
    });
    return [];
  }
  
  console.log(`[InputIteration ${inputNodeId}] Starting iteration over ${items.length} items.`);
  
  // Identify all downstream nodes to construct a proper subgraph
  const allNodes = getNodes();
  const allEdges = getEdges();
  
  // Get all downstream nodes (to include in our subgraph)
  const downstreamNodeIds = new Set(getDownstreamNodes(inputNodeId, false));
  console.log(`[InputIteration ${inputNodeId}] Found ${downstreamNodeIds.size} downstream nodes.`);
  
  if (downstreamNodeIds.size === 0) {
    console.log(`[InputIteration ${inputNodeId}] No downstream nodes to execute.`);
    setNodeState(inputNodeId, { 
      status: 'success', 
      result: items, 
      executionId: originalExecutionId 
    });
    return items;
  }
  
  // Construct our subgraph
  const nodesInSubgraph = [...allNodes.filter(n => downstreamNodeIds.has(n.id) || n.id === inputNodeId)];
  const edgesInSubgraph = [...allEdges.filter(e => 
    (downstreamNodeIds.has(e.source) || e.source === inputNodeId) && 
    (downstreamNodeIds.has(e.target) || e.target === inputNodeId))
  ];
  
  console.log(`[InputIteration ${inputNodeId}] Created subgraph with ${nodesInSubgraph.length} nodes and ${edgesInSubgraph.length} edges.`);
  
  // Initialize the input node's iteration status
  setNodeState(inputNodeId, {
    status: 'running',
    executionId: originalExecutionId,
    iterationStatus: {
      currentIndex: 0,
      totalItems: items.length,
      completed: false
    }
  });
  
  // Update the node data for UI using Zustand
  updateNode(inputNodeId, (node) => ({
    ...node,
    data: {
      ...node.data,
      iterationStatus: {
        currentIndex: 0,
        totalItems: items.length,
        completed: false
      }
    }
  }));
  
  // Array to store all iteration results
  const allResults: any[] = [];
  const executeItem = async (index: number): Promise<any> => {
    const item = items[index];
    
    // Update iteration status in both state and node data
    setNodeState(inputNodeId, {
      iterationStatus: {
        currentIndex: index,
        totalItems: items.length,
        completed: false
      }
    });
    
    // Update node data for UI using Zustand
    updateNode(inputNodeId, (node) => ({
      ...node,
      data: {
        ...node.data,
        iterationStatus: {
          currentIndex: index,
          totalItems: items.length,
          completed: false
        }
      }
    }));
    
    console.log(`[InputIteration ${inputNodeId}] [Iteration ${index}] Processing item ${index + 1}/${items.length}:`, item);
    
    // Create a sub-execution context for this iteration
    const itemExecutionId = `${originalExecutionId}-item-${index}`;
    
    // CRITICAL FIX: Properly wrap the item with its metadata for iterationItem
    // This ensures that the item appears to LLM nodes with the expected structure 
    // similar to what they would see from a normal input node's result
    const wrappedItem = {
      value: item,
      _meta: {
        index,
        totalItems: items.length,
        executionId: itemExecutionId,
        originalExecutionId,
        source: 'input-node',
        sourceId: inputNodeId,
        mode: 'foreach-item'
      }
    };
    
    // CRITICAL FIX: Log the formatted item with metadata
    console.log(`[InputIteration ${inputNodeId}] [Iteration ${index}] Formatted item with metadata:`, {
      item: typeof item === 'object' ? JSON.stringify(item).substring(0, 100) : item,
      meta: wrappedItem._meta
    });
    
    // CRITICAL FIX: Ensure item is never undefined or null
    if (item === undefined || item === null) {
      console.error(`[InputIteration ${inputNodeId}] [Iteration ${index}] ERROR: Item is ${item === undefined ? 'undefined' : 'null'}!`);
      // Create a placeholder item to prevent errors
      wrappedItem.value = `[Error: Empty item at index ${index}]`;
      console.log(`[InputIteration ${inputNodeId}] [Iteration ${index}] Created placeholder value to prevent errors:`, wrappedItem.value);
    }
    
    const iterationContext: ExecutionContext = {
      isSubExecution: true,
      triggerNodeId: context.triggerNodeId,
      executionId: itemExecutionId, // Unique execution ID for each iteration
      iterationItem: wrappedItem, // CRITICAL FIX: Pass the wrapped item instead of the raw item
      hasIterationItem: true, // Explicitly set hasIterationItem flag
      inputType: typeof item === 'object' ? 'object' : typeof item, // Add type info for debugging
      iterationTracking: {
        inputNodeId,
        originalExecutionId,
        currentIndex: index,
        totalItems: items.length,
        inputLabel: inputNode.data.label || `Input ${inputNodeId}`,
        executionMode: 'foreach'
      }
    };

    // CRITICAL FIX: Add detailed debugging for iteration context
    console.log(`[InputIteration ${inputNodeId}] [Iteration ${index}] CRITICAL CHECK - Iteration context created:`, {
      hasIterationItem: iterationContext.hasIterationItem,
      iterationItemType: typeof iterationContext.iterationItem,
      iterationItemValue: typeof iterationContext.iterationItem === 'object' 
        ? JSON.stringify(iterationContext.iterationItem).substring(0, 100) 
        : String(iterationContext.iterationItem),
      executionMode: iterationContext.iterationTracking?.executionMode,
      contextExecutionId: iterationContext.executionId
    });
    
    try {
      // CRITICAL FIX: Verify downstream node state before execution
      const directDownstreamNodeIds = edgesInSubgraph
        .filter(e => e.source === inputNodeId)
        .map(e => e.target);
        
      console.log(`[InputIteration ${inputNodeId}] [Iteration ${index}] PRE-EXECUTION STATE CHECK for direct downstream nodes:`, 
        directDownstreamNodeIds.map(nodeId => {
          const state = getNodeState(nodeId);
          return {
            nodeId,
            status: state.status,
            hasResult: !!state.result,
            executionId: state.executionId
          };
        })
      );
      
      // Clear any previous state for this iteration
      nodesInSubgraph.forEach(node => {
        if (node.id !== inputNodeId) { // Don't reset the input node itself
          // CRITICAL FIX: Explicitly mark node as ready for execution with a consistent state
          setNodeState(node.id, { 
            status: 'idle', 
            result: null, 
            error: undefined, 
            executionId: itemExecutionId 
          });
        }
      });
      
      // Set input node's result in its state so downstream nodes can access it
      setNodeState(inputNodeId, {
        status: 'success',
        result: wrappedItem, // Important: Use wrapped item with metadata
        executionId: itemExecutionId
      });
      
      // CRITICAL FIX: Verify input node state was properly set before executing downstream
      const inputNodeState = getNodeState(inputNodeId);
      console.log(`[InputIteration ${inputNodeId}] [Iteration ${index}] VERIFICATION - Input node state after setting:`, {
        status: inputNodeState.status,
        executionId: inputNodeState.executionId,
        hasResult: !!inputNodeState.result,
        resultMatchesExpected: inputNodeState.result?.value === item,
        resultValue: inputNodeState.result?.value !== undefined ? 
          (typeof inputNodeState.result.value === 'object' ? 
            JSON.stringify(inputNodeState.result.value).substring(0, 100) : 
            String(inputNodeState.result.value)) : 'undefined',
        inputItem: typeof item === 'object' ? JSON.stringify(item).substring(0, 100) : String(item)
      });
      
      // CRITICAL FIX: Double check that the input node state is properly set with a concrete result
      // This ensures downstream dependency checks succeed
      if (!inputNodeState.result || inputNodeState.status !== 'success') {
        console.error(`[InputIteration ${inputNodeId}] [Iteration ${index}] CRITICAL ERROR: Input node state not properly set!`);
        console.log(`[InputIteration ${inputNodeId}] [Iteration ${index}] Re-applying input node state with concrete result...`);
        
        // Force set the input node state again with a concrete result to unblock dependencies
        setNodeState(inputNodeId, {
          status: 'success',
          result: {
            value: item,
            _meta: {
              index,
              totalItems: items.length,
              executionId: itemExecutionId,
              originalExecutionId,
              source: 'input-node-forced',
              sourceId: inputNodeId,
              mode: 'foreach-item'
            }
          },
          executionId: itemExecutionId
        });
        
        // Verify the state was properly set after the forced update
        const verifiedState = getNodeState(inputNodeId);
        console.log(`[InputIteration ${inputNodeId}] [Iteration ${index}] VERIFICATION AFTER FORCE UPDATE:`, {
          status: verifiedState.status,
          hasResult: !!verifiedState.result,
          resultValue: verifiedState.result?.value !== undefined ? 
            (typeof verifiedState.result.value === 'object' ? 
              JSON.stringify(verifiedState.result.value).substring(0, 100) : 
              String(verifiedState.result.value)) : 'undefined'
        });
      }
      
      // Add a short delay to ensure states propagate
      await new Promise(resolve => setTimeout(resolve, 100)); // Increased delay for better state propagation
      
      // Identify any merger nodes that are downstream - these should be executed AFTER all iterations
      const mergerNodeIds = nodesInSubgraph
        .filter(node => node.type === 'merger')
        .map(node => node.id);
      
      console.log(`[InputIteration ${inputNodeId}] [Iteration ${index}] Found ${mergerNodeIds.length} merger nodes that will be executed after all iterations.`);
      
      // Execute the full subgraph starting from direct downstream nodes, excluding mergers
      // Find direct downstream nodes from the input node to use as roots, excluding mergers
      const executionRoots = directDownstreamNodeIds.filter(id => !mergerNodeIds.includes(id));
      
      if (executionRoots.length === 0) {
        console.log(`[InputIteration ${inputNodeId}] [Iteration ${index}] No direct downstream nodes to execute (excluding mergers).`);
        return item; // Return the item as is if there are no downstream non-merger nodes
      }
      
      console.log(`[InputIteration ${inputNodeId}] [Iteration ${index}] Starting execution with ${executionRoots.length} root nodes:`, {
        roots: executionRoots,
        iterationItemPresent: !!iterationContext.iterationItem,
        itemValue: typeof item === 'object' ? JSON.stringify(item).substring(0, 100) : item,
        executionId: itemExecutionId
      });

      // CRITICAL FIX: Direct check for LLM nodes that will be executed
      const llmNodesInExecution = nodesInSubgraph
        .filter(node => node.type === 'llm' && executionRoots.includes(node.id));

      if (llmNodesInExecution.length > 0) {
        console.log(`[InputIteration ${inputNodeId}] [Iteration ${index}] IMPORTANT: Flow contains ${llmNodesInExecution.length} direct LLM nodes that should be executed:`, 
          llmNodesInExecution.map(n => n.id));
          
        // Pre-check LLM nodes to ensure they're in the right state before execution
        llmNodesInExecution.forEach(llmNode => {
          const currentState = getNodeState(llmNode.id);
          console.log(`[InputIteration ${inputNodeId}] [Iteration ${index}] Pre-execution state for LLM node ${llmNode.id}:`, {
            status: currentState.status,
            executionId: currentState.executionId,
            hasValidState: currentState.status === 'idle' || currentState.executionId === itemExecutionId
          });
          
          // Ensure LLM node is properly reset to idle state with the correct execution ID
          if (currentState.executionId !== itemExecutionId) {
            setNodeState(llmNode.id, {
              status: 'idle',
              executionId: itemExecutionId,
              result: undefined,
              error: undefined
            });
            console.log(`[InputIteration ${inputNodeId}] [Iteration ${index}] Reset LLM node ${llmNode.id} to idle state with executionId ${itemExecutionId}`);
          }
        });
        
        // For direct LLM nodes that are connected to the input node, ensure immediate execution
        const directLlmNodes = llmNodesInExecution.filter(node => 
          edgesInSubgraph.some(edge => edge.source === inputNodeId && edge.target === node.id)
        );
        
        if (directLlmNodes.length > 0) {
          console.log(`[InputIteration ${inputNodeId}] [Iteration ${index}] CRITICAL: Found ${directLlmNodes.length} LLM nodes directly connected to input. Ensuring execution.`);
          
          // CRITICAL FIX: More robust delay to ensure state updates completely propagate
          // Increase from 50ms to 200ms to ensure state is fully propagated
          await new Promise(resolve => setTimeout(resolve, 200));
          
          // CRITICAL: For direct LLM nodes, explicitly verify they were executed
          const verifyDirectLlmExecution = async () => {
            // Check the state after a short delay to ensure execution has started
            await new Promise(resolve => setTimeout(resolve, 300));
            
            for (const llmNode of directLlmNodes) {
              const state = getNodeState(llmNode.id);
              console.log(`[InputIteration ${inputNodeId}] [Iteration ${index}] Direct LLM node ${llmNode.id} state after execution:`, {
                status: state.status,
                executionId: state.executionId,
                matchesIterationId: state.executionId === itemExecutionId,
                result: state.result ? 'has-result' : 'no-result',
                isIdle: state.status === 'idle',
                isRunning: state.status === 'running',
                needsExecution: state.status === 'idle' || state.status === 'skipped'
              });
              
              // If the LLM node is still in idle state or hasn't started execution, something went wrong with dispatching
              // CRITICAL FIX: Force execute LLM nodes that aren't being picked up by the normal flow
              if (state.status === 'idle' && state.executionId === itemExecutionId) {
                console.warn(`[InputIteration ${inputNodeId}] [Iteration ${index}] CRITICAL ISSUE: LLM node ${llmNode.id} was not executed (${state.status}) - FORCING EXECUTION!`);
                
                // Force immediate execution of LLM nodes that failed to execute during normal flow
                console.log(`[InputIteration ${inputNodeId}] [Iteration ${index}] Forcing direct execution of LLM node ${llmNode.id}`);
                try {
                  // CRITICAL FIX: Ensure the iterationItem is properly passed to the LLM node
                  // Create a DEEP COPY of the iteration context to ensure it's not modified
                  const forcedContext = JSON.parse(JSON.stringify(iterationContext));
                  
                  // Explicitly ensure the iterationItem is set correctly with the proper structure
                  forcedContext.iterationItem = {
                    value: item,
                    _meta: {
                      index,
                      totalItems: items.length,
                      executionId: itemExecutionId,
                      originalExecutionId,
                      source: 'input-node-forced',
                      sourceId: inputNodeId,
                      mode: 'foreach-item'
                    }
                  };
                  
                  // CRITICAL FIX: Add explicit hasIterationItem flag to help debugging
                  forcedContext.hasIterationItem = true;
                  forcedContext.inputType = typeof item === 'object' ? 'object' : typeof item;
                  
                  // Add extra debugging to verify context right before execution
                  console.log(`[InputIteration ${inputNodeId}] [Iteration ${index}] FORCED EXECUTION CONTEXT:`, {
                    hasIterationItem: forcedContext.hasIterationItem,
                    iterationItemValue: typeof forcedContext.iterationItem.value === 'object' ?
                      JSON.stringify(forcedContext.iterationItem.value).substring(0, 100) :
                      String(forcedContext.iterationItem.value),
                    executionId: forcedContext.executionId,
                    forcedInputType: forcedContext.inputType
                  });
                  
                  // Get the input node state for input passing
                  const inputNodeState = getNodeState(inputNodeId);
                  
                  // Directly dispatch execution to the LLM node with the enhanced context
                  await dispatchNodeExecution(
                    llmNode.id,
                    [inputNodeState.result], // Pass the input node's result as input
                    forcedContext,
                    dependencies
                  );
                  
                  // Verify the forced execution worked
                  const afterState = getNodeState(llmNode.id);
                  console.log(`[InputIteration ${inputNodeId}] [Iteration ${index}] Forced execution of LLM node ${llmNode.id} result:`, {
                    beforeStatus: state.status,
                    afterStatus: afterState.status,
                    hasResult: !!afterState.result,
                    success: afterState.status === 'success'
                  });
                } catch (error) {
                  console.error(`[InputIteration ${inputNodeId}] [Iteration ${index}] Failed to directly execute LLM node ${llmNode.id}:`, error);
                }
              }
            }
          };
          
          // Start verification in background - don't await so execution can continue in parallel
          verifyDirectLlmExecution();
        }
      }

      // CRITICAL FIX: Verify node states right before execution
      console.log(`[InputIteration ${inputNodeId}] [Iteration ${index}] EXECUTION VERIFICATION:`,
        executionRoots.map(nodeId => {
          const state = getNodeState(nodeId);
          return {
            nodeId,
            executionId: state.executionId,
            status: state.status,
            matchesIterationId: state.executionId === itemExecutionId
          };
        })
      );

      // CRITICAL FIX: Execute with an explicit timeout to prevent hung executions
      const executeWithTimeout = async () => {
        // Create a timeout promise that rejects after 60 seconds
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error(`Execution timeout after 60 seconds for iteration ${index}`)), 60000);
        });
        
        // Race the execution against the timeout
        try {
          // Create a subgraph without merger nodes for this iteration
          const iterationSubgraph = {
            nodes: nodesInSubgraph.filter(node => !mergerNodeIds.includes(node.id)), 
            edges: edgesInSubgraph.filter(edge => !mergerNodeIds.includes(edge.target))
          };
          
          console.log(`[InputIteration ${inputNodeId}] [Iteration ${index}] Executing subgraph with ${iterationSubgraph.nodes.length} nodes (excluding mergers).`);
          
          const result = await Promise.race([
            executeSubgraph(
              executionRoots,
              iterationSubgraph.nodes,
              iterationSubgraph.edges,
              iterationContext,
              dependencies
            ),
            timeoutPromise
          ]) as Record<string, any>;
          
          return result;
        } catch (error) {
          console.error(`[InputIteration ${inputNodeId}] [Iteration ${index}] Execution timed out or failed:`, error);
          throw error;
        }
      };

      const results = await executeWithTimeout();

      // CRITICAL FIX: Verify node states after execution
      const postExecutionStates = executionRoots.map(nodeId => {
        const state = getNodeState(nodeId);
        return {
          nodeId,
          status: state.status,
          hasResult: !!state.result,
          executionId: state.executionId,
          matchesIterationId: state.executionId === itemExecutionId
        };
      });
      
      console.log(`[InputIteration ${inputNodeId}] [Iteration ${index}] POST-EXECUTION STATE CHECK:`, postExecutionStates);

      // Check for nodes that didn't successfully execute
      const failedNodes = postExecutionStates.filter(state => state.status !== 'success');
      if (failedNodes.length > 0) {
        console.warn(`[InputIteration ${inputNodeId}] [Iteration ${index}] Some nodes did not complete successfully:`, failedNodes);
      }

      // Find leaf nodes (nodes without outgoing edges within our subgraph, excluding edges to merger nodes)
      const leafNodeIds = nodesInSubgraph
        .filter(node => !mergerNodeIds.includes(node.id)) // Exclude merger nodes
        .map(n => n.id)
        .filter(nodeId => 
          !edgesInSubgraph.some(e => 
            e.source === nodeId && 
            downstreamNodeIds.has(e.target) &&
            !mergerNodeIds.includes(e.target)
          )
        );
      
      // Collect results from leaf nodes
      const leafResults = leafNodeIds.map(id => results[id]).filter(r => r !== undefined);
      console.log(`[InputIteration ${inputNodeId}] [Iteration ${index}] Completed with ${leafResults.length} leaf results from ${leafNodeIds.length} leaf nodes.`);
      
      // Store the leaf results for this iteration
      return leafResults.length > 0 ? leafResults : item;
    } catch (error) {
      console.error(`[InputIteration ${inputNodeId}] [Iteration ${index}] Error processing item:`, error);
      
      // CRITICAL FIX: For error cases, still update the node state to indicate error
      // This ensures we don't get "idle" nodes after execution attempts
      nodesInSubgraph.forEach(node => {
        if (node.id !== inputNodeId && getNodeState(node.id).status === 'running') {
          setNodeState(node.id, {
            status: 'error',
            error: `Failed during iteration ${index}: ${error instanceof Error ? error.message : String(error)}`,
            executionId: itemExecutionId
          });
        }
      });
      
      return { error: error instanceof Error ? error.message : String(error), item, index };
    }
  };
  
  // Execute all items sequentially or in parallel based on the flag
  if (executeInParallel) {
    console.log(`[InputIteration ${inputNodeId}] Executing all ${items.length} items in parallel`);
    // For parallel execution, use Promise.all
    const promises = items.map((_, index) => executeItem(index));
    const results = await Promise.all(promises);
    allResults.push(...results.flat());
  } else {
    console.log(`[InputIteration ${inputNodeId}] Executing all ${items.length} items sequentially`);
    // For sequential execution, process one item at a time
    for (let index = 0; index < items.length; index++) {
      const result = await executeItem(index);
      allResults.push(result);
    }
  }
  
  // Update input node state with the iteration results
  setNodeState(inputNodeId, {
    status: 'success',
    result: allResults.flat(), // Flatten the results array
    executionId: originalExecutionId,
    iterationStatus: {
      currentIndex: items.length,
      totalItems: items.length,
      completed: true
    }
  });
  
  // Check if there are any merger nodes that need to be executed after all iterations
  const mergerNodes = nodesInSubgraph.filter(node => node.type === 'merger');
  
  if (mergerNodes.length > 0) {
    console.log(`[InputIteration ${inputNodeId}] Processing ${mergerNodes.length} merger nodes after all iterations`);
    
    // Create a new execution context for mergers that isn't tied to any specific iteration
    const mergerExecutionId = `${originalExecutionId}-merger`;
    
    // Identify nodes that produce results for mergers (all nodes that lead to merger nodes)
    const mergerInputNodes = nodesInSubgraph.filter(n => 
      edgesInSubgraph.some(e => e.source === n.id && mergerNodes.some(m => m.id === e.target))
    );
    
    console.log(`[InputIteration ${inputNodeId}] Found ${mergerInputNodes.length} nodes that feed into mergers:`, 
      mergerInputNodes.map(n => ({ id: n.id, type: n.type })));
    
    // CRITICAL FIX: Wait for all LLM nodes to complete before proceeding with merger execution
    // This ensures we have all results before executing the merger nodes
    if (executeInParallel) {
      console.log(`[InputIteration ${inputNodeId}] Parallel execution - waiting for all LLM nodes to finish processing...`);
      
      // Initial wait to allow all executions to complete
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    // Collect all results from previous iterations for each merger input node
    const iterationResultsByNodeId = new Map<string, any[]>();
    
    // Try several times to get all results with exponential backoff
    let retryCount = 0;
    const maxRetries = 5;
    let allResultsCollected = false;
    
    while (retryCount < maxRetries && !allResultsCollected) {
      let missingResultsCount = 0;
      
      // For each node that feeds into mergers, collect all results from all iterations
      for (const inputNode of mergerInputNodes) {
        const nodeId = inputNode.id;
        const results: any[] = [];
        
        // Track which iterations we've found results for
        const foundResultsForIteration = new Array(items.length).fill(false);
        
        // For each iteration, try to find the result for this node
        for (let i = 0; i < items.length; i++) {
          const itemExecutionId = `${originalExecutionId}-item-${i}`;
          const iterationState = getNodeState(nodeId);
          
          // Check if we have a successful result for this iteration
          const isFromThisIteration = 
            iterationState.executionId === itemExecutionId || 
            iterationState.executionId?.startsWith(itemExecutionId) || 
            (iterationState.executionId?.includes('-item-') && 
             iterationState.executionId?.split('-item-')[0] === originalExecutionId);
          
          // CRITICAL FIX: Enhanced logging to debug result collection issues
          console.log(`[InputIteration ${inputNodeId}] Checking result for node ${nodeId} (${inputNode.type}) in iteration ${i}:`, {
            stateStatus: iterationState?.status || 'no-state',
            executionId: iterationState?.executionId || 'none',
            expectedExecutionId: itemExecutionId,
            isFromThisIteration,
            hasResult: iterationState?.result !== undefined,
            isRunning: iterationState?.status === 'running',
            isIdle: iterationState?.status === 'idle'
          });
          
          if (iterationState && 
              isFromThisIteration && 
              iterationState.status === 'success' && 
              iterationState.result !== undefined) {
            
            console.log(`[InputIteration ${inputNodeId}] Found result for node ${nodeId} from iteration ${i}:`, {
              executionId: iterationState.executionId,
              hasResult: !!iterationState.result,
              resultType: typeof iterationState.result
            });
            
            results.push(iterationState.result);
            foundResultsForIteration[i] = true;
          } else {
            missingResultsCount++;
            
            // CRITICAL FIX: Handle case where nodes might be stuck in idle or running state
            if (iterationState?.status === 'idle' && inputNode.type === 'llm') {
              console.warn(`[InputIteration ${inputNodeId}] LLM node ${nodeId} is in idle state for iteration ${i}. This suggests it was never executed.`);
              
              // This section can be uncommented if you wish to force-trigger LLM nodes that didn't execute
              // This is a more aggressive approach if the normal execution mechanism is failing
              /*
              console.log(`[InputIteration ${inputNodeId}] Attempting to re-trigger execution for idle LLM node ${nodeId} in iteration ${i}`);
              try {
                // Retrieve the original iteration context
                const retryItemExecutionId = `${originalExecutionId}-item-${i}-retry-${retryCount}`;
                const retryIterationContext = {
                  ...iterationContext,
                  executionId: retryItemExecutionId,
                  iterationItem: items[i]
                };
                
                // Execute just this node with the retry context
                await dispatchNodeExecution(
                  nodeId,
                  [], // Empty inputs array - LLM node should use iterationItem instead
                  retryIterationContext,
                  dependencies
                );
                
                // Check if execution succeeded
                const updatedState = getNodeState(nodeId);
                if (updatedState.status === 'success' && updatedState.result) {
                  results.push(updatedState.result);
                  foundResultsForIteration[i] = true;
                  missingResultsCount--;
                }
              } catch (error) {
                console.error(`[InputIteration ${inputNodeId}] Failed to retry execution for node ${nodeId}:`, error);
              }
              */
            } else {
              console.warn(`[InputIteration ${inputNodeId}] Missing result for node ${nodeId} from iteration ${i}.`, {
                state: iterationState?.status,
                execId: iterationState?.executionId,
                hasResult: !!iterationState?.result
              });
            }
          }
        }
        
        // Log information about the results we found
        console.log(`[InputIteration ${inputNodeId}] Results collection status for node ${nodeId}:`, {
          totalIterations: items.length,
          foundResults: foundResultsForIteration.filter(Boolean).length,
          missingCount: items.length - foundResultsForIteration.filter(Boolean).length,
          retryCount,
          nodeType: inputNode.type  // Add node type for better debugging
        });
        
        // Store the results we found for this node
        if (results.length > 0) {
          console.log(`[InputIteration ${inputNodeId}] Collected ${results.length} results for node ${nodeId}`);
          iterationResultsByNodeId.set(nodeId, results);
        }
      }
      
      // Calculate our collection progress
      const expectedTotalResults = mergerInputNodes.length * items.length;
      const actualTotalResults = Array.from(iterationResultsByNodeId.entries())
        .reduce((sum, [_, arr]) => sum + (arr?.length || 0), 0);
      
      console.log(`[InputIteration ${inputNodeId}] Collection progress (retry ${retryCount}):`, {
        expectedTotalResults,
        actualTotalResults,
        percentComplete: Math.round((actualTotalResults / expectedTotalResults) * 100) + '%',
        missingResultsCount
      });
      
      // If we have all the expected results, we can proceed
      if (missingResultsCount === 0 || actualTotalResults >= expectedTotalResults) {
        allResultsCollected = true;
        console.log(`[InputIteration ${inputNodeId}] Successfully collected all expected results after ${retryCount} retries.`);
        break;
      }
      
      // If we still need more results, retry with exponential backoff
      retryCount++;
      
      if (retryCount < maxRetries) {
        const waitTime = 200 * Math.pow(2, retryCount); // Exponential backoff
        console.log(`[InputIteration ${inputNodeId}] Waiting ${waitTime}ms before retry ${retryCount+1}/${maxRetries}...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    if (!allResultsCollected) {
      console.warn(`[InputIteration ${inputNodeId}] Could not collect all expected results after ${maxRetries} retries. Proceeding with partial results.`);
    }
    
    // Create a merger-specific context
    const mergerSpecificContext: ExecutionContext = {
      executionId: mergerExecutionId,
      triggerNodeId: inputNodeId,
      isSubExecution: true,
      iterationTracking: {
        inputNodeId,
        originalExecutionId,
        inputLabel: inputNode.data.label || `Input ${inputNodeId}`,
        executionMode: 'batch',
        currentIndex: items.length,
        totalItems: items.length
      }
    };
    
    // Log a summary of what we collected
    const totalCollectedResults = Array.from(iterationResultsByNodeId.entries())
      .reduce((sum, [_, arr]) => sum + (arr?.length || 0), 0);
    
    console.log(`[InputIteration ${inputNodeId}] Executing mergers with collected results:`, {
      executionId: mergerSpecificContext.executionId,
      totalStoredResults: totalCollectedResults,
      nodesWithResults: iterationResultsByNodeId.size,
      allInputNodes: mergerInputNodes.length
    });
    
    // Create the subgraph for executing the merger nodes
    const mergerSubgraph = {
      nodes: [...mergerNodes, ...mergerInputNodes],
      edges: edgesInSubgraph.filter(e => 
        mergerNodes.some(m => m.id === e.target) && 
        mergerInputNodes.some(n => n.id === e.source)
      )
    };
    
    console.log(`[InputIteration ${inputNodeId}] Merger subgraph has ${mergerSubgraph.nodes.length} nodes and ${mergerSubgraph.edges.length} edges`);
    
    // Set the aggregated state for each input node
    for (const [nodeId, nodeResults] of iterationResultsByNodeId.entries()) {
      if (nodeResults.length > 0) {
        console.log(`[InputIteration ${inputNodeId}] Setting aggregated state for node ${nodeId} with ${nodeResults.length} results`);
        
        setNodeState(nodeId, {
          status: 'success',
          executionId: mergerExecutionId,
          result: {
            value: nodeResults,
            _meta: {
              source: 'aggregated-results',
              mode: 'batch',
              executionId: mergerExecutionId,
              originalExecutionId,
              itemCount: nodeResults.length,
              inputNodeId
            }
          }
        });
      }
    }
    
    // Execute the merger nodes
    try {
      const mergerResults = await executeSubgraph(
        mergerNodes.map(n => n.id),
        mergerSubgraph.nodes,
        mergerSubgraph.edges,
        mergerSpecificContext,
        dependencies
      );
      
      console.log(`[InputIteration ${inputNodeId}] Merger execution complete:`, 
        Object.keys(mergerResults).map(id => {
          const result = mergerResults[id];
          return {
            nodeId: id,
            resultType: typeof result,
            isArray: Array.isArray(result),
            itemCount: Array.isArray(result) ? result.length : null
          };
        }));
      
      // Validate the results
      for (const mergerNode of mergerNodes) {
        const mergerState = getNodeState(mergerNode.id);
        
        if (mergerState.status !== 'success' || !mergerState.result) {
          console.warn(`[InputIteration ${inputNodeId}] Merger node ${mergerNode.id} has no result or failed`);
        } else if (Array.isArray(mergerState.result)) {
          console.log(`[InputIteration ${inputNodeId}] Merger node ${mergerNode.id} succeeded with ${mergerState.result.length} results`);
        } else {
          console.log(`[InputIteration ${inputNodeId}] Merger node ${mergerNode.id} succeeded with result of type ${typeof mergerState.result}`);
        }
      }
    } catch (error) {
      console.error(`[InputIteration ${inputNodeId}] Error executing merger nodes:`, error);
    }
  }
  
  // Update input node state with the final results (including merger results if any)
  setNodeState(inputNodeId, {
    status: 'success',
    result: allResults.flat(), // Flatten the results array
    executionId: originalExecutionId,
    iterationStatus: {
      currentIndex: items.length,
      totalItems: items.length,
      completed: true
    }
  });
  
  // Update node data for UI using Zustand
  updateNode(inputNodeId, (node) => ({
    ...node,
    data: {
      ...node.data,
      iterationStatus: {
        currentIndex: items.length,
        totalItems: items.length,
        completed: true
      }
    }
  }));
  
  console.log(`[InputIteration ${inputNodeId}] Iteration complete. Collected ${allResults.length} results.`);
  
  return allResults.flat();
}

/**
 * Determines if a node type requires special execution handling
 */
export function requiresSpecialExecution(nodeType: NodeType): boolean {
  // Group nodes and Input nodes with iterateEachRow may require special handling
  return nodeType === 'group' || nodeType === 'input';
}

/**
 * Gets upstream node results from the execution context
 */
export function getUpstreamResults(
  nodeId: string,
  nodes: Node<NodeData>[],
  edges: Edge[],
  nodeResults: Record<string, any>
): any[] {
  // Find incoming edges to this node
  const incomingEdges = edges.filter(e => e.target === nodeId);
  
  // Get results from source nodes
  return incomingEdges.map(edge => {
    const sourceId = edge.source;
    return nodeResults[sourceId];
  }).filter(result => result !== undefined);
}

// Fix the possible undefined access for node.type
const getNodeExecutionKey = (node: Node<NodeData>, context: ExecutionContext) => {
  const nodeType = node.type || 'unknown';
  return context.iterationTracking?.currentIndex !== undefined ?
    `:item-${context.iterationTracking.currentIndex}:${nodeType.substring(0, 3)}-${node.id.substring(0, 8)}` :
    `:${nodeType.substring(0, 3)}-${node.id.substring(0, 8)}`;
};

// Creates a standardized log prefix for execution logging
export function makeExecutionLogPrefix(
  node: Node<NodeData>,
  context: ExecutionContext,
  options?: {
    tag?: string;      // Optional tag to include (e.g., "DEBUG", "ERROR")
    includeExecId?: boolean; // Whether to include execution ID
    groupId?: string;  // Group ID if node is part of a group
  }
): string {
  const nodeType = node.type || 'unknown';
  const nodeId = node.id;
  const shortId = nodeId.substring(0, 8);
  const tag = options?.tag ? `[${options.tag}]` : '';
  const groupInfo = options?.groupId ? `[Group ${options.groupId.substring(0, 6)}]` : '';
  const execInfo = options?.includeExecId ? `[Exec ${context.executionId?.substring(0, 8) || 'unknown'}]` : '';
  
  // Create iteration context info
  if (context.iterationTracking) {
    const { currentIndex, totalItems, inputNodeId } = context.iterationTracking;
    return `[${nodeType} ${shortId}]${tag}${groupInfo}${execInfo} [Iteration ${currentIndex + 1}/${totalItems}]`;
  }
  
  // For non-iteration context
  return `[${nodeType} ${shortId}]${tag}${groupInfo}${execInfo}`;
}

// Export the normalizeExecutionContext function from executor dispatcher
export { normalizeExecutionContext } from '../executors/executorDispatcher';