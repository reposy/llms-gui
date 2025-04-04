import { useEffect, useRef, useCallback } from 'react';
import { Node, Edge, useNodesState, useEdgesState } from 'reactflow';
import { NodeData } from '../types/nodes';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { isEqual } from 'lodash';

// Global ref to track which node is currently being edited
// This is needed to prevent Redux state from overriding local state during user input
/**
 * A global reference to track which node is currently being edited.
 * 
 * IMPORTANT: This reference is used to prevent the useFlowSync hook from
 * overwriting local node state with Redux state during active user editing.
 * This solves UX issues where typing in fields could be interrupted or lost.
 * 
 * Usage guidelines:
 * 1. Set this ref to the node ID when a field is focused or during IME composition
 *    Example: isEditingNodeRef.current = nodeId;
 * 
 * 2. Clear this ref when editing is complete (on blur or composition end)
 *    Example: isEditingNodeRef.current = null;
 * 
 * 3. Any component that manages editable fields should handle these focus/blur events
 *    to properly maintain this reference.
 */
export const isEditingNodeRef = {
  current: null as string | null // nodeId of the node that's being edited
};

/**
 * Trigger for forcing a complete sync from Redux to local state
 * Used after importing or other operations where full sync is required
 */
export const triggerForceSync = {
  current: false
};

interface UseFlowSyncOptions {
  isRestoringHistory: React.MutableRefObject<boolean>;
}

interface UseFlowSyncReturn {
  localNodes: Node<NodeData>[];
  localEdges: Edge[];
  setLocalNodes: React.Dispatch<React.SetStateAction<Node<NodeData>[]>>;
  setLocalEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  onLocalNodesChange: (changes: any) => void;
  onLocalEdgesChange: (changes: any) => void;
  forceSync: () => void; // New function to force sync
}

// Helper function to compare nodes by their essential properties
const areNodesEquivalent = (localNodes: Node<NodeData>[], reduxNodes: Node<NodeData>[]) => {
  if (localNodes.length !== reduxNodes.length) return false;
  
  // Create a map of Redux nodes by ID for quick lookup
  const reduxNodesMap = new Map(reduxNodes.map(node => [node.id, node]));
  
  // Check if each local node exists in Redux with the same essential properties
  return localNodes.every(localNode => {
    const reduxNode = reduxNodesMap.get(localNode.id);
    if (!reduxNode) return false;
    
    // Compare only essential properties (id, position, data)
    return (
      localNode.id === reduxNode.id &&
      isEqual(localNode.position, reduxNode.position) &&
      isEqual(localNode.data, reduxNode.data)
    );
  });
};

