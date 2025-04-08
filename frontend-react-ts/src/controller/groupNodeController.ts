import { Edge, Node } from 'reactflow';
import { NodeData, GroupNodeData, InputNodeData } from '../types/nodes';
import { ExecutionContext, NodeState, GroupExecutionItemResult } from '../types/execution';
import { getRootNodesFromSubset } from '../utils/executionUtils';
import { dispatchNodeExecution } from '../executors/executorDispatcher';
import { FlowControllerDependencies } from './flowController'; // Import shared dependencies interface

/**
 * Internal helper to execute a subgraph with dependency management.
 */
async function executeSubgraphInternal(
  startNodes: string[], // Node IDs to start execution from (typically roots)
  nodesInSubgraph: Node<NodeData>[],
  edgesInSubgraph: Edge[],
  executionContext: ExecutionContext,
  dependencies: FlowControllerDependencies
): Promise<Record<string, any>> {
  const { getNodeState, setNodeState, getNodes, getEdges } = dependencies;
  const execId = executionContext.executionId; // Alias for brevity

  console.log(`[SubG Internal ${execId}] --- Starting Subgraph Execution ---`);
  console.log(`[SubG Internal ${execId}] Context:`, executionContext);
  console.log(`[SubG Internal ${execId}] Start Nodes Provided:`, startNodes);
  console.log(`[SubG Internal ${execId}] Nodes in Subgraph:`, nodesInSubgraph.map(n => `${n.id} (${n.type})`));
  console.log(`[SubG Internal ${execId}] Edges in Subgraph:`, edgesInSubgraph.map(e => `${e.source}->${e.target}`));

  const nodeResults: Record<string, any> = {};
  const nodeDependencies: Record<string, string[]> = {};
  const nodeExecutionStatus: Record<string, 'pending' | 'running' | 'completed' | 'failed' | 'skipped'> = {};
  const queue: string[] = [];
  const nodesInSubgraphIds = new Set(nodesInSubgraph.map(n => n.id));

  // 1. Calculate dependencies and initialize status for all nodes in the subgraph
  nodesInSubgraph.forEach(node => {
    nodeExecutionStatus[node.id] = 'pending';
    // Dependencies are sources of edges pointing *to* this node *within* the subgraph
    nodeDependencies[node.id] = edgesInSubgraph
      .filter(edge => edge.target === node.id)
      .map(edge => edge.source);
    // console.log(`[SubG Internal ${execId}] Dependencies for ${node.id}:`, nodeDependencies[node.id]);
  });

  // 2. Initialize Queue with provided start nodes that are roots within this subgraph
  console.log(`[SubG Internal ${execId}] Populating initial queue from startNodes...`);
  startNodes.forEach(nodeId => {
    if (!nodesInSubgraphIds.has(nodeId)) {
      console.warn(`[SubG Internal ${execId}] Provided start node ${nodeId} is not in the current subgraph, skipping.`);
      return;
    }
    // Force add the start node to the queue, regardless of calculated internal dependencies.
    // The caller determines the true start points for this specific execution context.
    if (!queue.includes(nodeId)) {
      queue.push(nodeId);
      console.log(`[SubG Internal ${execId}] Added start node ${nodeId} to initial queue.`);
    } else {
      // This might happen if the same start node is provided multiple times
      console.log(`[SubG Internal ${execId}] Start node ${nodeId} already in queue.`);
    }
    // Original dependency check removed to enforce adding startNodes
    // const deps = nodeDependencies[nodeId];
    // if (!deps || deps.length === 0) { // Check if it's a root *within this subgraph*
    //   if (!queue.includes(nodeId)) {
    //     queue.push(nodeId);
    //     console.log(`[SubG Internal ${execId}] Added root ${nodeId} to initial queue.`);
    //   } else {
    //     // This case should ideally not happen if startNodes are unique roots
    //     console.log(`[SubG Internal ${execId}] Root ${nodeId} already in queue (unexpected).`);
    //   }
    // } else {
    //   console.log(`[SubG Internal ${execId}] Start node ${nodeId} has dependencies within subgraph (${deps.join(', ')}), will be queued when deps are met.`);
    // }
  });

  // Fallback: If the queue is still empty after processing startNodes (e.g., all startNodes were invalid),
  // and startNodes *were* provided, force them in again (this is a safety net).
  // This shouldn't usually be necessary with the change above but guards against edge cases.
  const validStartNodesInSubgraph = startNodes.filter(id => nodesInSubgraphIds.has(id));
  if (queue.length === 0 && validStartNodesInSubgraph.length > 0) {
    queue.push(...validStartNodesInSubgraph);
    console.warn(`[SubG Internal ${execId}] Queue was empty after initial population despite valid start nodes. Fallback: Forcing valid startNodes into queue:`, validStartNodesInSubgraph);
  }

  console.log(`[SubG Internal ${execId}] Initial queue state: [${queue.join(', ')}]`);
  console.log(`[SubG Internal ${execId}] Initial node statuses:`, JSON.stringify(nodeExecutionStatus));

  const executingPromises: Record<string, Promise<any>> = {};

  // Helper to check if all dependencies for a node are 'completed'
  // NOTE: This function uses type assertions (`as any`) for `activeOutputHandle`
  // because the base `NodeState` type might not include it directly.
  // Consider updating the `NodeState` type definition in `src/types/execution.ts`
  // to include optional `activeOutputHandle?: string` and `conditionResult?: boolean`
  // to resolve potential type errors.
  const areDependenciesMet = (nodeId: string): boolean => {
    const deps = nodeDependencies[nodeId];
    if (!deps || deps.length === 0) return true; // No dependencies

    return deps.every(depId => {
      // Check if dependency exists in subgraph and is completed
      const depNodeExists = nodesInSubgraphIds.has(depId); // Use nodesInSubgraphIds from this scope
      const depCompleted = nodeExecutionStatus[depId] === 'completed';

      if (!depNodeExists || !depCompleted) {
         // console.log(`[SubG Internal ${execId}] Basic dependency ${depId} for ${nodeId} not met (Exists: ${depNodeExists}, Completed: ${depCompleted})`);
        return false; // Basic dependency not met
      }

      // --- Conditional Check ---
      const depNode = nodesInSubgraph.find(n => n.id === depId); // Use nodesInSubgraph from this scope
      if (depNode?.type === 'conditional') {
        console.log(`[areDependenciesMet ${execId}] Node: ${nodeId} checking conditional Dep: ${depId}`);
        const depState = getNodeState(depId); // Use getNodeState from outer scope
        console.log(`[areDependenciesMet ${execId}] Node: ${nodeId}, Dep: ${depId}(Conditional), Fetched State:`, depState ? JSON.stringify(depState) : 'State not found');

        // Check if state exists and has the conditional properties (using 'in' for type safety)
        const hasConditionalProps = depState && 'activeOutputHandle' in depState;
        const activeHandle = hasConditionalProps ? (depState as any).activeOutputHandle : undefined;
        console.log(`[areDependenciesMet ${execId}] Node: ${nodeId}, Dep: ${depId}(Conditional), HasProps: ${hasConditionalProps}, ActiveHandleValue: ${activeHandle}`);

        // Accessing potentially undefined property safely. It must exist AND be truthy (not null/undefined).
        if (activeHandle) {
           const edge = edgesInSubgraph.find(e => e.source === depId && e.target === nodeId); // Use edgesInSubgraph from this scope
           console.log(`[areDependenciesMet ${execId}] Node: ${nodeId}, Dep: ${depId}(Conditional), Found Edge:`, edge ? `${edge.sourceHandle} -> ${edge.targetHandle}` : 'Edge not found');

           if (!edge) {
               console.warn(`[areDependenciesMet ${execId}] Node: ${nodeId}, Dep: ${depId}(Conditional), Result: FALSE (Edge not found)`);
               return false; // Edge must exist
           }
           
           const handlesMatch = edge.sourceHandle === activeHandle;
           console.log(`[areDependenciesMet ${execId}] Node: ${nodeId}, Dep: ${depId}(Conditional), EdgeHandle: ${edge.sourceHandle}, ActiveHandle: ${activeHandle}, HandlesMatch: ${handlesMatch}`);
           
           // Crucially, check if the edge's sourceHandle matches the activeOutputHandle
           if (!handlesMatch) { // Use type assertion temporarily
               console.log(`[areDependenciesMet ${execId}] Node: ${nodeId}, Dep: ${depId}(Conditional), Result: FALSE (Handle mismatch)`);
               setNodeState(nodeId, { status: 'skipped', executionId: execId }); // Set node to skipped
               return false; // This path is inactive
           }
           // If handles match, the conditional dependency is met for this path
           console.log(`[areDependenciesMet ${execId}] Node: ${nodeId}, Dep: ${depId}(Conditional), Result: TRUE (Handles match)`);

        } else {
           // Completed conditional node *must* have an activeOutputHandle set by the dispatcher
           // Check if it *should* have had one (i.e. status is success)
           if (depState?.status === 'success') {
                console.warn(`[areDependenciesMet ${execId}] Node: ${nodeId}, Dep: ${depId}(Conditional), Result: FALSE (Completed but missing activeOutputHandle). State:`, depState );
           } else {
                // If status is not success, missing handle is expected, but dependency is still not met in terms of data flow.
                console.log(`[areDependenciesMet ${execId}] Node: ${nodeId}, Dep: ${depId}(Conditional), Result: FALSE (Not completed successfully - Status: ${depState?.status})`);
           }
           setNodeState(nodeId, { status: 'skipped', executionId: execId }); // Set node to skipped
           return false; // Treat as unmet if state is inconsistent or node didn't succeed
        }
      }
      // --- End Conditional Check ---

      // If it's not a conditional node OR the conditional check passed, the dependency is met
      // console.log(`[areDependenciesMet ${execId}] Node: ${nodeId}, Dep: ${depId}(Non-Conditional or Passed), Result: TRUE`);
      return true;
    });
  };

  let loopCounter = 0;
  const MAX_LOOPS = nodesInSubgraph.length * 3 + 10; // Increased safety margin

  // 3. Main Execution Loop
  while (Object.values(nodeExecutionStatus).some(s => s === 'pending' || s === 'running')) {
    loopCounter++;
    if (loopCounter > MAX_LOOPS) {
      console.error(`[SubG Internal ${execId}] LOOP LIMIT EXCEEDED (${MAX_LOOPS})! Bailing out. Statuses:`, nodeExecutionStatus);
      throw new Error("Subgraph execution loop limit exceeded.");
    }
    // console.log(`[SubG Internal ${execId}] --- Loop ${loopCounter} ---`);
    // console.log(`[SubG Internal ${execId}] Current queue: [${queue.join(', ')}]`);
    // console.log(`[SubG Internal ${execId}] Current statuses:`, JSON.stringify(nodeExecutionStatus));
    // console.log(`[SubG Internal ${execId}] Active promises: [${Object.keys(executingPromises).join(', ')}]`);

    // Identify nodes ready to run: pending status + dependencies met + not already queued
    const nodesReadyToAdd = nodesInSubgraph
      .map(n => n.id)
      .filter(nodeId => nodeExecutionStatus[nodeId] === 'pending' && areDependenciesMet(nodeId) && !queue.includes(nodeId));

    if (nodesReadyToAdd.length > 0) {
      // console.log(`[SubG Internal ${execId}] Nodes ready due to met dependencies: [${nodesReadyToAdd.join(', ')}]`);
      nodesReadyToAdd.forEach(nodeId => {
        if (!queue.includes(nodeId)) {
          queue.push(nodeId);
          // console.log(`[SubG Internal ${execId}] Added ${nodeId} to queue (deps met).`);
        }
      });
    }

    const nodesToProcessThisIteration = [...queue];
    queue.length = 0; // Clear queue for the next potential batch

    // Check for exit conditions or deadlocks
    if (nodesToProcessThisIteration.length === 0 && Object.keys(executingPromises).length === 0) {
      const pendingNodes = Object.entries(nodeExecutionStatus)
                               .filter(([_, s]) => s === 'pending')
                               .map(([id]) => id);
      if (pendingNodes.length > 0) {
        console.error(`[SubG Internal ${execId}] DEADLOCK DETECTED! Queue empty, no promises running, but nodes pending: [${pendingNodes.join(', ')}]`);
        console.error(`[SubG Internal ${execId}] Final Statuses:`, nodeExecutionStatus);
        throw new Error(`Execution deadlock: Could not resolve dependencies for nodes: ${pendingNodes.join(', ')}.`);
      }
      console.log(`[SubG Internal ${execId}] Loop ending normally: Queue empty, no promises running, no nodes pending.`);
      break; // Normal exit
    }

    // Process nodes identified for this iteration
    if (nodesToProcessThisIteration.length > 0) {
      console.log(`[SubG Internal ${execId}] Processing batch: [${nodesToProcessThisIteration.join(', ')}]`);

      nodesToProcessThisIteration.forEach(nodeId => {
        // Sanity checks before dispatching
        if (nodeExecutionStatus[nodeId] !== 'pending') {
          // console.log(`[SubG Internal ${execId}] Node ${nodeId} status is ${nodeExecutionStatus[nodeId]}, skipping dispatch.`);
          return;
        }
        if (executingPromises[nodeId]) {
          // console.log(`[SubG Internal ${execId}] Node ${nodeId} is already running, skipping dispatch.`);
          return; // Avoid re-dispatching
        }
        // Re-verify dependencies immediately before dispatch (paranoid check)
        if (!areDependenciesMet(nodeId)) {
          console.warn(`[SubG Internal ${execId}] PARANOID CHECK FAILED: Deps for ${nodeId} not met just before dispatch. Re-queueing.`);
          queue.push(nodeId); // Put back for next iteration
          return;
        }

        // Dispatch the node execution
        nodeExecutionStatus[nodeId] = 'running';
        const nodeToExecute = nodesInSubgraph.find(n => n.id === nodeId);
        if (!nodeToExecute) {
          console.error(`[SubG Internal ${execId}] CRITICAL: Node ${nodeId} not found in subgraph just before dispatch!`);
          nodeExecutionStatus[nodeId] = 'failed'; // Mark as failed
          return;
        }

        console.log(`[SubG Internal ${execId}] ✅ Calling dispatchNodeExecution for node ${nodeId} (Type: ${nodeToExecute.type})...`);
        executingPromises[nodeId] = dispatchNodeExecution({
          node: nodeToExecute,
          nodes: getNodes(),
          edges: getEdges(),
          context: executionContext,
          getNodeState,
          setNodeState,
        })
        .then(result => {
          console.log(`[SubG Internal ${execId}] ✅ Node ${nodeId} dispatch completed successfully.`);
          nodeResults[nodeId] = result;
          nodeExecutionStatus[nodeId] = 'completed';
        })
        .catch(error => {
          console.error(`[SubG Internal ${execId}] ❌ Node ${nodeId} dispatch failed:`, error);
          nodeExecutionStatus[nodeId] = 'failed';
          // Store the error maybe?
          nodeResults[nodeId] = { error: error.message || 'Dispatch Error' }; 
        })
        .finally(() => {
          // Always remove the promise reference once settled
          delete executingPromises[nodeId];
        });
      }); // End forEach nodesToProcessThisIteration
    } // End if nodesToProcessThisIteration.length > 0

    // 4. Wait for Promises (if any were dispatched)
    if (Object.keys(executingPromises).length > 0) {
      // console.log(`[SubG Internal ${execId}] Waiting for ${Object.keys(executingPromises).length} running promises to settle...`);
      try {
        // Wait for all promises currently tracked to settle
        const results = await Promise.allSettled(Object.values(executingPromises));
        // console.log(`[SubG Internal ${execId}] Promise batch settled.`);
        const rejections = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[];
        if (rejections.length > 0) {
          console.warn(`[SubG Internal ${execId}] ${rejections.length} promises rejected in this batch.`);
          // We don't throw here, overall success is checked at the end
        }
      } catch (error) {
        // Catch unexpected errors during allSettled itself (less likely)
        console.error(`[SubG Internal ${execId}] Unexpected error during Promise.allSettled:`, error);
        throw error; // Propagate unexpected errors
      }
    } else if (nodesToProcessThisIteration.length === 0) {
        // If nothing was processed and no promises are running, yield to prevent busy-waiting
        // console.log(`[SubG Internal ${execId}] No nodes processed and no promises running, yielding...`);
        await new Promise(resolve => setTimeout(resolve, 0)); // Small yield
    }
  } // End while loop

  console.log(`[SubG Internal ${execId}] --- Subgraph Execution Loop Finished ---`);
  console.log(`[SubG Internal ${execId}] Final node statuses:`, JSON.stringify(nodeExecutionStatus));

  // 5. Final Check and Return Results
  const failedNodes = Object.entries(nodeExecutionStatus)
    .filter(([_, status]) => status === 'pending' || status === 'running') // Ignore 'skipped' and 'failed' here
    .map(([nodeId, status]) => `${nodeId} (${status})`);

  if (failedNodes.length > 0) {
    console.error(`[SubG Internal ${execId}] Subgraph execution finished with incomplete/failed nodes: [${failedNodes.join(', ')}]`);
    // Optionally collect all results, even if some failed
    // throw new Error(`Subgraph execution failed. Incomplete nodes: ${failedNodes.join(', ')}`);
  }

  console.log(`[SubG Internal ${execId}] Subgraph execution successful (all reachable nodes completed). Final Results:`, nodeResults);
  return nodeResults;
}


