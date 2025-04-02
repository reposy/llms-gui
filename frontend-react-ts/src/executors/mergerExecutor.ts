import { Node } from 'reactflow';
import { MergerNodeData } from '../types/nodes';
import { ExecutionContext, NodeState, defaultNodeState } from '../types/execution';

export function executeMergerNode(params: {
  node: Node<MergerNodeData>;
  inputs: any[];
  context: ExecutionContext;
  setNodeState: (nodeId: string, state: Partial<NodeState>) => void; // Ensure correct signature
  getNodeState: (nodeId: string) => NodeState; // Need access to current state
}): any[] { // Merger node always outputs an array
  const { node, inputs, context, setNodeState, getNodeState } = params;
  const nodeId = node.id;
  const nodeData = node.data;
  const { executionId } = context;
  const currentState = getNodeState(nodeId) || defaultNodeState;
  
  // Determine if state needs reset based on execution ID (assuming this logic is handled before calling the executor)
  const nodeLastExecutionId = currentState.executionId;
  const needsReset = nodeLastExecutionId !== executionId;

  console.log(`[ExecuteNode ${nodeId}] (Merger) Executing with context:`, context);
  console.log(`[ExecuteNode ${nodeId}] (Merger) Needs Reset: ${needsReset}, Current State ExecutionID: ${nodeLastExecutionId}, Context ExecutionID: ${executionId}`);
  console.log(`[ExecuteNode ${nodeId}] (Merger) Processing inputs:`, inputs);

  let accumulatedResults: any[] = [];
  // If it's the same execution context AND the previous result was an array, reuse it.
  if (!needsReset && Array.isArray(currentState.result)) {
    accumulatedResults = [...currentState.result]; // Use spread to create a new array copy
    console.log(`[Merger ${nodeId}] Reusing previous results from same execution ${executionId}:`, accumulatedResults);
  } else {
    console.log(`[Merger ${nodeId}] Initializing results for execution ${executionId} (needsReset: ${needsReset}, prevResult type: ${typeof currentState.result})`);
  }

  // Add current inputs to the list
  inputs.forEach(input => {
    if (input !== undefined && input !== null) {
      // If input is already an array (e.g., from another merger or group result), spread its items
      if (Array.isArray(input)) {
        accumulatedResults.push(...input);
        console.log(`[Merger ${nodeId}] Spreading array input:`, input);
      } else {
        accumulatedResults.push(input);
        console.log(`[Merger ${nodeId}] Adding single input:`, input);
      }
    } else {
      console.log(`[Merger ${nodeId}] Skipping null/undefined input.`);
    }
  });

  // Optionally merge with custom items if defined
  if (nodeData.items && nodeData.items.length > 0) {
    console.log(`[Merger ${nodeId}] Including custom items:`, nodeData.items);
    // Treat custom items similar to inputs - add them if they aren't null/undefined
    nodeData.items.forEach(item => {
      if (item !== undefined && item !== null) {
        // Check if item is already in the array to avoid duplicates from nodeData? Optional.
        accumulatedResults.push(item);
      }
    });
  }

  const output = accumulatedResults; // The final output is the accumulated array
  console.log(`[ExecuteNode ${nodeId}] (Merger) Final accumulated results for execution ${executionId}:`, output);

  return output;
} 