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
  forceDeselection: () => void;
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
    
    // Special handling for deselection (empty selection)
    const isDeselection = selectedNodeIds.length === 0 && currentSelection.length > 0;
      
    // Only update if selection actually changed or if we have multiple selected nodes
    // (multi-node drag operations need consistent selection state)
    if (selectionHasChanged || selectedNodeIds.length > 1) {
      logSelectionChange(
        isDeselection ? 'Deselection' : 'Selection changed', 
        currentSelection, 
        selectedNodeIds, 
        { 
          multiSelection: selectedNodeIds.length > 1,
          modifierKey,
          isDeselection
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
      
      // For deselection, ensure we force a normalization after the state update
      if (isDeselection) {
        // We need to schedule this after the current execution to allow Zustand to update
        setTimeout(() => {
          normalizeSelectionState();
        }, 0);
      }
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
    
    console.log("[Selection] Normalizing selection state between Zustand and ReactFlow", {
      visiblySelected: visiblySelectedIds,
      storedSelected: storedSelectedIds
    });
    
    // Set flag to prevent recursive calls
    isNormalizing.current = true;
    
    // Check for critical deselection scenario: Zustand empty but ReactFlow has selections
    const deselectScenario = storedSelectedIds.length === 0 && visiblySelectedNodes.length > 0;
    
    const selectionMismatch = 
      (visiblySelectedNodes.length > 0 && storedSelectedIds.length === 0) || 
      (visiblySelectedNodes.length === 0 && storedSelectedIds.length > 0) ||
      !visiblySelectedNodes.every(node => storedSelectedIds.includes(node.id));
    
    if (selectionMismatch) {
      // DEBUGGING: Track when selection mismatches occur
      const now = Date.now();
      if (now - lastSelectionUpdate.time < 100) {
        lastSelectionUpdate.count++;
        console.warn("[Selection] Multiple selection mismatches in quick succession", {
          count: lastSelectionUpdate.count,
          timeSinceLast: now - lastSelectionUpdate.time
        });
      } else {
        lastSelectionUpdate.time = now;
        lastSelectionUpdate.count = 1;
      }
      
      console.warn("[Selection] Selection state mismatch detected", {
        visiblySelectedCount: visiblySelectedNodes.length,
        visiblySelectedIds,
        storedSelectedIds,
        deselectScenario
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
      // This is the critical deselection scenario we need to address
      normalizedNodes = syncVisualSelectionToReactFlow(localNodes, []);
      console.log("[Selection] Cleared orphaned visual selections from nodes (deselect scenario)");
    } 
    else {
      // No selection anywhere, ensure nodes are explicitly marked as unselected
      normalizedNodes = syncVisualSelectionToReactFlow(localNodes, []);
    }
    
    // Only update local nodes if we actually got a new array (indicating changes)
    // syncVisualSelectionToReactFlow only returns a new array if changes are needed
    if (normalizedNodes !== localNodes) {
      console.log("[Selection] Updated local nodes with normalized selection state");
      
      // If we're in the deselection scenario, we need to ensure the update 
      // is prioritized and not batched with other updates
      if (deselectScenario) {
        // Use immediate update for deselection to prevent desync
        Promise.resolve().then(() => {
          setLocalNodes(normalizedNodes);
          console.log("[Selection] Forced immediate deselection update");
        });
      } else {
        setLocalNodes(normalizedNodes);
      }
      
      // If we had to make selection changes, sync back to Zustand to ensure consistency
      if (selectionMismatch) {
        // Update Zustand nodes with correct selection state
        setZustandNodes(normalizedNodes);
        
        // If we had visually selected nodes but no Zustand selection, update the selectedNodeIds
        // This ensures selection state is fully consistent
        if (visiblySelectedNodes.length > 0 && storedSelectedIds.length === 0) {
          // Only update Zustand if we're not in deselection scenario
          // If we are in deselection, we want Zustand's empty state to win
          if (!deselectScenario) {
            const selectedIds = visiblySelectedNodes.map(node => node.id);
            applyNodeSelection(selectedIds);
            console.log("[Selection] Updated Zustand selectedNodeIds to match visual selection:", selectedIds);
          }
        }
      }
    } else {
      console.log("[Selection] No actual selection changes needed, skipping setLocalNodes");
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

  // Add a separate subscription outside the effect to listen for store changes
  useEffect(() => {
    let prevSelectedNodeIds: string[] = [];
    
    // Create a subscription to store changes
    const unsubscribe = useFlowStructureStore.subscribe((state) => {
      // Skip if initial sync or restoring history
      if (isInitialSyncRef.current || isRestoringHistory.current) return;
      
      const storeSelectedIds = state.selectedNodeIds;
      
      // Check if selection has changed from previous state
      if (!hasEqualSelection(prevSelectedNodeIds, storeSelectedIds)) {
        // Save current selection for next comparison
        prevSelectedNodeIds = [...storeSelectedIds];
        
        // Compare with local node selection
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
          
          // Only update if the sync actually changed nodes
          if (nodesWithSelection !== localNodes) {
            console.log("[Selection] Store subscription: updating local nodes with new selection state");
            setLocalNodes(nodesWithSelection);
          } else {
            console.log("[Selection] Store subscription: selection state already matches, skipping update");
          }
        }
      }
    });
    
    return unsubscribe;
  }, [localNodes, setLocalNodes, isRestoringHistory]);

  /**
   * Force deselection of all nodes
   * Use this when clicking on empty canvas space or explicitly clearing selection
   */
  const forceDeselection = useCallback(() => {
    const currentSelection = useFlowStructureStore.getState().selectedNodeIds;
    
    if (currentSelection.length > 0) {
      console.log('[Selection] Forcing deselection of all nodes', { previous: currentSelection });
      
      // Update Zustand store to clear selection
      applyNodeSelection([]);
      
      // Ensure the visual state is also updated
      if (localNodes.some(node => node.selected)) {
        const deselectedNodes = syncVisualSelectionToReactFlow(localNodes, []);
        
        if (deselectedNodes !== localNodes) {
          console.log('[Selection] Explicitly updating ReactFlow local state to clear selection');
          
          // Use immediate update for deselection to prevent desync
          Promise.resolve().then(() => {
            setLocalNodes(deselectedNodes);
          });
        }
      }
    }
  }, [localNodes, setLocalNodes]);

  return {
    normalizeSelectionState,
    handleSelectionChange,
    applyStoreSelectionToNodes,
    trackKeyboardModifiers,
    isShiftPressed,
    isCtrlPressed,
    getActiveModifierKey,
    forceDeselection
  };
}; 