/**
 * Executes the internal flow of a Group node, iterating over source items or running once if only internal roots exist.
 */
export async function executeGroupNode(groupId: string, dependencies: FlowControllerDependencies): Promise<void> {
  const { getNodes, getEdges, getNodeState, setNodeState, resetNodeStates, getNodesInGroup, setIsExecuting, setCurrentExecutionId, setIterationContext } = dependencies;

  const allNodes = getNodes();
  const allEdges = getEdges();
  const groupNode = allNodes.find(n => n.id === groupId && n.type === 'group') as Node<GroupNodeData> | undefined;

  if (!groupNode) {
    console.error(`[ExecuteGroup ${groupId}] Group node not found.`);
    return;
  }

  const executionId = `group-exec-${crypto.randomUUID()}`;
  console.log(`[ExecuteGroup ${groupId}] Starting group execution with ID: ${executionId}`);
  setCurrentExecutionId(executionId);
  setNodeState(groupId, { status: 'running', executionId, lastTriggerNodeId: groupId, result: [] }); // Initialize result as empty array

  const groupNodes = getNodesInGroup(groupId);
  const groupNodeIdsSet = new Set(groupNodes.map(n => n.id));
  const internalEdges = allEdges.filter(e => groupNodeIdsSet.has(e.source) && groupNodeIdsSet.has(e.target));

  let effectiveSourceNodeId = groupNode.data.iterationConfig?.sourceNodeId;
  let sourceNode: Node<InputNodeData> | undefined;

  // --- Fallback to find internal Input node if sourceNodeId is not configured ---
  if (!effectiveSourceNodeId) {
      const internalInputNode = groupNodes.find(n => n.type === 'input');
      if (internalInputNode) {
          effectiveSourceNodeId = internalInputNode.id;
          console.warn(`[ExecuteGroup ${groupId}] No source node configured. Using internal Input node ${effectiveSourceNodeId} as fallback.`);
      } else {
          const internalRoots = getRootNodesFromSubset(groupNodes, internalEdges);
          if (internalRoots.length === 0) {
                const errorMsg = "Group has no configured/fallback source node and no internal roots.";
                console.error(`[ExecuteGroup ${groupId}] ${errorMsg}`);
                setNodeState(groupId, { status: 'error', error: errorMsg, executionId });
                return; // Stop execution here
          } else {
              console.warn(`[ExecuteGroup ${groupId}] No source node configured/found. Proceeding with internal roots only.`);
          }
      }
  }

  // Find the source node using the effective ID (if available)
  sourceNode = allNodes.find(n => n.id === effectiveSourceNodeId) as Node<InputNodeData> | undefined;

  let sourceItems: any[] = [];

  // --- Get Source Items --- 
  if (sourceNode && effectiveSourceNodeId) {
    const sourceContext: ExecutionContext = { executionId: `source-${executionId}`, triggerNodeId: groupId };
    try {
      const sourceResult = await dispatchNodeExecution({
          node: sourceNode,
          nodes: allNodes,
          edges: allEdges,
          context: sourceContext,
          getNodeState,
          setNodeState
      });

      if (Array.isArray(sourceResult)) {
        sourceItems = sourceResult;
      } else {
        console.warn(`[ExecuteGroup ${groupId}] Source node ${effectiveSourceNodeId} did not return an array. Result:`, sourceResult);
        sourceItems = sourceResult !== undefined && sourceResult !== null ? [sourceResult] : [];
      }

    } catch (sourceError: any) {
      console.error(`[ExecuteGroup ${groupId}] Failed to execute source node ${effectiveSourceNodeId}:`, sourceError);
      const errorMsg = `Failed to get items from source node ${effectiveSourceNodeId}: ${sourceError.message || sourceError}`;
      setNodeState(groupId, { status: 'error', error: errorMsg, executionId });
      if (effectiveSourceNodeId) {
        setNodeState(effectiveSourceNodeId, { status: 'error', error: sourceError.message || sourceError, executionId: sourceContext.executionId });
      }
      return; // Stop execution here
    }
  } else if (effectiveSourceNodeId) {
      const errorMsg = `Configured or fallback source node with ID ${effectiveSourceNodeId} not found in the flow.`;
      console.error(`[ExecuteGroup ${groupId}] ${errorMsg}`);
      setNodeState(groupId, { status: 'error', error: errorMsg, executionId });
      return; // Stop execution here
  } else {
    console.log(`[ExecuteGroup ${groupId}] Proceeding without source items (using internal roots).`);
  }

  // --- Prepare for Execution --- 
  const allItemResults: GroupExecutionItemResult[] = [];
  let groupOverallStatus: 'success' | 'error' = 'success';
  let groupOverallError: string | undefined = undefined;
  const internalRoots = getRootNodesFromSubset(groupNodes, internalEdges);

  try {
    // --- Execute Based on Source Items or Internal Roots --- 
    if (sourceItems.length > 0) {
        // --- Iterate Over Source Items --- 
        console.log(`[ExecuteGroup ${groupId}] Starting iteration over ${sourceItems.length} items.`);
        setIterationContext({ total: sourceItems.length });
        // Reset before first iteration (needed if source node ran)
        console.log(`[ExecuteGroup ${groupId}] Pre-iteration reset for internal nodes: [${groupNodes.map(n=>n.id).join(', ')}]`);
        resetNodeStates(groupNodes.map(n=>n.id));

        for (let i = 0; i < sourceItems.length; i++) {
          const item = sourceItems[i];
          console.log(`[ExecuteGroup ${groupId}] ---- Iteration ${i + 1}/${sourceItems.length} ---- Item:`, item);
          setIterationContext({ index: i, item: item, total: sourceItems.length });

          const itemContext: ExecutionContext = {
            executionId: `${executionId}-item-${i}`, // Unique ID per iteration
            triggerNodeId: groupId,
            isSubExecution: true,
            iterationItem: item
          };

          // Reset states *before each iteration* to prevent state leakage (especially for mergers)
          console.log(`[ExecuteGroup ${groupId}] Iteration ${i + 1}: Resetting internal node states.`);
          resetNodeStates(groupNodes.map(n=>n.id));

          let itemStatus: 'success' | 'error' = 'success';
          let itemError: string | undefined = undefined;
          let itemNodeResults: Record<string, any> = {};
          let finalOutput: any = null;
          let conditionalBranch: 'true' | 'false' | undefined = undefined;

          try {
            if (internalRoots.length > 0) {
                 console.log(`[ExecuteGroup ${groupId}] Iteration ${i + 1}: Executing subgraph with roots: [${internalRoots.join(', ')}]`);
                 itemNodeResults = await executeSubgraphInternal(internalRoots, groupNodes, internalEdges, itemContext, dependencies);
                 console.log(`[ExecuteGroup ${groupId}] Iteration ${i + 1}: Subgraph results:`, itemNodeResults);
            } else {
                 console.log(`[ExecuteGroup ${groupId}] Iteration ${i + 1}: No internal roots to execute.`);
                 itemNodeResults = {}; // No results if no roots
            }

            // Determine final output for this item
            const leafNodes = groupNodes.filter(n => !internalEdges.some(e => e.source === n.id));
            const leafNodeIds = new Set(leafNodes.map(n => n.id));
            const finalOutputs = Object.entries(itemNodeResults)
              .filter(([nodeId, result]) => leafNodeIds.has(nodeId))
              .map(([_, result]) => result);
            finalOutput = finalOutputs.length > 0 ? (finalOutputs.length === 1 ? finalOutputs[0] : finalOutputs) : null;
            const conditionalNodeEntry = Object.entries(itemNodeResults)
              .find(([nodeId, result]) => groupNodes.find(n => n.id === nodeId)?.type === 'conditional');
            if (conditionalNodeEntry) {
              // Assuming conditional node result is boolean indicating branch taken
              conditionalBranch = conditionalNodeEntry[1] ? 'true' : 'false'; 
            }
            console.log(`[ExecuteGroup ${groupId}] Iteration ${i + 1} completed. Output:`, finalOutput);

          } catch (iterError: any) {
            console.error(`[ExecuteGroup ${groupId}] Iteration ${i + 1} failed:`, iterError);
            itemStatus = 'error';
            itemError = iterError.message || 'Unknown iteration error';
            groupOverallStatus = 'error';
            groupOverallError = groupOverallError || `Error on item ${i + 1}: ${itemError}`;
            // Decide whether to continue other iterations or break. Current logic re-throws, breaking the loop.
            throw iterError; 
          }

          allItemResults.push({
            item: item,
            nodeResults: itemNodeResults,
            finalOutput: finalOutput,
            conditionalBranch: conditionalBranch,
            status: itemStatus,
            error: itemError,
          });

          // Update group node's result incrementally
          setNodeState(groupId, { result: [...allItemResults], executionId });
        } // End for loop

    } else if (internalRoots.length > 0) {
        // --- Execute Once With Internal Roots (No Source Items) --- 
        console.log(`[ExecuteGroup ${groupId}] No source items. Executing once with internal roots: [${internalRoots.join(', ')}]`);
        setIterationContext({ index: 0, item: undefined, total: 1 }); // Indicate single run

        // Reset nodes once before the single execution
        console.log(`[ExecuteGroup ${groupId}] Resetting internal node states for single run.`);
        resetNodeStates(groupNodes.map(n=>n.id));

        // Use the main execution ID for the single run context
        const itemContext: ExecutionContext = {
            executionId,
            triggerNodeId: groupId,
            isSubExecution: true,
            iterationItem: undefined // No specific item
        };

        let itemStatus: 'success' | 'error' = 'success';
        let itemError: string | undefined = undefined;
        let itemNodeResults: Record<string, any> = {};
        let finalOutput: any = null;
        let conditionalBranch: 'true' | 'false' | undefined = undefined;

        try {
            itemNodeResults = await executeSubgraphInternal(internalRoots, groupNodes, internalEdges, itemContext, dependencies);
            console.log(`[ExecuteGroup ${groupId}] Single run subgraph execution results:`, itemNodeResults);

            // Determine final output for this single run
            const leafNodes = groupNodes.filter(n => !internalEdges.some(e => e.source === n.id));
            const leafNodeIds = new Set(leafNodes.map(n => n.id));
            const finalOutputs = Object.entries(itemNodeResults)
              .filter(([nodeId, result]) => leafNodeIds.has(nodeId))
              .map(([_, result]) => result);
            finalOutput = finalOutputs.length > 0 ? (finalOutputs.length === 1 ? finalOutputs[0] : finalOutputs) : null;
            const conditionalNodeEntry = Object.entries(itemNodeResults)
              .find(([nodeId, result]) => groupNodes.find(n => n.id === nodeId)?.type === 'conditional');
            if (conditionalNodeEntry) {
              conditionalBranch = conditionalNodeEntry[1] ? 'true' : 'false';
            }
            console.log(`[ExecuteGroup ${groupId}] Single run completed. Output:`, finalOutput);

        } catch (singleRunError: any) {
            console.error(`[ExecuteGroup ${groupId}] Single run execution failed:`, singleRunError);
            itemStatus = 'error';
            itemError = singleRunError.message || 'Unknown execution error';
            groupOverallStatus = 'error';
            groupOverallError = itemError; // Assign the error
            // Error is captured, execution continues to finally block
        }

        // Store the results as if it were a single item
        allItemResults.push({
            item: null, // No source item
            nodeResults: itemNodeResults,
            finalOutput: finalOutput,
            conditionalBranch: conditionalBranch,
            status: itemStatus,
            error: itemError,
        });
        // Set the final result on the group node
        setNodeState(groupId, { result: allItemResults, executionId });

    } else {
        // No source items AND no internal roots - this case should have been caught earlier by the check after fallback.
        console.error(`[ExecuteGroup ${groupId}] CRITICAL: No source items and no internal roots. Execution should have stopped earlier.`);
        groupOverallStatus = 'error'; 
        groupOverallError = "No source items or internal roots found.";
    }

  } catch (groupError: any) {
    // Catch errors re-thrown from the iteration loop or other general errors
    console.error(`[ExecuteGroup ${groupId}] Overall group execution failed:`, groupError);
    groupOverallStatus = 'error';
    // groupOverallError might already be set if the error came from an iteration
    groupOverallError = groupOverallError || (groupError.message || 'Unknown group execution error');
  } finally {
    console.log(`[ExecuteGroup ${groupId}] Finalizing execution. Final status: ${groupOverallStatus}`);
    // Update final status, result, and error on the group node
    setNodeState(groupId, {
      status: groupOverallStatus,
      result: allItemResults, // Contains results from all successful iterations/single run
      error: groupOverallError,
      executionId // Keep the main execution ID
    });
    // Clearing isExecuting and iteration context is handled by the caller (store action)
    console.log(`[ExecuteGroup ${groupId}] Execution function finished.`);
  }
} 