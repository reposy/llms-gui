import { useEffect, useRef, useCallback } from 'react';
import { Node, Edge, useNodesState, useEdgesState, NodeChange, EdgeChange, applyNodeChanges, applyEdgeChanges } from 'reactflow';
import { NodeData } from '../types/nodes';
import { 
  useNodes, 
  useEdges, 
  setNodes as setZustandNodes, 
  setEdges as setZustandEdges, 
  applyNodeSelection,
  SelectionModifierKey,
  useFlowStructureStore
} from '../store/useFlowStructureStore';
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
  forceSyncFromStore: () => void;
  commitStructureToStore: () => void;
}

/**
 * Hook responsible for synchronizing the *structure* (nodes, edges, positions) 
 * between React Flow's local state and the Zustand store.
 * Content synchronization is handled separately (e.g., by useManagedNodeContent).
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
  
  // Add refs to track modifier key states
  const isShiftPressed = useRef(false);
  const isCtrlPressed = useRef(false);
  
  // Helper to determine which modifier key is active
  const getActiveModifierKey = (): SelectionModifierKey => {
    if (isShiftPressed.current) return 'shift';
    if (isCtrlPressed.current) return 'ctrl';
    return 'none';
  };
  
  // Set up keyboard listeners to track modifier key states
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        isShiftPressed.current = true;
      }
      if (e.key === 'Control' || e.key === 'Meta') { // Meta for Mac
        isCtrlPressed.current = true;
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        isShiftPressed.current = false;
      }
      if (e.key === 'Control' || e.key === 'Meta') { // Meta for Mac
        isCtrlPressed.current = false;
      }
    };
    
    // Handle focus/blur events to reset modifier states when window loses focus
    const handleBlur = () => {
      isShiftPressed.current = false;
      isCtrlPressed.current = false;
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
        console.log(`[onLocalNodesChange] Multi-selection drag in progress - ${positionChanges.length} position changes for ${selectedNodeCount} selected nodes`);
        
        // Just mark that structural changes are pending - the actual Zustand sync
        // will happen in handleSelectionDragStop
        hasPendingStructuralChanges.current = true;
      }
    }
    
    // Let useNodeHandlers handle selection changes, to avoid double processing
    // This helps prevent infinite loops
    if (selectionChanges.length > 0 && positionChanges.length === 0) {
      console.log(`[onLocalNodesChange] Selection-only changes, handled by useNodeHandlers`);
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
    console.log("[FlowSync Structure] Local edges changed, pending commit.", changes);
  }, [setLocalEdges]);

  // Function to commit local structural changes to Zustand store
  const commitStructureToStore = useCallback(() => {
    // Skip if we're currently restoring history
    if (isRestoringHistory.current) {
      console.log("[FlowSync Structure] Skipping commit during history restoration");
      return;
    }
    
    // Check the flag instead of comparing potentially large arrays every time
    if (hasPendingStructuralChanges.current) {
      console.log(`[FlowSync Structure] Committing structural changes to Zustand store`);
      
      // Get the current state from the store
      const storeState = useFlowStructureStore.getState();
      
      // Ensure we're preserving node selection state by explicitly checking each node
      const nodesWithSelection = localNodes.map(node => {
        // Get this node's ID
        const nodeId = node.id;
        
        // Check if this node should be selected based on Zustand's selectedNodeIds
        const shouldBeSelected = storeState.selectedNodeIds.includes(nodeId);
        
        // If the selection state is different from current, update it
        if (shouldBeSelected !== !!node.selected) {
          return { ...node, selected: shouldBeSelected };
        }
        
        // Otherwise return the node as is (with explicit selection state)
        return { 
          ...node, 
          selected: !!node.selected // Ensure selection state is explicitly set
        };
      });
      
      // Check if nodes or edges actually changed before updating
      const nodesChanged = !isEqual(nodesWithSelection, storeState.nodes);
      const edgesChanged = !isEqual(localEdges, storeState.edges);
      
      // Only update what's needed
      if (nodesChanged) {
        console.log('[FlowSync Structure] Updating nodes with selection state');
        setZustandNodes([...nodesWithSelection]);
      }
      
      if (edgesChanged) {
        setZustandEdges([...localEdges]);
      }
      
      if (nodesChanged || edgesChanged) {
        console.log(`[FlowSync Structure] Updated store: nodes changed=${nodesChanged}, edges changed=${edgesChanged}`);
      } else {
        console.log(`[FlowSync Structure] No actual changes detected, skipping store update`);
      }
      
      // Reset the flag after commit
      hasPendingStructuralChanges.current = false;
    } else {
      console.log("[FlowSync Structure] No pending structural changes to commit.");
    }
  }, [localNodes, localEdges, isRestoringHistory]);

  // Function to force a sync from Zustand store to local state
  // Overwrites any uncommitted local structural changes.
  const forceSyncFromStore = useCallback(() => {
    console.log("[FlowSync Structure] Force sync from Zustand store requested");
    
    // Get current store state
    const storeState = useFlowStructureStore.getState();
    
    // Check for visual selection state in local nodes
    const localSelectedNodes = localNodes.filter(node => node.selected);
    const localSelectedIds = localSelectedNodes.map(node => node.id);
    
    // Get Zustand's selection state
    const zustandSelectedIds = storeState.selectedNodeIds;
    
    // Detect selection state mismatch
    const selectionMismatch = !isEqual(new Set(localSelectedIds), new Set(zustandSelectedIds));
    
    // Check if we have significant differences before syncing
    // This helps prevent infinite loops, especially after paste operations
    const hasNodeCountChange = localNodes.length !== storeState.nodes.length;
    const hasEdgeCountChange = localEdges.length !== storeState.edges.length;
    const hasPendingChanges = hasPendingStructuralChanges.current;
    
    if (hasNodeCountChange || hasEdgeCountChange || selectionMismatch || hasPendingChanges) {
      console.log("[FlowSync Structure] Syncing due to detected differences:", {
        hasNodeCountChange,
        hasEdgeCountChange,
        selectionMismatch,
        hasPendingChanges
      });
      
      // Always normalize selection state using Zustand's selection as the source of truth
      const normalizedNodes = storeState.nodes.map(node => ({
        ...node,
        selected: zustandSelectedIds.includes(node.id)
      }));
      
      // Log selection changes for debugging
      if (selectionMismatch) {
        console.log("[FlowSync Structure] Normalized selection state during force sync:", {
          before: localSelectedIds,
          after: zustandSelectedIds
        });
      }
      
      // Set local state from store with normalized selection
      setLocalNodes(normalizedNodes);
      setLocalEdges(storeState.edges);
      
      // Reset flag as local state now matches Zustand
      hasPendingStructuralChanges.current = false;
      
      console.log("[FlowSync Structure] Completed force sync from Zustand store to local");
    } else {
      console.log("[FlowSync Structure] Skipping sync, no significant differences detected");
    }
  }, [localNodes, localEdges, setLocalNodes, setLocalEdges]);

  // Initial sync on mount
  useEffect(() => {
    if (isInitialSyncRef.current) {
      console.log("[FlowSync Structure] Initial sync from Zustand store");
      
      // Get current store state
      const storeState = useFlowStructureStore.getState();
      
      // Check for selection state mismatch on initial load
      const visiblySelectedNodes = storeState.nodes.filter(node => node.selected);
      const storedSelectedIds = storeState.selectedNodeIds;
      
      const selectionMismatch = 
        (visiblySelectedNodes.length > 0 && storedSelectedIds.length === 0) || 
        (visiblySelectedNodes.length === 0 && storedSelectedIds.length > 0) ||
        !visiblySelectedNodes.every(node => storedSelectedIds.includes(node.id));
      
      if (selectionMismatch) {
        console.warn("[FlowSync Structure] Selection state mismatch detected on initial load", {
          visiblySelectedCount: visiblySelectedNodes.length,
          visiblySelectedIds: visiblySelectedNodes.map(n => n.id),
          storedSelectedIds
        });
      }
      
      // NORMALIZE SELECTION STATE:
      // 1. If Zustand has selectedNodeIds, apply them to node.selected flags
      // 2. If Zustand has no selection but nodes have visual selection, clear it
      
      let normalizedNodes;
      if (storedSelectedIds.length > 0) {
        // Case 1: Apply Zustand's selection state to the nodes
        normalizedNodes = storeState.nodes.map(node => ({
          ...node,
          selected: storedSelectedIds.includes(node.id)
        }));
        
        console.log("[FlowSync Structure] Applied Zustand selection state to nodes:", storedSelectedIds);
      } else if (visiblySelectedNodes.length > 0) {
        // Case 2: Clear all visual selections since Zustand has no selection state
        normalizedNodes = storeState.nodes.map(node => ({
          ...node,
          selected: false
        }));
        
        console.log("[FlowSync Structure] Cleared orphaned visual selections from nodes");
      } else {
        // No selection anywhere, ensure nodes are explicitly marked as unselected
        normalizedNodes = storeState.nodes.map(node => ({
          ...node,
          selected: false
        }));
      }
      
      // Initial sync with normalized selection state
      setLocalNodes(normalizedNodes);
      setLocalEdges(storeState.edges);
      
      // If we had to make selection changes, sync back to Zustand to ensure consistency
      if (selectionMismatch) {
        // Update Zustand nodes with correct selection state
        setZustandNodes(normalizedNodes);
        
        // If we had visually selected nodes but no Zustand selection, update the selectedNodeIds
        // This ensures selection state is fully consistent
        if (visiblySelectedNodes.length > 0 && storedSelectedIds.length === 0) {
          const selectedIds = visiblySelectedNodes.map(node => node.id);
          applyNodeSelection(selectedIds);
          console.log("[FlowSync Structure] Updated Zustand selectedNodeIds to match visual selection:", selectedIds);
        }
      }
      
      // Reset flags
      isInitialSyncRef.current = false;
      hasPendingStructuralChanges.current = false;
    }
  }, [zustandNodes, zustandEdges, setLocalNodes, setLocalEdges]);

  // Handle external Zustand store updates (e.g., from history restore, or potentially collaboration later)
  useEffect(() => {
    // Skip initial sync phase
    if (isInitialSyncRef.current) {
      return;
    }

    // If restoring history, force local state to match Zustand store
    if (isRestoringHistory.current) {
      console.log("[FlowSync Structure] Syncing local state from Zustand store due to history restoration");
      
      // Get current store state
      const storeState = useFlowStructureStore.getState();
      
      // Similar to initial load, ensure selection state is fully normalized
      // during history restoration to prevent any mismatch
      const storedSelectedIds = storeState.selectedNodeIds;
      
      // When restoring history, we're stricter - always apply Zustand's selection state
      // rather than checking for mismatches first
      const normalizedNodes = storeState.nodes.map(node => ({
        ...node,
        selected: storedSelectedIds.includes(node.id)
      }));
      
      console.log("[FlowSync Structure] Normalized selection during history restoration:", {
        selectedCount: storedSelectedIds.length,
        selectedIds: storedSelectedIds
      });
      
      // Sync from store with explicit selection state
      setLocalNodes(normalizedNodes);
      setLocalEdges(storeState.edges);
      
      hasPendingStructuralChanges.current = false;
      return;
    }

    // Compare selection state between local and Zustand
    const localSelectedIds = localNodes.filter(node => node.selected).map(node => node.id);
    const zustandSelectedIds = useFlowStructureStore.getState().selectedNodeIds;
    
    // Check if there are meaningful structure changes
    const hasNodeCountChange = zustandNodes.length !== localNodes.length;
    const hasEdgeCountChange = zustandEdges.length !== localEdges.length;
    
    // Selection changes need special handling to avoid loops
    const hasSelectionChange = !isEqual(new Set(localSelectedIds), new Set(zustandSelectedIds));

    // Special case: when Zustand nodes and edges are empty (new flow creation)
    // immediately sync this to local state
    if (zustandNodes.length === 0 && zustandEdges.length === 0 && (localNodes.length > 0 || localEdges.length > 0)) {
      console.log("[FlowSync Structure] Detected empty Zustand state (new flow). Clearing local state");
      setLocalNodes([]);
      setLocalEdges([]);
      hasPendingStructuralChanges.current = false;
      return;
    }

    // Only update if there's a meaningful change and we're not in the middle of editing
    if ((hasNodeCountChange || hasEdgeCountChange || hasSelectionChange) && !hasPendingStructuralChanges.current) {
      console.log("[FlowSync Structure] Detected Zustand state change, updating local state", {
        hasNodeCountChange,
        hasEdgeCountChange,
        hasSelectionChange,
        localSelectedIds,
        zustandSelectedIds
      });
      
      // Get current store state to ensure selection is properly preserved
      const storeState = useFlowStructureStore.getState();
      
      // Always normalize selection state using Zustand as the source of truth
      const normalizedNodes = storeState.nodes.map(node => ({
        ...node,
        selected: storeState.selectedNodeIds.includes(node.id)
      }));
      
      // Update with normalized selection state
      setLocalNodes(normalizedNodes);
      setLocalEdges(storeState.edges);
      
      hasPendingStructuralChanges.current = false;
    }
  }, [zustandNodes, zustandEdges, isRestoringHistory, localNodes, localEdges, setLocalNodes, setLocalEdges]);

  return {
    localNodes,
    localEdges,
    setLocalNodes,
    setLocalEdges,
    onLocalNodesChange,
    onLocalEdgesChange,
    commitStructureToStore,
    forceSyncFromStore
  };
};