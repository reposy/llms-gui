import { useEffect, useRef, useCallback } from 'react';
import { Node, Edge, useNodesState, useEdgesState, NodeChange, EdgeChange, applyNodeChanges, applyEdgeChanges } from 'reactflow';
import { NodeData } from '../types/nodes';
import { useNodes, useEdges, setNodes as setZustandNodes, setEdges as setZustandEdges } from '../store/useFlowStructureStore';

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
    
    // For position changes, immediately sync to Zustand store to ensure 
    // dragging multiple nodes works consistently
    if (hasPositionChanges) {
      // Delay this slightly to ensure the setLocalNodes has completed
      setTimeout(() => {
        setZustandNodes([...localNodes]);
      }, 0);
    }
    
    hasPendingStructuralChanges.current = true;
    console.log("[FlowSync Structure] Local nodes changed, pending commit.", changes);
  }, [setLocalNodes, localNodes]);

  const onLocalEdgesChange = useCallback((changes: EdgeChange[]) => {
    setLocalEdges((eds) => applyEdgeChanges(changes, eds));
    hasPendingStructuralChanges.current = true;
    console.log("[FlowSync Structure] Local edges changed, pending commit.", changes);
  }, [setLocalEdges]);

  // Function to commit local structural changes to Zustand store
  const commitStructureToStore = useCallback(() => {
    // Check the flag instead of comparing potentially large arrays every time
    if (hasPendingStructuralChanges.current) {
      console.log(`[FlowSync Structure] Committing structural changes to Zustand store`);
      
      // Directly set local state to Zustand store
      // Ensure we're preserving node selection state
      const nodesWithSelection = localNodes.map(node => ({
        ...node,
        selected: node.selected || false // Ensure selection state is explicitly set
      }));
      
      setZustandNodes([...nodesWithSelection]); 
      setZustandEdges([...localEdges]);
      
      // Reset the flag after commit
      hasPendingStructuralChanges.current = false;
    } else {
       console.log("[FlowSync Structure] No pending structural changes to commit.");
    }
  }, [localNodes, localEdges]);
  
  // Function to force a sync from Zustand store to local state
  // Overwrites any uncommitted local structural changes.
  const forceSyncFromStore = useCallback(() => {
    console.log("[FlowSync Structure] Force sync from Zustand store requested. Overwriting local state.");
    setLocalNodes(zustandNodes);
    setLocalEdges(zustandEdges);
    hasPendingStructuralChanges.current = false; // Local state now matches Zustand
    console.log("[FlowSync Structure] Completed force sync from Zustand store to local.");
  }, [zustandNodes, zustandEdges, setLocalNodes, setLocalEdges]);
  
  // Initial sync on mount
  useEffect(() => {
    if (isInitialSyncRef.current) {
      console.log("[FlowSync Structure] Initial sync from Zustand store");
      setLocalNodes(zustandNodes);
      setLocalEdges(zustandEdges);
      isInitialSyncRef.current = false;
      hasPendingStructuralChanges.current = false;
    }
  }, [zustandNodes, zustandEdges, setLocalNodes, setLocalEdges]); // Dependencies ensure initial sync happens
  
  // Handle external Zustand store updates (e.g., from history restore, or potentially collaboration later)
  useEffect(() => {
    // Skip initial sync phase
    if (isInitialSyncRef.current) {
        return;
    }

    // If restoring history, force local state to match Zustand store
    if (isRestoringHistory.current) {
      console.log("[FlowSync Structure] Syncing local state from Zustand store due to history restoration.");
      setLocalNodes(zustandNodes);
      setLocalEdges(zustandEdges);
      hasPendingStructuralChanges.current = false;
      return;
    }

    // Check if there's a meaningful difference before updating
    const nodesChanged = zustandNodes.length !== localNodes.length;
    const edgesChanged = zustandEdges.length !== localEdges.length;

    // Special case: when Zustand nodes and edges are empty (new flow creation)
    // immediately sync this to local state
    if (zustandNodes.length === 0 && zustandEdges.length === 0 && (localNodes.length > 0 || localEdges.length > 0)) {
      console.log("[FlowSync Structure] Detected empty Zustand state (new flow). Clearing local state.");
      setLocalNodes([]);
      setLocalEdges([]);
      hasPendingStructuralChanges.current = false;
      return;
    }

    // Only update if there's a meaningful change and we're not in the middle of editing
    if ((nodesChanged || edgesChanged) && !hasPendingStructuralChanges.current) {
      console.log("[FlowSync Structure] Detected Zustand state change, updating local state");
      setLocalNodes(zustandNodes);
      setLocalEdges(zustandEdges);
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
    forceSyncFromStore,
    commitStructureToStore
  };
}; 