import { useEffect, useRef, useCallback } from 'react';
import { Node, Edge, useNodesState, useEdgesState, NodeChange, EdgeChange, applyNodeChanges, applyEdgeChanges } from 'reactflow';
import { NodeData } from '../types/nodes';
import { 
  useNodes, 
  useEdges, 
  setNodes as setZustandNodes, 
  setEdges as setZustandEdges,
  useFlowStructureStore
} from '../store/useFlowStructureStore';
import { isEqual } from 'lodash';
import { useSelectionSync } from './useSelectionSync';
import { hasEqualSelection } from '../utils/selectionUtils';

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
  forceSyncFromStore: () => void;
  commitStructureToStore: () => void;
  selectionHandlers: {
    handleSelectionChange: (selectedNodeIds: string[]) => void;
    isShiftPressed: React.MutableRefObject<boolean>;
    isCtrlPressed: React.MutableRefObject<boolean>;
    getActiveModifierKey: () => import('../store/useFlowStructureStore').SelectionModifierKey;
    normalizeSelectionState: () => void;
  };
}

/**
 * Hook responsible for synchronizing the *structure* (nodes, edges, positions) 
 * between React Flow's local state and the Zustand store.
 * Content synchronization is handled separately (e.g., by useManagedNodeContent).
 * Selection sync is now handled by the useSelectionSync hook.
 */
