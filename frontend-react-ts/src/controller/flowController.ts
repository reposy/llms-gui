import { Edge, Node } from 'reactflow';
import { NodeData } from '../types/nodes';
import { ExecutionContext, NodeState } from '../types/execution';
import { getRootNodesFromSubset } from '../utils/executionUtils';
import { dispatchNodeExecution as dispatchToExecutor } from './executionDispatcher';

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
          console.log(`[Subgraph ${executionContext.executionId}] Adding root ${nodeId} to initial queue.`);
        }
      } else {
        console.log(`[Subgraph ${executionContext.executionId}] Node ${nodeId} deferred (has internal dependencies).`);
      }
    }
  });

  console.log(`[Subgraph ${executionContext.executionId}] Initial execution queue:`, [...queue]);
  console.log(`[Subgraph ${executionContext.executionId}] Dependencies:`, nodeDependencies);

  const executingPromises: Record<string, Promise<any>> = {};

  // Function to check if all dependencies of a node are met
  const areDependenciesMet = (nodeId: string): boolean => {
    const deps = nodeDependencies[nodeId];
    if (!deps || deps.length === 0) return true; // No dependencies

    return deps.every(depId => {
      // Check if dependency exists in subgraph and is completed
      const depNodeExists = nodesInSubgraph.some(n => n.id === depId);
      const depCompleted = nodeExecutionStatus[depId] === 'completed';

      if (!depNodeExists || !depCompleted) {
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
               console.warn(`[Subgraph ${executionContext.executionId}] Edge not found between conditional ${depId} and target ${nodeId}. Assuming dependency not met.`);
               return false; // Edge must exist
           }
           // Crucially, check if the edge's sourceHandle matches the activeOutputHandle
           const handlesMatch = edge.sourceHandle === (depState as any).activeOutputHandle;
           if (!handlesMatch) {
               console.log(`[areDependenciesMet ${executionContext.executionId}] Node: ${nodeId}, Dep: ${depId}(Conditional), Result: FALSE (Handle mismatch)`);
               setNodeState(nodeId, { status: 'skipped', executionId: executionContext.executionId }); // Set node to skipped
               return false; // This path is inactive
           }
           console.log(`[Subgraph ${executionContext.executionId}] Dependency ${depId} (Conditional) met via active handle '${(depState as any).activeOutputHandle}' for ${nodeId}.`);
        } else {
           if (depState?.status === 'success') {
                console.warn(`[areDependenciesMet ${executionContext.executionId}] Node: ${nodeId}, Dep: ${depId}(Conditional), Result: FALSE (Completed but missing activeOutputHandle). State:`, depState );
           } else {
                console.log(`[areDependenciesMet ${executionContext.executionId}] Node: ${nodeId}, Dep: ${depId}(Conditional), Result: FALSE (Not completed successfully - Status: ${depState?.status})`);
           }
           setNodeState(nodeId, { status: 'skipped', executionId: executionContext.executionId }); // Set node to skipped
           return false; // Treat as unmet if state is inconsistent or node didn't succeed
        }
      }
      // --- End Conditional Check ---

      // If it's not a conditional node OR the conditional check passed, the dependency is met
      return true;
    });
  };

  // Main execution loop
  while (Object.values(nodeExecutionStatus).some(s => s === 'pending' || s === 'running')) {
    const nodesReadyToRun = nodesInSubgraph
      .map(n => n.id)
      .filter(nodeId => nodeExecutionStatus[nodeId] === 'pending' && areDependenciesMet(nodeId) && !queue.includes(nodeId));

    // Add newly ready nodes to the queue
    nodesReadyToRun.forEach(nodeId => {
        if (!queue.includes(nodeId)) {
            queue.push(nodeId);
            console.log(`[Subgraph ${executionContext.executionId}] Dependencies met for ${nodeId}, adding to queue.`);
        }
    });

    // Process nodes from the queue
    const nodesToProcess = [...queue]; // Process all currently in queue
    queue.length = 0; // Clear queue for next iteration

    if (nodesToProcess.length === 0 && Object.keys(executingPromises).length === 0) {
        // Nothing ready, nothing running -> execution finished or stalled
        const pendingNodes = Object.entries(nodeExecutionStatus).filter(([_, s]) => s === 'pending').map(([id]) => id);
        if (pendingNodes.length > 0) {
             console.warn(`[Subgraph ${executionContext.executionId}] No nodes processing, but ${pendingNodes.length} pending. Possible deadlock or cycle? Pending:`, pendingNodes, `Statuses:`, nodeExecutionStatus);
             throw new Error("Execution deadlock: Could not resolve dependencies.");
        }
        console.log(`[Subgraph ${executionContext.executionId}] No nodes ready/running and no promises pending. Exiting loop.`);
        break;
    }

    // Execute ready nodes in parallel
    nodesToProcess.forEach(nodeId => {
        if (nodeExecutionStatus[nodeId] !== 'pending') return; // Skip if already running/processed

        nodeExecutionStatus[nodeId] = 'running';
        console.log(`[Subgraph ${executionContext.executionId}] Dispatching execution for node ${nodeId}...`);

        // Collect inputs for this node from completed dependencies
        const nodeInputs = edgesInSubgraph
          .filter(edge => edge.target === nodeId)
          .map(edge => {
            const sourceId = edge.source;
            return nodeResults[sourceId];
          })
          .filter(result => result !== undefined);

        // Call the central dispatcher with the node ID and collected inputs
        executingPromises[nodeId] = dispatchToExecutor(
          nodeId,
          nodeInputs,
          executionContext,
          dependencies
        )
        .then(result => {
            console.log(`[Subgraph ${executionContext.executionId}] Node ${nodeId} completed successfully.`);
            nodeResults[nodeId] = result;
            nodeExecutionStatus[nodeId] = 'completed';
            delete executingPromises[nodeId]; // Remove completed promise

            // Check and add children to the main check list if they are pending
            const children = edgesInSubgraph
                .filter(edge => edge.source === nodeId)
                .map(edge => edge.target);

            children.forEach(childId => {
                if (nodesInSubgraph.some(n => n.id === childId) && nodeExecutionStatus[childId] === 'pending') {
                    console.log(`[Subgraph ${executionContext.executionId}] Node ${nodeId} finished, child ${childId} is pending.`);
                }
            });
        })
        .catch(error => {
            console.error(`[Subgraph ${executionContext.executionId}] Execution for node ${nodeId} failed:`, error);
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
            console.error(`[Subgraph ${executionContext.executionId}] Caught error during Promise.race, stopping subgraph.`);
            throw error; // Stop the entire subgraph execution on first failure
        }
    }
  } // End while loop

  // Final check for any nodes that didn't complete
  const failedNodes = Object.entries(nodeExecutionStatus)
    .filter(([_, status]) => status === 'pending' || status === 'running') // Ignore 'skipped' and 'failed' here
    .map(([nodeId, _]) => nodeId);

  if (failedNodes.length > 0) {
    console.error(`[Subgraph ${executionContext.executionId}] Execution finished with incomplete or failed nodes:`, failedNodes);
    throw new Error(`Subgraph execution failed. Incomplete nodes: ${failedNodes.join(', ')}`);
  }

  console.log(`[Subgraph ${executionContext.executionId}] Execution finished successfully. Results:`, nodeResults);
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

    await executeSubgraph(uniqueStartNodes, nodesInSubGraph, edgesInSubGraph, context, dependencies);
    console.log(`[ExecuteFlow ${executionId}] Execution finished successfully.`);
  } catch (error) {
    console.error(`[ExecuteFlow ${executionId}] Execution failed:`, error);
  } finally {
    console.log(`[ExecuteFlow ${executionId}] Setting isExecuting to false.`);
    setIsExecuting(false); // Mark execution as finished
  }
} 