import { Node, Edge } from 'reactflow';
import { NodeData } from '../types/nodes';
import { useNodeContentStore } from '../store/useNodeContentStore';
import { useFlowStructureStore } from '../store/useFlowStructureStore';
import { pushSnapshot, FlowSnapshot } from '../store/useHistoryStore';

/**
 * Creates a snapshot of the current flow state
 */
export function createFlowSnapshot(): FlowSnapshot {
  const nodes = useFlowStructureStore.getState().nodes;
  const edges = useFlowStructureStore.getState().edges;
  const contents = useNodeContentStore.getState().getAllNodeContents();
  
  return {
    nodes,
    edges, 
    contents
  };
}

/**
 * Creates and pushes a snapshot of the current flow state to history
 */
export function pushCurrentSnapshot(): void {
  const snapshot = createFlowSnapshot();
  pushSnapshot(snapshot);
}

/**
 * Creates a snapshot of the provided flow state
 */
export function createSnapshotFromState(
  nodes: Node<NodeData>[], 
  edges: Edge[],
  contents?: Record<string, NodeContent>
): FlowSnapshot {
  return {
    nodes,
    edges,
    contents: contents || useNodeContentStore.getState().getAllNodeContents()
  };
} 