export const useFlowSync = ({ 
  isRestoringHistory 
}: UseFlowSyncOptions): UseFlowSyncReturn => {
  // Get nodes and edges from Zustand
  const zustandNodes = useNodes();
  const zustandEdges = useEdges();
  
  const [localNodes, setLocalNodes, onLocalNodesChangeInternal] = useNodesState(zustandNodes);
  const [localEdges, setLocalEdges, onLocalEdgesChangeInternal] = useEdgesState(zustandEdges);
  
  // Track if local structural changes exist that haven't been committed to Zustand
  const hasPendingStructuralChanges = useRef(false);
  
  // Track initial load
  const isInitialSyncRef = useRef(true);
  
  // Initialize the selection sync hook
  const selectionSync = useSelectionSync({
    localNodes,
    setLocalNodes,
    isRestoringHistory
  });
  
  // Set up keyboard event listeners for modifier keys
  useEffect(() => {
    const cleanup = selectionSync.trackKeyboardModifiers();
    return cleanup;
  }, [selectionSync]);

  // Helper function to check if changes are only selection changes
  const onlySelectionChanges = (changes: NodeChange[]): boolean => {
    return changes.every(change => change.type === 'select');
  };

  // Function to handle local node changes (selection, position, etc)
  const onLocalNodesChange = useCallback((changes: NodeChange[]) => {
    // Skip processing if we're in the process of restoring history
    if (isRestoringHistory.current) return;
    
    // Determine if changes include position changes (dragging)
    const positionChanges = changes.filter(change => 
      change.type === 'position' && change.position
    );
    
    // Determine if changes include selection changes
    const selectionChanges = changes.filter(change => 
      change.type === 'select' && change.selected !== undefined
    );
    
    // Process all changes to get the new state first
    const nextNodes = applyNodeChanges(changes, localNodes);
    setLocalNodes(nextNodes);
    
    // Track position changes, but don't sync to Zustand here
    // The syncDraggedNodesToZustand function in useNodeHandlers will handle that
    // after the drag is complete (in handleNodeDragStop/handleSelectionDragStop)
    if (positionChanges.length > 0) {
      const selectedNodeCount = nextNodes.filter(n => n.selected).length;
      
      if (selectedNodeCount > 1) {
        console.log(`[FlowSync] Multi-selection drag in progress - ${positionChanges.length} position changes for ${selectedNodeCount} selected nodes`);
        
        // Just mark that structural changes are pending - the actual Zustand sync
        // will happen in handleSelectionDragStop
        hasPendingStructuralChanges.current = true;
      }
    }
    
    // Let useNodeHandlers handle selection changes, to avoid double processing
    // This helps prevent infinite loops
    if (selectionChanges.length > 0 && positionChanges.length === 0) {
      console.log(`[FlowSync] Selection-only changes, handled by useNodeHandlers`);
      return;
    }
    
    // Mark that we have pending structural changes, which will be later synced from local to Zustand
    if (changes.length > 0 && !onlySelectionChanges(changes)) {
      hasPendingStructuralChanges.current = true;
    }
  }, [localNodes, isRestoringHistory]);

  const onLocalEdgesChange = useCallback((changes: EdgeChange[]) => {
    setLocalEdges((eds) => applyEdgeChanges(changes, eds));
    hasPendingStructuralChanges.current = true;
    console.log("[FlowSync] Local edges changed, pending commit.", changes);
  }, [setLocalEdges]);

  // Function to commit local structural changes to Zustand store
  const commitStructureToStore = useCallback(() => {
    // Skip if we're currently restoring history
    if (isRestoringHistory.current) {
      console.log("[FlowSync] Skipping commit during history restoration");
      return;
    }
    
    // Check the flag instead of comparing potentially large arrays every time
    if (hasPendingStructuralChanges.current) {
      console.log(`[FlowSync] Committing structural changes to Zustand store`);
      
      // Get the current state from the store
      const storeState = useFlowStructureStore.getState();
      
      // Ensure we're preserving node selection state using the selection sync helper
      const nodesWithSelection = selectionSync.applyStoreSelectionToNodes(localNodes);
      
      // Check if nodes or edges actually changed before updating
      const nodesChanged = !isEqual(nodesWithSelection, storeState.nodes);
      const edgesChanged = !isEqual(localEdges, storeState.edges);
      
      // Only update what's needed
      if (nodesChanged) {
        console.log('[FlowSync] Updating nodes with selection state');
        setZustandNodes([...nodesWithSelection]);
      }
      
      if (edgesChanged) {
        setZustandEdges([...localEdges]);
      }
      
      if (nodesChanged || edgesChanged) {
        console.log(`[FlowSync] Updated store: nodes changed=${nodesChanged}, edges changed=${edgesChanged}`);
      } else {
        console.log(`[FlowSync] No actual changes detected, skipping store update`);
      }
      
      // Reset the flag after commit
      hasPendingStructuralChanges.current = false;
    } else {
      console.log("[FlowSync] No pending structural changes to commit.");
    }
  }, [localNodes, localEdges, isRestoringHistory, selectionSync]);

  // Initial sync on mount
  useEffect(() => {
    if (isInitialSyncRef.current) {
      console.log("[FlowSync] Initial sync from Zustand store");
      
      // Get current store state
      const storeState = useFlowStructureStore.getState();
      
      // The selection sync hook handles selection state normalization
      // We just need to set the edges here
      setLocalEdges(storeState.edges);
      
      // Reset flag
      isInitialSyncRef.current = false;
      hasPendingStructuralChanges.current = false;
    }
  }, [zustandNodes, zustandEdges, setLocalEdges]);

  // Function to force a sync from Zustand store to local state
  // Overwrites any uncommitted local structural changes.
  const forceSyncFromStore = useCallback(() => {
    const storeNodes = useFlowStructureStore.getState().nodes;
    const storeEdges = useFlowStructureStore.getState().edges;
    const selectedNodeIds = useFlowStructureStore.getState().selectedNodeIds;
    const localSelectedIds = localNodes.filter(n => n.selected).map(n => n.id);
    
    console.log(
      `[FlowSync] Force sync requested. Local nodes: ${localNodes.length}, Store nodes: ${storeNodes.length}. ` +
      `Selected in store: ${selectedNodeIds.length}, Selected locally: ${localSelectedIds.length}`
    );

    // Skip if nothing significant has changed
    const nodeCountDifference = Math.abs(localNodes.length - storeNodes.length);
    const selectionDifference = !hasEqualSelection(localSelectedIds, selectedNodeIds);
    
    if (
      !hasPendingStructuralChanges.current && 
      nodeCountDifference === 0 && 
      !selectionDifference &&
      !isRestoringHistory.current &&
      !isInitialSyncRef.current
    ) {
      console.log(`[FlowSync] Skipping force sync - no significant differences`);
      return;
    }

    console.log(`[FlowSync] Forcing sync from store. History restoring: ${isRestoringHistory.current}`);

    // Sync node structure with proper selection state
    const nodesWithSelection = selectionSync.applyStoreSelectionToNodes(storeNodes);
    setLocalNodes(nodesWithSelection);
    setLocalEdges(storeEdges);
    
    // Reset pending changes flag
    hasPendingStructuralChanges.current = false;
  }, [localNodes, setLocalNodes, setLocalEdges, isRestoringHistory, selectionSync]);

  // Subscribes to flow structure store, to update local view when store changes
  useEffect(() => {
    if (isInitialSyncRef.current) {
      console.log("[FlowSync] Skipping initial sync phase");
      isInitialSyncRef.current = false;
      return;
    }

    // For history restoration, we always force sync from store
    if (isRestoringHistory.current) {
      console.log("[FlowSync] History restoring - forcing sync");
      forceSyncFromStore();
      return;
    }

    // Check if structure has changed between local and store
    const hasNodeCountChanged = localNodes.length !== zustandNodes.length;
    const hasEdgeCountChanged = localEdges.length !== zustandEdges.length;
    
    // For new flows, we might get empty nodes/edges
    const isNewOrEmptyFlow = zustandNodes.length === 0 && zustandEdges.length === 0;
    
    // Only update local if there are meaningful structure changes and no pending local changes
    const shouldForceSync = 
      hasNodeCountChanged || 
      hasEdgeCountChanged || 
      isNewOrEmptyFlow;
    
    if (shouldForceSync && !hasPendingStructuralChanges.current) {
      console.log(`[FlowSync] Store changed, forcing sync due to structural changes:`, {
        nodeCountChange: hasNodeCountChanged ? `${localNodes.length} -> ${zustandNodes.length}` : false, 
        edgeCountChange: hasEdgeCountChanged ? `${localEdges.length} -> ${zustandEdges.length}` : false
      });
      
      // Force sync to update both structure and selection
      forceSyncFromStore();
    } else if (hasPendingStructuralChanges.current) {
      console.log("[FlowSync] Skipping sync from store due to pending local changes");
    } else {
      console.log("[FlowSync] Store changed but no significant structural differences detected");
    }
  }, [
    zustandNodes, 
    zustandEdges, 
    localNodes,
    localEdges,
    isRestoringHistory,
    forceSyncFromStore
  ]);

  return {
    localNodes,
    localEdges,
    setLocalNodes,
    setLocalEdges,
    onLocalNodesChange,
    onLocalEdgesChange,
    commitStructureToStore,
    forceSyncFromStore,
    selectionHandlers: {
      handleSelectionChange: selectionSync.handleSelectionChange,
      isShiftPressed: selectionSync.isShiftPressed,
      isCtrlPressed: selectionSync.isCtrlPressed,
      getActiveModifierKey: selectionSync.getActiveModifierKey,
      normalizeSelectionState: selectionSync.normalizeSelectionState
    }
  };
};