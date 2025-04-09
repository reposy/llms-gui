import { Node, Edge } from 'reactflow';
import { NodeData } from '../types/nodes';
import { FlowSnapshot, pushSnapshot } from '../store/useHistoryStore';
import { getAllNodeContents } from '../store/useNodeContentStore';
import { useFlowStructureStore } from '../store/useFlowStructureStore';

/**
 * Creates a snapshot of the current flow state and pushes it to the history store
 */
export const pushCurrentSnapshot = () => {
  // Get nodes and edges from the Zustand store
  const { nodes, edges } = useFlowStructureStore.getState();
  const contents = getAllNodeContents();
  
  // Create a snapshot
  const snapshot: FlowSnapshot = {
    nodes,
    edges,
    contents
  };
  
  console.log(`[HistoryUtils] Pushing snapshot with ${nodes.length} nodes, ${edges.length} edges, and ${Object.keys(contents).length} contents`);
  
  // Push the snapshot to the history store
  pushSnapshot(snapshot);
};

/**
 * Creates a snapshot specifically after a node operation
 * @param operation - Description of the operation for logging
 */
export const pushSnapshotAfterNodeOperation = (operation: string) => {
  console.log(`[HistoryUtils] Creating snapshot after: ${operation}`);
  setTimeout(() => pushCurrentSnapshot(), 0);
};

/**
 * Creates a snapshot with the provided nodes and edges
 * @param nodes - The nodes to include in the snapshot
 * @param edges - The edges to include in the snapshot
 */
export const pushCustomSnapshot = (nodes: Node<NodeData>[], edges: Edge[]) => {
  const contents = getAllNodeContents();
  
  // Create a snapshot
  const snapshot: FlowSnapshot = {
    nodes,
    edges,
    contents
  };
  
  console.log(`[HistoryUtils] Pushing custom snapshot with ${nodes.length} nodes, ${edges.length} edges, and ${Object.keys(contents).length} contents`);
  
  // Push the snapshot to the history store
  pushSnapshot(snapshot);
}; 