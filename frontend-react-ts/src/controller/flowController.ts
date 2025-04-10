import { Edge, Node } from 'reactflow';
import { NodeData } from '../types/nodes';
import { ExecutionContext, NodeState } from '../types/execution';
import { getRootNodesFromSubset } from '../utils/executionUtils';
import { 
  dispatchNodeExecution as dispatchToExecutor, 
  makeExecutionLogPrefix,
  normalizeExecutionContext 
} from './executionDispatcher';

export interface FlowControllerDependencies {
  getNodes: () => Node<NodeData>[];
  getEdges: () => Edge[];
  getNodeState: (nodeId: string) => NodeState;
  setNodeState: (nodeId: string, state: Partial<NodeState>) => void;
  resetNodeStates: (nodeIds?: string[]) => void;
  getDownstreamNodes: (nodeId: string, includeStartNode: boolean, subsetNodeIds?: Set<string>) => string[];
  getNodesInGroup: (groupId: string) => Node<NodeData>[];
  setIsExecuting: (isExecuting: boolean) => void;
  setCurrentExecutionId: (executionId?: string) => void;
  setIterationContext: (context: { item?: any; index?: number; total?: number }) => void;
}

/**
 * Executes a subgraph of nodes starting from specified root nodes.
 * Handles dependency management and parallel execution.
 */
