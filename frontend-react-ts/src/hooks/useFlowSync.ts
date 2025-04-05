import { useEffect, useRef, useCallback } from 'react';
import { Node, Edge, useNodesState, useEdgesState, NodeChange, EdgeChange, applyNodeChanges, applyEdgeChanges } from 'reactflow';
import { NodeData } from '../types/nodes';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { setNodes as setReduxNodes, setEdges as setReduxEdges } from '../store/flowSlice';
import { isEqual } from 'lodash';

interface UseFlowSyncOptions {
  isRestoringHistory: React.MutableRefObject<boolean>;
}

interface UseFlowSyncReturn {
  localNodes: Node<NodeData>[];
  localEdges: Edge[];
  setLocalNodes: React.Dispatch<React.SetStateAction<Node<NodeData>[]>>;
  setLocalEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  onLocalNodesChange: (changes: NodeChange[]) => void;
  onLocalEdgesChange: (changes: EdgeChange[]) => void;
  forceSyncFromRedux: () => void;
  commitStructureToRedux: () => void;
}

// Helper function to compare nodes (can be simplified if only structure matters)
const areNodesStructureEqual = (localNodes: Node<NodeData>[], reduxNodes: Node<NodeData>[]) => {
  if (localNodes.length !== reduxNodes.length) return false;
  const reduxNodesMap = new Map(reduxNodes.map(node => [node.id, node]));
  return localNodes.every(localNode => {
    const reduxNode = reduxNodesMap.get(localNode.id);
    if (!reduxNode) return false;
    // Compare only structural properties relevant to React Flow rendering
    // Omit data comparison here, as content is managed separately.
    // Depending on needs, could compare node type if it changes.
    return (
      localNode.id === reduxNode.id &&
      localNode.type === reduxNode.type && // Added type check
      isEqual(localNode.position, reduxNode.position) &&
      localNode.selected === reduxNode.selected && // Include selection if needed
      localNode.dragging === reduxNode.dragging // Include dragging state if needed
      // Dimensions might also be relevant if calculated
      // isEqual(localNode.width, reduxNode.width) &&
      // isEqual(localNode.height, reduxNode.height)
    );
  });
};

// Helper to compare edges
const areEdgesStructureEqual = (localEdges: Edge[], reduxEdges: Edge[]) => {
   if (localEdges.length !== reduxEdges.length) return false;
   // Simple comparison, could be more sophisticated if edge data/styles change
   return isEqual(localEdges, reduxEdges); 
};

/**
 * Hook responsible for synchronizing the *structure* (nodes, edges, positions) 
 * between React Flow's local state and the Redux store.
 * Content synchronization is handled separately (e.g., by useManagedNodeContent).
 */
