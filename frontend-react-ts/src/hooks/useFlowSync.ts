import { useEffect, useRef } from 'react';
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
  
  // Sync Redux state -> local state (for initial load or external changes)
  useEffect(() => {
    // Skip if we're currently restoring history to avoid feedback loops
    if (isRestoringHistory.current) return;
    
    // Throttle updates to prevent rapid re-renders (150ms minimum between syncs)
    const now = Date.now();
    if (now - lastSyncTimeRef.current < 150) return;
    
    // Check if we just added a new node locally (local has more nodes than Redux)
    const localAdded = localNodes.length > initialNodes.length;
    
    // Use the custom comparison function instead of deep equality
    const nodesEquivalent = areNodesEquivalent(localNodes, initialNodes);
    
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

  useEffect(() => {
    // Skip if we're currently restoring history to avoid feedback loops
    if (isRestoringHistory.current) return;
    
    // Throttle updates
    const now = Date.now();
    if (now - lastSyncTimeRef.current < 150) return;
    
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
    onLocalEdgesChange
  };
}; 