export async function executeSubgraph(
  startNodes: string[],
  nodesInSubgraph: Node<NodeData>[],
  edgesInSubgraph: Edge[],
  executionContext: ExecutionContext,
  dependencies: FlowControllerDependencies
): Promise<Record<string, any>> { // Returns map of { nodeId: result }
  const { getNodeState, setNodeState } = dependencies;
  const nodeResults: Record<string, any> = {};
  const nodeDependencies: Record<string, string[]> = {};
  const nodeExecutionStatus: Record<string, 'pending' | 'running' | 'completed' | 'failed' | 'skipped'> = {};
  const queue: string[] = []; // Nodes ready to execute

  // CRITICAL FIX: Normalize the execution context to ensure consistent structure
  // Use a placeholder nodeId since we're at the subgraph level
  const normalizedContext = normalizeExecutionContext(
    executionContext, 
    'subgraph-executor', 
    `[Subgraph ${executionContext.executionId.substring(0, 8)}]`
  );
  
  // Create a log prefix for subgraph-level logs
  const subgraphLogPrefix = `[Subgraph ${normalizedContext.executionId.substring(0, 8)}]${normalizedContext.iterationTracking ? ` [Iteration ${normalizedContext.iterationTracking.currentIndex + 1}/${normalizedContext.iterationTracking.totalItems}]` : ''}`;

  // Determine if we're in foreach mode by checking for iterationItem in context
  const isForEachMode = normalizedContext.iterationItem !== undefined;
  console.log(`${subgraphLogPrefix} Execution mode: ${isForEachMode ? 'foreach (sequential)' : 'batch (parallel)'}`);
  console.log(`${subgraphLogPrefix} Normalized context:`, {
    hasIterationItem: normalizedContext.hasIterationItem,
    iterationItemType: normalizedContext.iterationItem ? typeof normalizedContext.iterationItem : 'undefined',
    executeMode: normalizedContext.iterationTracking?.executionMode || 'standard'
  });
  
  // Initialize status and dependencies for nodes within the subgraph
  nodesInSubgraph.forEach(node => {
    nodeExecutionStatus[node.id] = 'pending';
    // Find direct parents *within this specific subgraph*
    nodeDependencies[node.id] = edgesInSubgraph
      .filter(edge => edge.target === node.id)
      .map(edge => edge.source);
  });

  // Add initial start nodes to queue only if they have no dependencies *within this subgraph*
  startNodes.forEach(nodeId => {
    if (nodesInSubgraph.find(n => n.id === nodeId)) { // Ensure start node is part of subgraph
      if (!nodeDependencies[nodeId] || nodeDependencies[nodeId].length === 0) {
        if (!queue.includes(nodeId)) {
          queue.push(nodeId);
          
          // Get node for logging
          const node = nodesInSubgraph.find(n => n.id === nodeId)!;
          const logPrefix = makeExecutionLogPrefix(node, normalizedContext);
          console.log(`${logPrefix} Adding to initial queue.`);
        }
      } else {
        // Get node for logging
        const node = nodesInSubgraph.find(n => n.id === nodeId)!;
        const logPrefix = makeExecutionLogPrefix(node, normalizedContext);
        console.log(`${logPrefix} Deferred (has internal dependencies).`);
      }
    }
  });

  console.log(`${subgraphLogPrefix} Initial execution queue:`, [...queue]);
  console.log(`${subgraphLogPrefix} Dependencies:`, nodeDependencies);

  const executingPromises: Record<string, Promise<any>> = {};

  // Function to check if all dependencies of a node are met
  const areDependenciesMet = (nodeId: string): boolean => {
    const deps = nodeDependencies[nodeId];
    if (!deps || deps.length === 0) return true; // No dependencies
    
    // Get the node itself for enhanced logging
    const thisNode = nodesInSubgraph.find(n => n.id === nodeId);
    const nodeLogPrefix = thisNode ? `[areDependenciesMet ${normalizedContext.executionId}] ${thisNode.type || 'unknown'} node ${nodeId}:` : `[areDependenciesMet ${normalizedContext.executionId}] node ${nodeId}:`;
    
    // CRITICAL FIX: Special handling for LLM nodes when using iterationItem in foreach mode
    const isInForeachMode = normalizedContext.iterationTracking?.executionMode === 'foreach';
    const isLlmNode = thisNode?.type === 'llm';
    
    if (isInForeachMode && isLlmNode && normalizedContext.iterationItem) {
      console.log(`${nodeLogPrefix} FOREACH MODE CHECK for LLM node with iterationItem:`, {
        hasIterationItem: !!normalizedContext.iterationItem,
        iterationItemType: typeof normalizedContext.iterationItem,
        iterationHasValue: typeof normalizedContext.iterationItem === 'object' && 
                          normalizedContext.iterationItem !== null && 
                          'value' in normalizedContext.iterationItem,
        iterationValue: typeof normalizedContext.iterationItem === 'object' && 
                       normalizedContext.iterationItem !== null && 
                       'value' in normalizedContext.iterationItem ?
                       (typeof normalizedContext.iterationItem.value === 'object' ? 
                         JSON.stringify(normalizedContext.iterationItem.value).substring(0, 100) : 
                         String(normalizedContext.iterationItem.value)) : 'undefined',
        deps: deps.length,
        execId: normalizedContext.executionId,
        travelingFromInput: !!normalizedContext.iterationTracking?.inputNodeId
      });
      
      // In foreach mode with iterationItem, we can be more lenient with input node dependencies
      // Check if any dependency is an input node and is part of the current iteration
      const hasDependencyOnInputNode = deps.some(depId => {
        const inputDepNode = nodesInSubgraph.find(n => n.id === depId);
        if (inputDepNode?.type === 'input') {
          const depState = getNodeState(depId);
          
          // Check if the input node state matches the current iteration and is successful
          const matchesCurrentExecution = depState.executionId === normalizedContext.executionId;
          const hasSuccessState = depState.status === 'success';
          const hasResult = !!depState.result;
          
          console.log(`${nodeLogPrefix} FOREACH INPUT DEP CHECK for input node ${depId}:`, {
            matchesCurrentExecution,
            hasSuccessState,
            hasResult,
            executionId: depState.executionId,
            currentExecutionId: normalizedContext.executionId
          });
          
          // For input nodes in foreach mode, consider the dependency met if it has a success state 
          // and execution ID matches the current iteration
          if (matchesCurrentExecution && hasSuccessState && hasResult) {
            console.log(`${nodeLogPrefix} FOREACH INPUT DEP MET for input node ${depId}`);
            return true;
          }
        }
        return false;
      });
      
      // If we're in foreach mode with iterationItem and have a satisfied input dependency, 
      // we can consider all dependencies met
      if (hasDependencyOnInputNode) {
        console.log(`${nodeLogPrefix} FOREACH MODE - Input dependency satisfied through iterationItem. Considering all dependencies met.`);
        return true;
      }
    }

    return deps.every(depId => {
      // Check if dependency exists in subgraph and is completed
      const depNodeExists = nodesInSubgraph.some(n => n.id === depId);
      const depCompleted = nodeExecutionStatus[depId] === 'completed';
      
      // Get dependency node info for better logging
      const depNodeInfo = nodesInSubgraph.find(n => n.id === depId);
      const depType = depNodeInfo?.type || 'unknown';
      
      // CRITICAL FIX: Check if dependency is an input node in foreach mode with state in store
      const isInputDep = depType === 'input';
      const depState = isInputDep ? getNodeState(depId) : null;
      const depHasSuccessState = isInputDep && depState?.status === 'success';
      const depHasResult = isInputDep && !!depState?.result;
      const depMatchesExecution = isInputDep && depState?.executionId === normalizedContext.executionId;
      
      // Enhanced logging for dependency checks
      if (isLlmNode && isInputDep) {
        console.log(`${nodeLogPrefix} Checking input dependency ${depId} (${depType}):`, {
          exists: depNodeExists,
          completed: depCompleted,
          hasSuccessState: depHasSuccessState,
          hasResult: depHasResult,
          matchesExecution: depMatchesExecution,
          executionMode: isInForeachMode ? 'foreach' : 'batch'
        });
      }
      
      // CRITICAL FIX: For input nodes in foreach mode, check node state directly instead of just using completion status
      // This helps in cases where the node may not be marked as completed in the tracking, but has a success state
      if (isInputDep && isInForeachMode && depHasSuccessState && depHasResult && depMatchesExecution) {
        console.log(`${nodeLogPrefix} Input node ${depId} dependency is met through node state success.`);
        return true;
      }

      if (!depNodeExists || !depCompleted) {
        if (isLlmNode) {
          console.log(`${nodeLogPrefix} Basic dependency ${depId} (${depType}) not met. Exists: ${depNodeExists}, Completed: ${depCompleted}`);
        }
        return false; // Basic dependency not met
      }

      // --- Conditional Check ---
      const depNode = nodesInSubgraph.find(n => n.id === depId);
      if (depNode?.type === 'conditional') {
        const depState = getNodeState(depId);

        // Check if state exists and has the conditional properties
        const hasConditionalProps = depState && 'activeOutputHandle' in depState;

        if (hasConditionalProps && (depState as any).activeOutputHandle) {
           const edge = edgesInSubgraph.find(e => e.source === depId && e.target === nodeId);
           if (!edge) {
               console.warn(`[Subgraph ${normalizedContext.executionId}] Edge not found between conditional ${depId} and target ${nodeId}. Assuming dependency not met.`);
               return false; // Edge must exist
           }
           // Crucially, check if the edge's sourceHandle matches the activeOutputHandle
           const handlesMatch = edge.sourceHandle === (depState as any).activeOutputHandle;
           if (!handlesMatch) {
               console.log(`[areDependenciesMet ${normalizedContext.executionId}] Node: ${nodeId}, Dep: ${depId}(Conditional), Result: FALSE (Handle mismatch)`);
               setNodeState(nodeId, { status: 'skipped', executionId: normalizedContext.executionId }); // Set node to skipped
               return false; // This path is inactive
           }
           console.log(`[Subgraph ${normalizedContext.executionId}] Dependency ${depId} (Conditional) met via active handle '${(depState as any).activeOutputHandle}' for ${nodeId}.`);
        } else {
           if (depState?.status === 'success') {
                console.warn(`[areDependenciesMet ${normalizedContext.executionId}] Node: ${nodeId}, Dep: ${depId}(Conditional), Result: FALSE (Completed but missing activeOutputHandle). State:`, depState );
           } else {
                console.log(`[areDependenciesMet ${normalizedContext.executionId}] Node: ${nodeId}, Dep: ${depId}(Conditional), Result: FALSE (Not completed successfully - Status: ${depState?.status})`);
           }
           setNodeState(nodeId, { status: 'skipped', executionId: normalizedContext.executionId }); // Set node to skipped
           return false; // Treat as unmet if state is inconsistent or node didn't succeed
        }
      }
      // --- End Conditional Check ---

      // If it's not a conditional node OR the conditional check passed, the dependency is met
      return true;
    });
  };

  // Function to execute a single node - used for both batch and foreach mode
  const executeNode = async (nodeId: string): Promise<void> => {
    if (nodeExecutionStatus[nodeId] !== 'pending') return; // Skip if already running/processed

    nodeExecutionStatus[nodeId] = 'running';
    
    // Get the node to be executed for logging
    const node = nodesInSubgraph.find(n => n.id === nodeId)!;
    const logPrefix = makeExecutionLogPrefix(node, normalizedContext);
    
    console.log(`${logPrefix} Dispatching execution...`);
    console.log(`${logPrefix} Current context:`, {
      executionId: normalizedContext.executionId,
      hasIterationItem: normalizedContext.hasIterationItem,
      iterationItem: normalizedContext.iterationItem
    });

    // Get the node's type for logging
    const nodeType = node.type || 'unknown';

    // Collect inputs for this node from completed dependencies
    const nodeInputs = edgesInSubgraph
      .filter(edge => edge.target === nodeId)
      .map(edge => {
        const sourceId = edge.source;
        return nodeResults[sourceId];
      })
      .filter(result => result !== undefined);

    console.log(`${logPrefix} Inputs:`, nodeInputs);

    try {
      // Call the central dispatcher with the node ID and collected inputs
      console.log(`${logPrefix} Dispatching with execution context:`, {
        hasIterationItem: normalizedContext.hasIterationItem,
        iterationItem: normalizedContext.iterationItem,
        contextMode: normalizedContext.iterationTracking?.executionMode || 'standard',
        inputsCount: nodeInputs.length,
        inputsPreview: nodeInputs.map(input => ({
          hasValue: input && typeof input === 'object' && 'value' in input,
          hasMetadata: input && typeof input === 'object' && '_meta' in input,
          metaMode: input && typeof input === 'object' && '_meta' in input ? input._meta.mode : 'none',
          valuePreview: input?.value !== undefined ? 
            (typeof input.value === 'object' ? 
              JSON.stringify(input.value).substring(0, 100) : 
              String(input.value).substring(0, 100)) : 'undefined'
        }))
      });

      const result = await dispatchToExecutor(
        nodeId,
        nodeInputs,
        normalizedContext,
        dependencies
      );
      
      console.log(`${logPrefix} Completed successfully. Result:`, result);
      nodeResults[nodeId] = result;
      nodeExecutionStatus[nodeId] = 'completed';
      
      // Check and add children to the queue if they are pending and dependencies are met
      const children = edgesInSubgraph
          .filter(edge => edge.source === nodeId)
          .map(edge => edge.target);

      children.forEach(childId => {
          if (nodesInSubgraph.some(n => n.id === childId) && 
              nodeExecutionStatus[childId] === 'pending' &&
              areDependenciesMet(childId) &&
              !queue.includes(childId)) {
              queue.push(childId);
              
              // Get child node for logging
              const childNode = nodesInSubgraph.find(n => n.id === childId)!;
              const childLogPrefix = makeExecutionLogPrefix(childNode, normalizedContext);
              console.log(`${childLogPrefix} Adding to queue after ${nodeId} completed.`);
          }
      });
    } catch (error: any) {
      console.error(`${logPrefix} Execution failed:`, error);
      nodeExecutionStatus[nodeId] = 'failed';
      // Propagate the error to stop the subgraph execution
      throw new Error(`Execution failed at node ${nodeId}: ${error.message || String(error)}`);
    }
  };

  // Main execution loop
  if (isForEachMode) {
    // SEQUENTIAL EXECUTION FOR FOREACH MODE
    console.log(`${subgraphLogPrefix} Using sequential execution for foreach mode with item:`, normalizedContext.iterationItem);
    
    while (queue.length > 0 || Object.values(nodeExecutionStatus).some(s => s === 'running')) {
      // Process one node at a time from the queue
      if (queue.length > 0) {
        const nodeId = queue.shift()!; // Get next node from queue
        console.log(`${subgraphLogPrefix} Processing node ${nodeId} with iterationItem:`, normalizedContext.iterationItem);
        await executeNode(nodeId);
      }
      
      // Find new nodes that might be ready
      const nodesReadyToRun = nodesInSubgraph
        .map(n => n.id)
        .filter(nodeId => nodeExecutionStatus[nodeId] === 'pending' && areDependenciesMet(nodeId) && !queue.includes(nodeId));
        
      // Add newly ready nodes to the queue
      nodesReadyToRun.forEach(nodeId => {
        if (!queue.includes(nodeId)) {
          queue.push(nodeId);
          console.log(`${subgraphLogPrefix} Dependencies met for ${nodeId}, adding to queue.`);
        }
      });
      
      // If no nodes are in queue or running, but we still have pending nodes, check for deadlock
      if (queue.length === 0 && !Object.values(nodeExecutionStatus).some(s => s === 'running')) {
        const pendingNodes = Object.entries(nodeExecutionStatus)
          .filter(([_, s]) => s === 'pending')
          .map(([id]) => id);
          
        if (pendingNodes.length > 0) {
          console.warn(`${subgraphLogPrefix} No nodes processing, but ${pendingNodes.length} pending. Possible deadlock or cycle? Pending:`, pendingNodes);
          throw new Error("Execution deadlock: Could not resolve dependencies.");
        }
      }
    }
  } else {
    // PARALLEL EXECUTION FOR BATCH MODE (Original logic)
    while (Object.values(nodeExecutionStatus).some(s => s === 'pending' || s === 'running')) {
      const nodesReadyToRun = nodesInSubgraph
        .map(n => n.id)
        .filter(nodeId => nodeExecutionStatus[nodeId] === 'pending' && areDependenciesMet(nodeId) && !queue.includes(nodeId));

      // Add newly ready nodes to the queue
      nodesReadyToRun.forEach(nodeId => {
          if (!queue.includes(nodeId)) {
              queue.push(nodeId);
              console.log(`${subgraphLogPrefix} Dependencies met for ${nodeId}, adding to queue.`);
          }
      });

      // Process nodes from the queue
      const nodesToProcess = [...queue]; // Process all currently in queue
      queue.length = 0; // Clear queue for next iteration

      if (nodesToProcess.length === 0 && Object.keys(executingPromises).length === 0) {
          // Nothing ready, nothing running -> execution finished or stalled
          const pendingNodes = Object.entries(nodeExecutionStatus).filter(([_, s]) => s === 'pending').map(([id]) => id);
          if (pendingNodes.length > 0) {
               console.warn(`${subgraphLogPrefix} No nodes processing, but ${pendingNodes.length} pending. Possible deadlock or cycle? Pending:`, pendingNodes, `Statuses:`, nodeExecutionStatus);
               throw new Error("Execution deadlock: Could not resolve dependencies.");
          }
          console.log(`${subgraphLogPrefix} No nodes ready/running and no promises pending. Exiting loop.`);
          break;
      }

      // Execute ready nodes in parallel
      nodesToProcess.forEach(nodeId => {
          if (nodeExecutionStatus[nodeId] !== 'pending') return; // Skip if already running/processed

          nodeExecutionStatus[nodeId] = 'running';
          console.log(`${subgraphLogPrefix} Dispatching execution for node ${nodeId}...`);

          // Get the node's type for logging
          const nodeType = nodesInSubgraph.find(n => n.id === nodeId)?.type || 'unknown';

          // Collect inputs for this node from completed dependencies
          const nodeInputs = edgesInSubgraph
            .filter(edge => edge.target === nodeId)
            .map(edge => {
              const sourceId = edge.source;
              return nodeResults[sourceId];
            })
            .filter(result => result !== undefined);

          console.log(`${subgraphLogPrefix} Node ${nodeId} (${nodeType}) inputs:`, nodeInputs);
          console.log(`${subgraphLogPrefix} Using context for node ${nodeId}:`, {
            executionId: normalizedContext.executionId,
            hasIterationItem: normalizedContext.hasIterationItem,
            iterationItem: normalizedContext.iterationItem
          });

          // Call the central dispatcher with the node ID and collected inputs
          executingPromises[nodeId] = dispatchToExecutor(
            nodeId,
            nodeInputs,
            normalizedContext,
            dependencies
          )
          .then(result => {
              console.log(`${subgraphLogPrefix} Node ${nodeId} (${nodeType}) completed successfully. Result:`, result);
              nodeResults[nodeId] = result;
              nodeExecutionStatus[nodeId] = 'completed';
              delete executingPromises[nodeId]; // Remove completed promise

              // Check and add children to the main check list if they are pending
              const children = edgesInSubgraph
                  .filter(edge => edge.source === nodeId)
                  .map(edge => edge.target);

              children.forEach(childId => {
                  if (nodesInSubgraph.some(n => n.id === childId) && nodeExecutionStatus[childId] === 'pending') {
                      console.log(`${subgraphLogPrefix} Node ${nodeId} finished, child ${childId} is pending.`);
                  }
              });
          })
          .catch(error => {
              console.error(`${subgraphLogPrefix} Execution for node ${nodeId} failed:`, error);
              nodeExecutionStatus[nodeId] = 'failed';
              delete executingPromises[nodeId];
              // Propagate the error to stop the subgraph execution
              throw new Error(`Execution failed at node ${nodeId}: ${error.message || error}`);
          });
      });

      // Wait for at least one promise to resolve or reject before iterating again
      if (Object.keys(executingPromises).length > 0) {
          try {
              await Promise.race(Object.values(executingPromises));
          } catch (error) {
              // Error handled within the individual promise catch blocks,
              // but re-throw to stop subgraph as per the catch block logic
              console.error(`${subgraphLogPrefix} Caught error during Promise.race, stopping subgraph.`);
              throw error; // Stop the entire subgraph execution on first failure
          }
      }
    } // End while loop
  }

  // Final check for any nodes that didn't complete
  const failedNodes = Object.entries(nodeExecutionStatus)
    .filter(([_, status]) => status === 'pending' || status === 'running') // Ignore 'skipped' and 'failed' here
    .map(([nodeId, _]) => nodeId);

  if (failedNodes.length > 0) {
    console.error(`${subgraphLogPrefix} Execution finished with incomplete or failed nodes:`, failedNodes);
    throw new Error(`Subgraph execution failed. Incomplete nodes: ${failedNodes.join(', ')}`);
  }

  console.log(`${subgraphLogPrefix} Execution finished successfully. Results:`, nodeResults);
  return nodeResults; // Return all collected results
}