export const useFlowSync = ({ 
  isRestoringHistory 
}: UseFlowSyncOptions): UseFlowSyncReturn => {
  const dispatch = useDispatch();
  
  const reduxNodes = useSelector((state: RootState) => state.flow.nodes);
  const reduxEdges = useSelector((state: RootState) => state.flow.edges);
  
  const [localNodes, setLocalNodes, onLocalNodesChangeInternal] = useNodesState(reduxNodes);
  const [localEdges, setLocalEdges, onLocalEdgesChangeInternal] = useEdgesState(reduxEdges);
  
  // Track if local structural changes exist that haven't been committed to Redux
  const hasPendingStructuralChanges = useRef(false);
  
  // Track initial load
  const isInitialSyncRef = useRef(true);

  // Apply incoming changes from React Flow interactions to local state
  // and mark that structural changes are pending.
  const onLocalNodesChange = useCallback((changes: NodeChange[]) => {
    setLocalNodes((nds) => applyNodeChanges(changes, nds));
    hasPendingStructuralChanges.current = true;
    console.log("[FlowSync Structure] Local nodes changed, pending commit.", changes);
  }, [setLocalNodes]);

  const onLocalEdgesChange = useCallback((changes: EdgeChange[]) => {
    setLocalEdges((eds) => applyEdgeChanges(changes, eds));
    hasPendingStructuralChanges.current = true;
    console.log("[FlowSync Structure] Local edges changed, pending commit.", changes);
  }, [setLocalEdges]);

  // Function to commit local structural changes to Redux
  const commitStructureToRedux = useCallback(() => {
    // Check the flag instead of comparing potentially large arrays every time
    if (hasPendingStructuralChanges.current) {
      console.log(`[FlowSync Structure] Committing structural changes to Redux`);
      
      // Directly dispatch local state to Redux
      // Consider deep cloning if mutations are a concern, though Redux handles shallow copies.
      dispatch(setReduxNodes([...localNodes])); 
      dispatch(setReduxEdges([...localEdges]));
      
      // Reset the flag after commit
      hasPendingStructuralChanges.current = false;
    } else {
       console.log("[FlowSync Structure] No pending structural changes to commit.");
    }
  }, [dispatch, localNodes, localEdges]);
  
  // Function to force a sync from Redux to local state
  // Overwrites any uncommitted local structural changes.
  const forceSyncFromRedux = useCallback(() => {
    console.log("[FlowSync Structure] Force sync from Redux requested. Overwriting local state.");
    setLocalNodes(reduxNodes);
    setLocalEdges(reduxEdges);
    hasPendingStructuralChanges.current = false; // Local state now matches Redux
    console.log("[FlowSync Structure] Completed force sync from Redux to local.");
  }, [reduxNodes, reduxEdges, setLocalNodes, setLocalEdges]);
  
  // Initial sync on mount
  useEffect(() => {
    if (isInitialSyncRef.current) {
      console.log("[FlowSync Structure] Initial sync from Redux");
      setLocalNodes(reduxNodes);
      setLocalEdges(reduxEdges);
      isInitialSyncRef.current = false;
      hasPendingStructuralChanges.current = false;
    }
  }, [reduxNodes, reduxEdges, setLocalNodes, setLocalEdges]); // Dependencies ensure initial sync happens
  
  // Handle external Redux updates (e.g., from history restore, or potentially collaboration later)
  useEffect(() => {
    // Skip initial sync phase
    if (isInitialSyncRef.current) {
        return;
    }

    // If restoring history, force local state to match Redux
    if (isRestoringHistory.current) {
      console.log("[FlowSync Structure] Syncing local state from Redux due to history restoration.");
      setLocalNodes(reduxNodes);
      setLocalEdges(reduxEdges);
      hasPendingStructuralChanges.current = false;
      return; // Don't proceed further in this case
    }

    // --- Handling non-history external Redux changes --- 
    // This part becomes simpler without isEditingNodeRef.
    // If Redux state changes externally (and not via history), 
    // we need to decide the strategy:
    // Option A: Always overwrite local state (like forceSync). Simple, but loses uncommitted local changes.
    // Option B: Only update if local state hasn't diverged (more complex, needs reliable change detection).
    // Option C: Ignore external changes unless explicitly forced (requires `forceSyncFromRedux`). Safest for local work.

    // Let's implement Option C for now: Local changes take precedence unless forced.
    // We don't automatically update from Redux here unless `isRestoringHistory` is true.
    // The comparison checks below are illustrative if Option B was chosen.

    // Example check (if implementing Option B):
    // const nodesChanged = !areNodesStructureEqual(localNodes, reduxNodes);
    // const edgesChanged = !areEdgesStructureEqual(localEdges, reduxEdges);
    // if (nodesChanged || edgesChanged) {
    //    console.log("[FlowSync Structure] External Redux change detected.");
    //    // Decide whether to merge, overwrite, or ignore based on `hasPendingStructuralChanges`
    // }

  }, [reduxNodes, reduxEdges, isRestoringHistory, localNodes, localEdges, setLocalNodes, setLocalEdges]); // Add local state to deps if comparing

  return {
    localNodes,
    localEdges,
    setLocalNodes,
    setLocalEdges,
    onLocalNodesChange,
    onLocalEdgesChange,
    forceSyncFromRedux,
    commitStructureToRedux,
  };
}; 