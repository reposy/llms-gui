import { useEffect, useRef, useCallback } from 'react';
import { Node, Edge, useNodesState, useEdgesState, NodeChange, EdgeChange, applyNodeChanges, applyEdgeChanges } from 'reactflow';
import { NodeData } from '../types/nodes';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { setNodes as setReduxNodes, setEdges as setReduxEdges } from '../store/flowSlice';

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
  
  // Add a ref to track shift key state for multi-selection
  const isShiftPressed = useRef(false);
  
  // Set up keyboard listeners to track shift key state
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        isShiftPressed.current = true;
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        isShiftPressed.current = false;
      }
    };
    
    // Handle focus/blur events to reset shift state when window loses focus
    const handleBlur = () => {
      isShiftPressed.current = false;
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  // Apply incoming changes from React Flow interactions to local state
  // and mark that structural changes are pending.
  const onLocalNodesChange = useCallback((changes: NodeChange[]) => {
    // Filter selection changes for special handling
    const selectionChanges = changes.filter(change => 
      change.type === 'select' && change.selected !== undefined
    );
    
    // Get non-selection changes
    const otherChanges = changes.filter(change => 
      !(change.type === 'select' && change.selected !== undefined)
    );
    
    // Check if these are position changes (dragging)
    const hasPositionChanges = changes.some(change => 
      change.type === 'position' && change.position
    );
    
    // Apply special multi-select logic if shift is pressed and there are selection changes
    if (isShiftPressed.current && selectionChanges.length > 0) {
      setLocalNodes(nodes => {
        let nextNodes = [...nodes];
        
        // Process each selection change
        selectionChanges.forEach(change => {
          const { id, selected } = change as { id: string; selected: boolean };
          // Find the node index
          const nodeIndex = nextNodes.findIndex(node => node.id === id);
          
          if (nodeIndex !== -1) {
            // Update the node's selection state while preserving other selections
            nextNodes[nodeIndex] = {
              ...nextNodes[nodeIndex],
              selected
            };
          }
        });
        
        // Apply non-selection changes normally
        return applyNodeChanges(otherChanges, nextNodes);
      });
    } else {
      // Standard behavior without shift key
      setLocalNodes(nodes => applyNodeChanges(changes, nodes));
    }
    
    // For position changes, immediately sync to Redux to ensure 
    // dragging multiple nodes works consistently
    if (hasPositionChanges) {
      // Delay this slightly to ensure the setLocalNodes has completed
      setTimeout(() => {
        dispatch(setReduxNodes([...localNodes]));
      }, 0);
    }
    
    hasPendingStructuralChanges.current = true;
    console.log("[FlowSync Structure] Local nodes changed, pending commit.", changes);
  }, [setLocalNodes, localNodes, dispatch]);

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
      // Ensure we're preserving node selection state
      const nodesWithSelection = localNodes.map(node => ({
        ...node,
        selected: node.selected || false // Ensure selection state is explicitly set
      }));
      
      dispatch(setReduxNodes([...nodesWithSelection])); 
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
      return;
    }

    // Check if there's a meaningful difference before updating
    const nodesChanged = reduxNodes.length !== localNodes.length;
    const edgesChanged = reduxEdges.length !== localEdges.length;

    // Special case: when Redux nodes and edges are empty (new flow creation)
    // immediately sync this to local state
    if (reduxNodes.length === 0 && reduxEdges.length === 0 && (localNodes.length > 0 || localEdges.length > 0)) {
      console.log("[FlowSync Structure] Detected empty Redux state (new flow). Clearing local state.");
      setLocalNodes([]);
      setLocalEdges([]);
      hasPendingStructuralChanges.current = false;
      return;
    }

    // Only update if there's a meaningful change and we're not in the middle of editing
    if ((nodesChanged || edgesChanged) && !hasPendingStructuralChanges.current) {
      console.log("[FlowSync Structure] Detected Redux state change, updating local state");
      setLocalNodes(reduxNodes);
      setLocalEdges(reduxEdges);
      hasPendingStructuralChanges.current = false;
    }

    // Removed comment referencing the old isEditingNodeRef
    // const isEditingCurrentNode = isEditingNodeRef.current === node.id;
    // if (isEditingCurrentNode) {

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