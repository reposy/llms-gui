import { useCallback, useEffect, useRef } from 'react';
import { Node } from 'reactflow';
import { NodeData } from '../types/nodes';
import {
  useNodes,
  setNodes as setZustandNodes,
  applyNodeSelection,
  SelectionModifierKey,
  useFlowStructureStore
} from '../store/useFlowStructureStore';
import { syncVisualSelectionToReactFlow, hasEqualSelection, logSelectionChange } from '../utils/selectionUtils';
import { isEqual } from 'lodash';

interface UseSelectionSyncOptions {
  localNodes: Node<NodeData>[];
  setLocalNodes: React.Dispatch<React.SetStateAction<Node<NodeData>[]>>;
  isRestoringHistory: React.MutableRefObject<boolean>;
}

interface UseSelectionSyncReturn {
  normalizeSelectionState: () => void;
  handleSelectionChange: (selectedNodeIds: string[], modifierKey?: SelectionModifierKey) => void;
  applyStoreSelectionToNodes: (nodes: Node<NodeData>[]) => Node<NodeData>[];
  trackKeyboardModifiers: () => void;
  isShiftPressed: React.MutableRefObject<boolean>;
  isCtrlPressed: React.MutableRefObject<boolean>;
  getActiveModifierKey: () => SelectionModifierKey;
}

// Debug object to track frequent selection updates
const lastSelectionUpdate = {
  time: 0,
  count: 0,
  ids: [] as string[]
};

/**
 * Hook responsible for managing selection state synchronization between
 * ReactFlow's local selection state and the Zustand store.
 */