/**
 * Executes the entire flow starting from a given node.
 */
export async function executeFlow(startNodeId: string, dependencies: FlowControllerDependencies): Promise<void> {
  const { getNodes, getEdges, getDownstreamNodes, resetNodeStates, setIsExecuting, setCurrentExecutionId } = dependencies;

  setIsExecuting(true);
  setCurrentExecutionId(undefined); // Clear previous execution ID display
  console.log(`[ExecuteFlow] Starting from node: ${startNodeId}`);

  const executionId = `exec-${crypto.randomUUID()}`;
  setCurrentExecutionId(executionId); // Set the current execution ID for tracking

  const allNodes = getNodes();
  const allEdges = getEdges();

  // Identify all nodes downstream from the start node (including the start node itself)
  const downstreamNodeIdsSet = new Set(getDownstreamNodes(startNodeId, true, undefined)); // Use Set for efficiency
  const downstreamNodeIds = Array.from(downstreamNodeIdsSet);
  console.log(`[ExecuteFlow ${executionId}] Nodes to execute:`, downstreamNodeIds);

  // Reset states for all potentially affected nodes *before* execution begins
  console.log(`[ExecuteFlow ${executionId}] Resetting states for nodes:`, downstreamNodeIds);
  resetNodeStates(downstreamNodeIds);

  // Create the initial execution context
  const context: ExecutionContext = { executionId, triggerNodeId: startNodeId };
  
  // CRITICAL FIX: Normalize the execution context to ensure consistent structure
  const normalizedContext = normalizeExecutionContext(
    context, 
    startNodeId, 
    `[ExecuteFlow ${executionId}]`
  );
  
  console.log(`[ExecuteFlow ${executionId}] Normalized context:`, {
    hasIterationItem: normalizedContext.hasIterationItem,
    executionId: normalizedContext.executionId
  });

  try {
    // Get the actual subgraph nodes and edges based on downstream IDs
    const nodesInSubGraph = allNodes.filter(n => downstreamNodeIdsSet.has(n.id));
    const edgesInSubGraph = allEdges.filter(e => downstreamNodeIdsSet.has(e.source) && downstreamNodeIdsSet.has(e.target));

    // Find the root nodes *within this specific subgraph*
    const rootNodesInSubGraph = getRootNodesFromSubset(nodesInSubGraph, edgesInSubGraph);

    // Ensure the trigger node is considered a root if it has no incoming edges within the subgraph
    const startNodesForExecution = rootNodesInSubGraph.includes(startNodeId)
        ? rootNodesInSubGraph
        : (!edgesInSubGraph.some(e => e.target === startNodeId) ? [startNodeId, ...rootNodesInSubGraph] : rootNodesInSubGraph);

     const uniqueStartNodes = Array.from(new Set(startNodesForExecution));

    console.log(`[ExecuteFlow ${executionId}] Effective start nodes for subgraph:`, uniqueStartNodes);

    if (uniqueStartNodes.length === 0 && nodesInSubGraph.length > 0) {
        console.warn(`[ExecuteFlow ${executionId}] No root nodes found in the subgraph, but nodes exist. Is start node ${startNodeId} reachable?`);
    }

    await executeSubgraph(uniqueStartNodes, nodesInSubGraph, edgesInSubGraph, normalizedContext, dependencies);
    console.log(`[ExecuteFlow ${executionId}] Execution finished successfully.`);
  } catch (error) {
    console.error(`[ExecuteFlow ${executionId}] Execution failed:`, error);
  } finally {
    console.log(`[ExecuteFlow ${executionId}] Setting isExecuting to false.`);
    setIsExecuting(false); // Mark execution as finished
  }
} 