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
import { hasEqualSelection, syncVisualSelectionToReactFlow } from '../utils/selectionUtils';

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
  flowResetKey: number; // New key to force React Flow component rerender
  selectionHandlers: {
    handleSelectionChange: (selectedNodeIds: string[]) => void;
    isShiftPressed: React.MutableRefObject<boolean>;
    isCtrlPressed: React.MutableRefObject<boolean>;
    getActiveModifierKey: () => import('../store/useFlowStructureStore').SelectionModifierKey;
    normalizeSelectionState: () => void;
    forceDeselection: () => void;
  };
}

/**
 * Custom hook to handle empty flow detection and visual canvas resetting
 */
function useEmptyFlowDetector(
  localNodes: Node<NodeData>[],
  localEdges: Edge[],
  setLocalNodes: React.Dispatch<React.SetStateAction<Node<NodeData>[]>>,
  setLocalEdges: React.Dispatch<React.SetStateAction<Edge[]>>,
  hasPendingStructuralChanges: React.MutableRefObject<boolean>
) {
  // Create a version ref to track when we've cleared the flow
  const lastClearedVersion = useRef<number>(0);
  // Key to force ReactFlow component to rerender (timestamp-based)
  const flowResetKey = useRef<number>(Date.now());
  // Track empty flow state to avoid redundant logs
  const emptyFlowState = useRef<{
    storeEmpty: boolean;
    localPopulated: boolean;
    lastDetectedAt: number;
    cleared: boolean;
  }>({
    storeEmpty: false,
    localPopulated: false,
    lastDetectedAt: 0,
    cleared: false
  });
  
  // Function to force clear the React Flow canvas
  const forceVisualClear = useCallback(() => {
    // Check if we've already cleared this exact version to prevent cycles
    const now = Date.now();
    const timeSinceLastClear = now - lastClearedVersion.current;
    
    // Skip if we've cleared recently (within 500ms) to prevent rapid loops
    if (timeSinceLastClear < 500 && emptyFlowState.current.cleared) {
      console.log(`[FlowSync] 🛑 Skipping redundant clear - already cleared ${timeSinceLastClear}ms ago`);
      return;
    }
    
    console.warn('[FlowSync] 🧼 Forcing visual clear of React Flow canvas');
    
    // First, ensure we have new array references
    const emptyNodes = Array.from([]);
    const emptyEdges = Array.from([]);
    
    // Reset in current tick
    setLocalNodes(emptyNodes);
    setLocalEdges(emptyEdges);
    
    // Also clear in next microtask to ensure React Flow internal state is reset
    // but only if we haven't already cleared in this version
    queueMicrotask(() => {
      setLocalNodes([...emptyNodes]); // Use spread to create new reference
      setLocalEdges([...emptyEdges]);
      hasPendingStructuralChanges.current = false;
    });
    
    // Update our reset key only once per clear operation
    flowResetKey.current = now;
    // Mark this version as cleared to prevent redundant operations
    lastClearedVersion.current = now;
    // Update state tracking
    emptyFlowState.current = {
      ...emptyFlowState.current,
      lastDetectedAt: now,
      cleared: true
    };
    
    // Clear pending changes flag
    hasPendingStructuralChanges.current = false;
    
    console.log('[FlowSync] 🧹 Local state cleared with new reset key:', flowResetKey.current);
  }, [setLocalNodes, setLocalEdges, hasPendingStructuralChanges]);
  
  // Detect empty flow state - runs only when counts change to minimize effect calls
  useEffect(() => {
    // Only check when counts change to reduce effect runs
    const storeState = useFlowStructureStore.getState();
    const isStoreEmpty = storeState.nodes.length === 0 && storeState.edges.length === 0;
    const hasLocalContent = localNodes.length > 0 || localEdges.length > 0;
    
    // Update our current state tracking
    const previousState = { ...emptyFlowState.current };
    emptyFlowState.current = {
      storeEmpty: isStoreEmpty,
      localPopulated: hasLocalContent,
      lastDetectedAt: previousState.lastDetectedAt,
      cleared: previousState.cleared
    };
    
    // Only log and act when the state actually changes
    const stateChanged = 
      previousState.storeEmpty !== isStoreEmpty || 
      previousState.localPopulated !== hasLocalContent;
    
    if (stateChanged) {
      // Log once when state changes, not every render
      if (isStoreEmpty && hasLocalContent) {
        console.warn(`[FlowSync] 🔴 Empty flow detected - store empty but local state has content`);
      } else if (isStoreEmpty && !hasLocalContent) {
        console.log(`[FlowSync] ✅ Empty flow state consistent - both store and local are empty`);
        // Reset cleared flag to allow future clears
        emptyFlowState.current.cleared = false;
      }
    }
  }, [
    localNodes.length, 
    localEdges.length
  ]);
  
  // Handle clearing - separate from detection to prevent clearing on every render
  useEffect(() => {
    const { storeEmpty, localPopulated, cleared } = emptyFlowState.current;
    
    // Only clear if:
    // 1. Store is empty
    // 2. Local state has content
    // 3. We haven't already cleared this exact version
    if (storeEmpty && localPopulated && !cleared) {
      // Use setTimeout to debounce and prevent multiple clears in one tick
      const timeoutId = setTimeout(() => {
        // Double-check state hasn't changed before applying
        if (emptyFlowState.current.storeEmpty && emptyFlowState.current.localPopulated) {
          forceVisualClear();
        }
      }, 50); // Small delay to debounce
      
      return () => clearTimeout(timeoutId);
    }
  }, [
    emptyFlowState.current.storeEmpty,
    emptyFlowState.current.localPopulated,
    emptyFlowState.current.cleared,
    forceVisualClear
  ]);
  
  // Track specific store empty changes from Zustand to detect new flows being created
  useEffect(() => {
    const storeState = useFlowStructureStore.getState();
    const isStoreEmpty = storeState.nodes.length === 0 && storeState.edges.length === 0;
    
    // Only act on transitions to empty state (e.g., new flow creation)
    if (isStoreEmpty && !emptyFlowState.current.storeEmpty) {
      console.log('[FlowSync] 🆕 Zustand store transitioned to empty state (possible new flow creation)');
      emptyFlowState.current.storeEmpty = true;
      
      // If local has content and we haven't cleared, schedule a clear
      if (localNodes.length > 0 || localEdges.length > 0) {
        emptyFlowState.current.localPopulated = true;
        
        // Only if not already cleared recently
        if (!emptyFlowState.current.cleared) {
          console.warn('[FlowSync] 🔄 Scheduling canvas clear due to store empty transition');
          // Delay slightly to avoid multiple clears
          setTimeout(() => forceVisualClear(), 50);
        }
      }
    }
    // Track transitions away from empty to allow future clears
    else if (!isStoreEmpty && emptyFlowState.current.storeEmpty) {
      console.log('[FlowSync] ⬆️ Zustand store transitioned from empty to populated');
      emptyFlowState.current = {
        storeEmpty: false,
        localPopulated: localNodes.length > 0 || localEdges.length > 0,
        lastDetectedAt: Date.now(),
        cleared: false // Reset cleared state to allow future clearing
      };
    }
  }, [
    useFlowStructureStore.getState().nodes.length,
    useFlowStructureStore.getState().edges.length,
    localNodes.length,
    localEdges.length,
    forceVisualClear
  ]);
  
  return {
    forceVisualClear,
    flowResetKey: flowResetKey.current
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
  
  // Use the empty flow detector hook
  const { forceVisualClear, flowResetKey } = useEmptyFlowDetector(
    localNodes,
    localEdges,
    setLocalNodes,
    setLocalEdges,
    hasPendingStructuralChanges
  );
  
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
      
      // Check for empty initial state
      if (storeState.nodes.length === 0 && storeState.edges.length === 0) {
        console.log("[FlowSync] Initial state is empty, ensuring clean canvas");
        forceVisualClear();
      } else {
        // The selection sync hook handles selection state normalization
        // We just need to set the edges here
        setLocalEdges([...storeState.edges]); // Use spread to ensure new reference
      }
      
      // Reset flag
      isInitialSyncRef.current = false;
      hasPendingStructuralChanges.current = false;
    }
  }, [zustandNodes, zustandEdges, setLocalEdges, forceVisualClear]);

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

    // Special handling for empty flow - always force a sync with empty arrays
    const isEmptyFlow = storeNodes.length === 0 && storeEdges.length === 0;
    if (isEmptyFlow) {
      console.warn('[FlowSync] 🚨 Empty flow detected in forceSyncFromStore');
      forceVisualClear();
      return;
    }

    // Check for paste operation: store has more nodes than local and selectedNodeIds has values
    const isPossiblePasteOperation = storeNodes.length > localNodes.length && selectedNodeIds.length > 0;
    
    // Skip if nothing significant has changed - EXCEPT for paste operations which must always sync
    const nodeCountDifference = Math.abs(localNodes.length - storeNodes.length);
    const selectionDifference = !hasEqualSelection(localSelectedIds, selectedNodeIds);
    
    if (
      !hasPendingStructuralChanges.current && 
      nodeCountDifference === 0 && 
      !selectionDifference &&
      !isRestoringHistory.current &&
      !isInitialSyncRef.current &&
      !isEmptyFlow &&
      !isPossiblePasteOperation  // Never skip for paste operations
    ) {
      console.log(`[FlowSync] Skipping force sync - no significant differences`);
      return;
    }

    // Log extra details for paste operations
    if (isPossiblePasteOperation) {
      console.warn(`[FlowSync] 📋 Possible paste operation detected - forcing sync`);
      console.log(`[FlowSync] Paste details:`, {
        storeNodeCount: storeNodes.length,
        localNodeCount: localNodes.length,
        difference: storeNodes.length - localNodes.length,
        selectedInStore: selectedNodeIds.length
      });
    }

    console.log(`[FlowSync] Forcing sync from store. History restoring: ${isRestoringHistory.current}`);

    // Sync node structure with proper selection state
    const nodesWithSelection = selectionSync.applyStoreSelectionToNodes(storeNodes);
    
    // Always use spread to create new array references to ensure React Flow updates
    setLocalNodes([...nodesWithSelection]);
    setLocalEdges([...storeEdges]);
    
    // Extra verification of sync after operation, specifically for paste
    if (isPossiblePasteOperation) {
      // Add microtask verification to ensure React Flow gets the update
      queueMicrotask(() => {
        if (localNodes.length !== storeNodes.length) {
          console.warn(`[FlowSync] ⚠️ Sync verification failed - doing emergency re-sync`);
          // Force another update with explicit new references
          setLocalNodes([...nodesWithSelection.map(n => ({...n}))]);
        } else {
          console.log(`[FlowSync] ✅ Sync verification passed - local nodes updated to ${localNodes.length}`);
        }
      });
    }
    
    // Reset pending changes flag
    hasPendingStructuralChanges.current = false;
  }, [localNodes, setLocalNodes, setLocalEdges, isRestoringHistory, selectionSync, forceVisualClear]);

  // Subscribe to external store updates
  useEffect(() => {
    // Skip initial sync phase (initial render). This is handled by the selection sync now
    if (isInitialSyncRef.current) {
      console.log("[FlowSync] Skipping initial store sync, already handled");
      isInitialSyncRef.current = false;
      return;
    }

    // If we're restoring history, always force local state to match store
    if (isRestoringHistory.current) {
      console.log("[FlowSync] History restoration in progress, forcing sync");
      forceSyncFromStore();
      return;
    }

    // Check all meaningful state changes
    const storeState = useFlowStructureStore.getState();
    const zustandNodes = storeState.nodes;
    const zustandEdges = storeState.edges;
    const storeSelectedIds = storeState.selectedNodeIds;
    
    // Check for paste operation: store has more nodes than local
    const isPossiblePasteOperation = zustandNodes.length > localNodes.length;
    
    // IMPORTANT: Check for flow reset/new flow (empty arrays in store)
    const isEmptyFlow = zustandNodes.length === 0 && zustandEdges.length === 0;
    if (isEmptyFlow && (localNodes.length > 0 || localEdges.length > 0)) {
      console.warn("[FlowSync] 🚨 Empty flow detected in store subscription effect");
      forceVisualClear();
      return;
    }
    
    // IMPORTANT: Detect paste operations that need immediate sync
    if (isPossiblePasteOperation) {
      console.warn(`[FlowSync] 📋 Paste operation detected in subscription - node count: ${zustandNodes.length} vs ${localNodes.length}`);
      forceSyncFromStore();
      return;
    }
    
    // IMPORTANT: Debug edges to understand why they disappear
    console.log("[FlowSync] Sync Effect - Edge state:", { 
      localEdgeCount: localEdges.length,
      storeEdgeCount: zustandEdges.length,
      hasPendingChanges: hasPendingStructuralChanges.current,
      emptyFlow: isEmptyFlow,
      possiblePaste: isPossiblePasteOperation
    });
    
    // Check for selection state changes
    const localSelectedIds = localNodes.filter(n => n.selected).map(n => n.id);
    const hasSelectionChanged = !hasEqualSelection(localSelectedIds, storeSelectedIds);
    
    console.log(`[FlowSync] External store updated, checking for changes:`, {
      nodeCount: `${localNodes.length} (local) vs ${zustandNodes.length} (store)`,
      edgeCount: `${localEdges.length} (local) vs ${zustandEdges.length} (store)`,
      selectionChanged: hasSelectionChanged,
      localSelectedIds,
      storeSelectedIds
    });

    const hasNodeCountChanged = localNodes.length !== zustandNodes.length;
    const hasEdgeCountChanged = localEdges.length !== zustandEdges.length;
    const hasNodeContentChanged = !isEqual(localNodes, zustandNodes);
    const hasEdgeContentChanged = !isEqual(localEdges, zustandEdges);
    
    // Only update local if there are meaningful structure changes and no pending local changes
    const shouldForceSync = 
      hasNodeCountChanged || 
      hasEdgeCountChanged || 
      hasNodeContentChanged ||
      hasEdgeContentChanged ||
      isEmptyFlow;
    
    if (shouldForceSync && !hasPendingStructuralChanges.current) {
      console.log(`[FlowSync] Store changed, forcing sync due to structural changes:`, {
        nodeCountChange: hasNodeCountChanged ? `${localNodes.length} -> ${zustandNodes.length}` : false, 
        edgeCountChange: hasEdgeCountChanged ? `${localEdges.length} -> ${zustandEdges.length}` : false,
        nodeContentChanged: hasNodeContentChanged,
        edgeContentChanged: hasEdgeContentChanged,
        emptyFlow: isEmptyFlow
      });
      
      // Force sync to update both structure and selection
      forceSyncFromStore();
    } else if (hasSelectionChanged && !hasPendingStructuralChanges.current) {
      // Just sync selection state if that's the only change
      console.log("[FlowSync] Syncing selection state from store");
      const nodesWithUpdatedSelection = syncVisualSelectionToReactFlow(localNodes, storeSelectedIds);
      
      // IMPORTANT: Also ensure edges are synced when selection state changes
      // This helps prevent edge disappearance issues
      if (hasEdgeCountChanged || !isEqual(localEdges, zustandEdges)) {
        console.log(`[FlowSync] Edge count or content changed during selection sync, updating edges`);
        setLocalEdges([...zustandEdges]);
      }
      
      if (nodesWithUpdatedSelection !== localNodes) {
        console.log(`[FlowSync] Selection state changed, updating ${storeSelectedIds.length} nodes`);
        setLocalNodes(nodesWithUpdatedSelection);
      } else {
        console.log(`[FlowSync] Selection state unchanged despite different IDs - optimization prevented update`);
      }
    } else if (hasPendingStructuralChanges.current) {
      console.log("[FlowSync] Skipping sync from store due to pending local changes");
    } else {
      console.log("[FlowSync] Store changed but no significant differences detected");
      
      // Extra validation to ensure edges stay synced even when other conditions don't trigger
      if (zustandEdges.length > 0 && (localEdges.length === 0 || !isEqual(localEdges, zustandEdges))) {
        console.log("[FlowSync] Edge mismatch detected despite no count changes, force syncing edges");
        setLocalEdges([...zustandEdges]);
      }
    }
    
    // Validate edge sync after effect processing
    setTimeout(() => {
      const currentLocalEdges = localEdges;
      const currentStoreEdges = useFlowStructureStore.getState().edges;
      if (currentLocalEdges.length !== currentStoreEdges.length) {
        console.warn("[FlowSync] Edge count mismatch after sync:", {
          localEdges: currentLocalEdges.length,
          storeEdges: currentStoreEdges.length
        });
      }
    }, 0);
  }, [
    localNodes,
    localEdges,
    setLocalNodes,
    setLocalEdges,
    forceSyncFromStore,
    isRestoringHistory,
    forceVisualClear,
    // Include store state to make the effect reactive to store changes
    useFlowStructureStore.getState().nodes,
    useFlowStructureStore.getState().edges,
    useFlowStructureStore.getState().selectedNodeIds
  ]);

  // Add a dedicated paste operation monitor
  useEffect(() => {
    // This effect specifically watches for changes in store node count that suggest paste operations
    const storeNodes = useFlowStructureStore.getState().nodes;
    
    // Don't run on initial sync
    if (isInitialSyncRef.current) return;
    
    // Check if store has more nodes than local (paste operation)
    if (storeNodes.length > localNodes.length) {
      console.warn(`[FlowSync] 📋 Paste monitor detected node count increase: ${storeNodes.length} (store) vs ${localNodes.length} (local)`);
      
      // Ensure the new nodes are synced to local state
      const timeoutId = setTimeout(() => {
        // Verify if sync still needed after timeout
        if (useFlowStructureStore.getState().nodes.length > localNodes.length) {
          console.warn(`[FlowSync] 🔄 Paste sync verification - forcing sync after delay`);
          forceSyncFromStore();
        }
      }, 50);
      
      return () => clearTimeout(timeoutId);
    }
  }, [
    useFlowStructureStore.getState().nodes.length,
    localNodes.length,
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
    flowResetKey, // Expose the key for ReactFlow component
    selectionHandlers: {
      handleSelectionChange: selectionSync.handleSelectionChange,
      isShiftPressed: selectionSync.isShiftPressed,
      isCtrlPressed: selectionSync.isCtrlPressed,
      getActiveModifierKey: selectionSync.getActiveModifierKey,
      normalizeSelectionState: selectionSync.normalizeSelectionState,
      forceDeselection: selectionSync.forceDeselection
    }
  };
};