export const useFlowSync = ({ 
  isRestoringHistory 
}: UseFlowSyncOptions): UseFlowSyncReturn => {
  const dispatch = useDispatch();
  
  // Get initial data from Redux
  const initialNodes = useSelector((state: RootState) => state.flow.nodes);
  const initialEdges = useSelector((state: RootState) => state.flow.edges);
  
  // Set up local state with React Flow hooks
  const [localNodes, setLocalNodes, onLocalNodesChange] = useNodesState(initialNodes);
  const [localEdges, setLocalEdges, onLocalEdgesChange] = useEdgesState(initialEdges);
  
  // Track the previous count of nodes to detect additions
  const prevNodeCountRef = useRef(initialNodes.length);
  
  // Add a ref to track the last sync time to prevent rapid re-renders
  const lastSyncTimeRef = useRef(Date.now());

  // Track if this is initial load
  const isInitialSyncRef = useRef(true);
  
  // Function to force a complete sync from Redux to local
  const forceSync = useCallback(() => {
    console.log("[Sync Effect] Force sync requested");
    triggerForceSync.current = true;
    // Immediate sync attempt
    setLocalNodes(initialNodes);
    setLocalEdges(initialEdges);
    lastSyncTimeRef.current = Date.now();
  }, [initialNodes, initialEdges, setLocalNodes, setLocalEdges]);

  // Initial sync effect specifically for first load or data import
  useEffect(() => {
    if (isInitialSyncRef.current) {
      console.log("[Sync Effect] Initial sync");
      setLocalNodes(initialNodes);
      setLocalEdges(initialEdges);
      isInitialSyncRef.current = false;
    }
  }, [initialNodes, initialEdges, setLocalNodes, setLocalEdges]);
  
  // Sync Redux state -> local state (for external changes)
  useEffect(() => {
    // Skip if we're currently restoring history to avoid feedback loops
    if (isRestoringHistory.current) return;
    
    // Throttle updates more aggressively (300ms minimum between syncs) to reduce interaction issues
    const now = Date.now();
    if (now - lastSyncTimeRef.current < 300 && !triggerForceSync.current) return;
    
    // Check if we just added a new node locally (local has more nodes than Redux)
    const localAdded = localNodes.length > initialNodes.length;
    
    // Use the custom comparison function instead of deep equality
    const nodesEquivalent = areNodesEquivalent(localNodes, initialNodes);
    
    // Handle force sync first
    if (triggerForceSync.current) {
      console.log("[Sync Effect] Processing force sync");
      setLocalNodes(initialNodes);
      setLocalEdges(initialEdges);
      lastSyncTimeRef.current = now;
      triggerForceSync.current = false;
      return;
    }

    // Only update from Redux if:
    // 1. Not just added nodes locally
    // 2. Nodes are not equivalent
    // 3. The currently edited node (if any) is preserved
    if (!localAdded && !nodesEquivalent) {
      console.log("[Sync Effect] Updating local nodes from Redux");
      
      // If a node is currently being edited, we need to preserve its state
      if (isEditingNodeRef.current) {
        const editingNodeId = isEditingNodeRef.current;
        console.log(`[Sync Effect] Preserving state for currently editing node: ${editingNodeId}`);
        
        // Find the node being edited in local state
        const localEditingNode = localNodes.find(node => node.id === editingNodeId);
        
        if (localEditingNode) {
          console.log(`[Sync Effect] Found editing node in local state`, {
            nodeId: localEditingNode.id,
            type: localEditingNode.data.type,
            nodeData: localEditingNode.data
          });
        } else {
          console.warn(`[Sync Effect] Editing node ${editingNodeId} not found in local state`);
        }
        
        // Update all nodes except the one being edited
        const updatedNodes = initialNodes.map(reduxNode => {
          if (reduxNode.id === editingNodeId && localEditingNode) {
            // Keep the local state for the editing node
            return localEditingNode;
          }
          return reduxNode;
        });
        
        setLocalNodes(updatedNodes);
      } else {
        // No node is being edited, we can safely update all nodes
        console.log("[Sync Effect] No node is being edited, updating all nodes");
        setLocalNodes(initialNodes);
      }
      
      lastSyncTimeRef.current = now;
    }
    
    // Update the previous node count reference
    prevNodeCountRef.current = initialNodes.length;
  }, [initialNodes, setLocalNodes, localNodes, isRestoringHistory]);

  // Handle edge syncing separately with similar logic
  useEffect(() => {
    // Skip if we're currently restoring history to avoid feedback loops
    if (isRestoringHistory.current) return;
    
    // Skip if we just processed a force sync
    if (triggerForceSync.current) return;
    
    // Throttle updates more aggressively
    const now = Date.now();
    if (now - lastSyncTimeRef.current < 300) return;
    
    // Edges are less likely to cause editing conflicts, but still apply throttling
    if (!isEqual(localEdges, initialEdges)) {
      console.log("[Sync Effect] Updating local edges from Redux");
      setLocalEdges(initialEdges);
      lastSyncTimeRef.current = now;
    }
  }, [initialEdges, setLocalEdges, localEdges, isRestoringHistory]);
  
  return {
    localNodes,
    localEdges,
    setLocalNodes,
    setLocalEdges,
    onLocalNodesChange,
    onLocalEdgesChange,
    forceSync
  };
}; 