export const useSelectionSync = ({
  localNodes,
  setLocalNodes,
  isRestoringHistory
}: UseSelectionSyncOptions): UseSelectionSyncReturn => {
  // Get nodes from Zustand for selection sync
  const zustandNodes = useNodes();
  
  // Track initial load
  const isInitialSyncRef = useRef(true);
  
  // Track if normalization is in progress to prevent recursive calls
  const isNormalizing = useRef(false);

  // Track modifier key states
  const isShiftPressed = useRef(false);
  const isCtrlPressed = useRef(false);

  // Helper to determine which modifier key is active
  const getActiveModifierKey = useCallback((): SelectionModifierKey => {
    if (isShiftPressed.current) return 'shift';
    if (isCtrlPressed.current) return 'ctrl';
    return 'none';
  }, []);
  
  // Set up keyboard listeners to track modifier key states
  const trackKeyboardModifiers = useCallback(() => {
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

  /**
   * Applies the selection state from Zustand to the given nodes
   */
  const applyStoreSelectionToNodes = useCallback((nodes: Node<NodeData>[]): Node<NodeData>[] => {
    const storeSelectedIds = useFlowStructureStore.getState().selectedNodeIds;
    return syncVisualSelectionToReactFlow(nodes, storeSelectedIds);
  }, []);

  /**
   * Handle selection changes initiated by ReactFlow
   */
  const handleSelectionChange = useCallback((selectedNodeIds: string[], modifierKey: SelectionModifierKey = 'none') => {
    // Skip if we're in the process of restoring history
    if (isRestoringHistory.current) return;
    
    // Get current selection from Zustand store
    const currentSelection = useFlowStructureStore.getState().selectedNodeIds;
    
    // Check if the selection is actually changing
    const selectionHasChanged = !hasEqualSelection(selectedNodeIds, currentSelection);
      
    // Only update if selection actually changed or if we have multiple selected nodes
    // (multi-node drag operations need consistent selection state)
    if (selectionHasChanged || selectedNodeIds.length > 1) {
      logSelectionChange(
        'Selection changed', 
        currentSelection, 
        selectedNodeIds, 
        { 
          multiSelection: selectedNodeIds.length > 1,
          modifierKey 
        }
      );
      
      // DEBUGGING: Track selection update frequency 
      const now = Date.now();
      if (now - lastSelectionUpdate.time < 500) {
        lastSelectionUpdate.count++;
        if (lastSelectionUpdate.count > 5 && isEqual(lastSelectionUpdate.ids, selectedNodeIds)) {
          console.warn('[Selection] WARNING: Selection updated too frequently with same IDs, possible loop', 
            {lastUpdate: lastSelectionUpdate.time, now, count: lastSelectionUpdate.count});
        }
      } else {
        lastSelectionUpdate.time = now;
        lastSelectionUpdate.count = 1;
        lastSelectionUpdate.ids = selectedNodeIds.length > 0 ? [...selectedNodeIds] : [];
      }
      
      // Apply the selection change to Zustand - this is the SINGLE SOURCE OF TRUTH for selection
      applyNodeSelection(selectedNodeIds, modifierKey);
    } else {
      console.log('[Selection] Selection unchanged, skipping update', {
        selectedNodeIds,
        currentSelection
      });
    }
  }, [isRestoringHistory]);

  /**
   * Normalize selection state between Zustand and ReactFlow
   * This handles initial sync and fixes any mismatches
   */
  const normalizeSelectionState = useCallback(() => {
    // Check if we're already normalizing to prevent recursive calls
    if (isNormalizing.current) {
      console.log("[Selection] Already normalizing, skipping duplicate call");
      return;
    }
    
    // Get current store state
    const storeState = useFlowStructureStore.getState();
    
    // Check for selection state mismatch
    const visiblySelectedNodes = localNodes.filter(node => node.selected);
    const visiblySelectedIds = visiblySelectedNodes.map(n => n.id);
    const storedSelectedIds = storeState.selectedNodeIds;
    
    // Check if visual state already matches store state using our utility
    if (hasEqualSelection(visiblySelectedIds, storedSelectedIds)) {
      console.log("[Selection] Visual selection already matches store, skipping normalization");
      return;
    }
    
    console.log("[Selection] Normalizing selection state between Zustand and ReactFlow");
    
    // Set flag to prevent recursive calls
    isNormalizing.current = true;
    
    const selectionMismatch = 
      (visiblySelectedNodes.length > 0 && storedSelectedIds.length === 0) || 
      (visiblySelectedNodes.length === 0 && storedSelectedIds.length > 0) ||
      !visiblySelectedNodes.every(node => storedSelectedIds.includes(node.id));
    
    if (selectionMismatch) {
      console.warn("[Selection] Selection state mismatch detected", {
        visiblySelectedCount: visiblySelectedNodes.length,
        visiblySelectedIds: visiblySelectedNodes.map(n => n.id),
        storedSelectedIds
      });
    }
    
    // NORMALIZE SELECTION STATE
    let normalizedNodes;
    
    if (storedSelectedIds.length > 0) {
      // Case 1: Apply Zustand's selection state to the nodes
      normalizedNodes = syncVisualSelectionToReactFlow(localNodes, storedSelectedIds);
      console.log("[Selection] Applied Zustand selection state to nodes:", storedSelectedIds);
    } 
    else if (visiblySelectedNodes.length > 0) {
      // Case 2: Clear all visual selections since Zustand has no selection state
      normalizedNodes = syncVisualSelectionToReactFlow(localNodes, []);
      console.log("[Selection] Cleared orphaned visual selections from nodes");
    } 
    else {
      // No selection anywhere, ensure nodes are explicitly marked as unselected
      normalizedNodes = syncVisualSelectionToReactFlow(localNodes, []);
    }
    
    // Update local nodes with normalized selection state
    setLocalNodes(normalizedNodes);
    
    // If we had to make selection changes, sync back to Zustand to ensure consistency
    if (selectionMismatch) {
      // Update Zustand nodes with correct selection state
      setZustandNodes(normalizedNodes);
      
      // If we had visually selected nodes but no Zustand selection, update the selectedNodeIds
      // This ensures selection state is fully consistent
      if (visiblySelectedNodes.length > 0 && storedSelectedIds.length === 0) {
        const selectedIds = visiblySelectedNodes.map(node => node.id);
        applyNodeSelection(selectedIds);
        console.log("[Selection] Updated Zustand selectedNodeIds to match visual selection:", selectedIds);
      }
    }
    
    // Reset the flag after sync is complete
    setTimeout(() => {
      isNormalizing.current = false;
    }, 0);
    
  }, [localNodes, setLocalNodes]);

  // Initial sync on mount
  useEffect(() => {
    if (isInitialSyncRef.current) {
      console.log("[Selection] Initial selection sync");
      normalizeSelectionState();
      isInitialSyncRef.current = false;
    }
  }, [normalizeSelectionState]);

  // Effect for subscribing to Zustand selection changes
  useEffect(() => {
    // Skip first run
    if (isInitialSyncRef.current) return;
    
    // Skip if we're restoring history (handled elsewhere)
    if (isRestoringHistory.current) return;
    
    // Get and memoize the current store selected IDs to avoid reference equality issues
    const storeSelectedIds = [...useFlowStructureStore.getState().selectedNodeIds];
    
    // Check if selection state is different between local and store
    const localSelectedIds = localNodes.filter(n => n.selected).map(n => n.id);
    const selectionChanged = !hasEqualSelection(localSelectedIds, storeSelectedIds);
    
    if (selectionChanged) {
      logSelectionChange(
        'Store selection changed', 
        localSelectedIds, 
        storeSelectedIds
      );
      
      // Use utility function to sync selection state
      const nodesWithSelection = syncVisualSelectionToReactFlow(
        localNodes, 
        storeSelectedIds
      );
      
      setLocalNodes(nodesWithSelection);
    }
  }, [localNodes, setLocalNodes, isRestoringHistory]);
  
  // Add a separate subscription outside the effect to listen for store changes
  useEffect(() => {
    // Create a subscription to selection changes in the store
    const unsubscribe = useFlowStructureStore.subscribe(
      (state) => state.selectedNodeIds,
      (selectedNodeIds) => {
        // Skip if initial sync or restoring history
        if (isInitialSyncRef.current || isRestoringHistory.current) return;
        
        // Trigger the effect to update only when selection actually changes
        const localSelectedIds = localNodes.filter(n => n.selected).map(n => n.id);
        const selectionChanged = !hasEqualSelection(localSelectedIds, selectedNodeIds);
        
        if (selectionChanged) {
          // Use utility function to sync selection state
          const nodesWithSelection = syncVisualSelectionToReactFlow(
            localNodes, 
            selectedNodeIds
          );
          
          setLocalNodes(nodesWithSelection);
        }
      },
      { equalityFn: (prev, next) => isEqual(new Set(prev), new Set(next)) }
    );
    
    return unsubscribe;
  }, [localNodes, setLocalNodes, isRestoringHistory]);

  return {
    normalizeSelectionState,
    handleSelectionChange,
    applyStoreSelectionToNodes,
    trackKeyboardModifiers,
    isShiftPressed,
    isCtrlPressed,
    getActiveModifierKey
  };
}; 