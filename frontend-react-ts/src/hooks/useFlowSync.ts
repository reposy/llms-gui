import { useEffect, useRef, useCallback } from 'react';
import { Node, Edge, useNodesState, useEdgesState } from 'reactflow';
import { NodeData } from '../types/nodes';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { setNodes as setReduxNodes, setEdges as setReduxEdges } from '../store/flowSlice';
import { isEqual } from 'lodash';
import { getAllNodeContents, isNodeDirty, NodeContent } from '../store/nodeContentStore';

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
  forceSync: () => void; // Force sync from Redux to local
  commitChanges: () => void; // Commit local changes to Redux
  markNodeDirty: (nodeId: string) => void; // Mark a node as having unsaved changes
  isDirty: (nodeId?: string) => boolean; // Check if a node (or any node) is dirty
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
  
  // Track nodes with unsaved changes (dirty nodes)
  const dirtyNodesRef = useRef(new Set<string>());
  
  // Track if this is initial load
  const isInitialSyncRef = useRef(true);
  
  // Function to mark a node as dirty (has unsaved changes)
  const markNodeDirty = useCallback((nodeId: string) => {
    // Only log if the node isn't already marked as dirty
    if (!dirtyNodesRef.current.has(nodeId)) {
      console.log(`[FlowSync] Node ${nodeId} marked as dirty`);
    }
    dirtyNodesRef.current.add(nodeId);
  }, []);
  
  // Function to check if a node is dirty
  const isDirty = useCallback((nodeId?: string) => {
    if (nodeId) {
      return dirtyNodesRef.current.has(nodeId) || isNodeDirty(nodeId);
    }
    
    // Check both flow sync dirty nodes and node content store dirty nodes
    return dirtyNodesRef.current.size > 0 || Object.entries(getAllNodeContents())
      .some(([_, content]) => content.isDirty);
  }, []);
  
  // Helper to prepare nodes for Redux by merging nodeContentStore with structural data
  const prepareNodesForRedux = useCallback((nodes: Node<NodeData>[]) => {
    const nodeContents = getAllNodeContents();
    
    return nodes.map(node => {
      const nodeContent = nodeContents[node.id];
      
      // If node has dirty content, merge it with the node data
      if (nodeContent && nodeContent.isDirty) {
        // Create a deep copy of node to avoid mutation
        const updatedNode = { ...node, data: { ...node.data } };
        
        // Merge content back into node data based on node type
        switch (node.data.type) {
          case 'llm': {
            const llmData = updatedNode.data as any;
            if (nodeContent.prompt !== undefined) llmData.prompt = nodeContent.prompt;
            if (nodeContent.model !== undefined) llmData.model = nodeContent.model;
            if (nodeContent.temperature !== undefined) llmData.temperature = nodeContent.temperature;
            if (nodeContent.provider !== undefined) llmData.provider = nodeContent.provider;
            if (nodeContent.ollamaUrl !== undefined) llmData.ollamaUrl = nodeContent.ollamaUrl;
            if (nodeContent.label !== undefined) llmData.label = nodeContent.label;
            break;
          }
            
          case 'api': {
            const apiData = updatedNode.data as any;
            if (nodeContent.url !== undefined) apiData.url = nodeContent.url;
            if (nodeContent.method !== undefined) apiData.method = nodeContent.method;
            if (nodeContent.headers !== undefined) apiData.headers = nodeContent.headers;
            if (nodeContent.body !== undefined) apiData.body = nodeContent.body;
            if (nodeContent.queryParams !== undefined) apiData.queryParams = nodeContent.queryParams;
            if (nodeContent.useInputAsBody !== undefined) apiData.useInputAsBody = nodeContent.useInputAsBody;
            if (nodeContent.contentType !== undefined) apiData.contentType = nodeContent.contentType;
            if (nodeContent.bodyFormat !== undefined) apiData.bodyFormat = nodeContent.bodyFormat;
            if (nodeContent.bodyParams !== undefined) apiData.bodyParams = nodeContent.bodyParams;
            if (nodeContent.label !== undefined) apiData.label = nodeContent.label;
            break;
          }
            
          case 'output': {
            const outputData = updatedNode.data as any;
            if (nodeContent.format !== undefined) outputData.format = nodeContent.format;
            if (nodeContent.content !== undefined) outputData.content = nodeContent.content;
            if (nodeContent.label !== undefined) outputData.label = nodeContent.label;
            break;
          }
            
          case 'conditional': {
            const conditionalData = updatedNode.data as any;
            if (nodeContent.conditionType !== undefined) conditionalData.conditionType = nodeContent.conditionType;
            if (nodeContent.conditionValue !== undefined) conditionalData.conditionValue = nodeContent.conditionValue;
            if (nodeContent.label !== undefined) conditionalData.label = nodeContent.label;
            break;
          }
            
          default: {
            // Handle any common fields for other node types
            const basicData = updatedNode.data as any;
            if (nodeContent.label !== undefined) basicData.label = nodeContent.label;
            break;
          }
        }
        
        return updatedNode;
      }
      
      return node;
    });
  }, []);
  
  // Function to commit local changes to Redux
  const commitChanges = useCallback(() => {
    if (dirtyNodesRef.current.size > 0) {
      console.log(`[FlowSync] Committing changes for ${dirtyNodesRef.current.size} dirty nodes to Redux`);
      
      // Prepare nodes by merging with node content store
      const nodesToCommit = prepareNodesForRedux(localNodes);
      
      // Update Redux with the merged nodes
      dispatch(setReduxNodes(nodesToCommit));
      
      // Always commit edges too, in case they're related
      if (localEdges.length > 0) {
        dispatch(setReduxEdges(localEdges));
      }
      
      // Clear dirty state after commit
      dirtyNodesRef.current.clear();
    }
  }, [dispatch, localNodes, localEdges, prepareNodesForRedux]);
  
  // Function to force a complete sync from Redux to local
  const forceSync = useCallback(() => {
    console.log("[FlowSync] Force sync requested");
    
    // If we have dirty nodes, commit them first
    if (dirtyNodesRef.current.size > 0) {
      commitChanges();
    }
    
    // Then update from Redux
    setLocalNodes(initialNodes);
    setLocalEdges(initialEdges);
    console.log("[FlowSync] Completed force sync from Redux to local");
  }, [initialNodes, initialEdges, setLocalNodes, setLocalEdges, commitChanges]);
  
  // Initial sync effect specifically for first load or data import
  useEffect(() => {
    if (isInitialSyncRef.current) {
      console.log("[FlowSync] Initial sync");
      setLocalNodes(initialNodes);
      setLocalEdges(initialEdges);
      isInitialSyncRef.current = false;
    }
  }, [initialNodes, initialEdges, setLocalNodes, setLocalEdges]);
  
  // Handle external Redux updates (only for force sync or history actions)
  useEffect(() => {
    // Skip if we're editing (normal case) - this is a big change from previous sync behavior
    if (isEditingNodeRef.current && !isRestoringHistory.current && !triggerForceSync.current) {
      return;
    }
    
    // Only sync from Redux in specific scenarios:
    
    // 1. When restoring history (undo/redo)
    if (isRestoringHistory.current) {
      console.log("[FlowSync] Syncing due to history restoration");
      setLocalNodes(initialNodes);
      setLocalEdges(initialEdges);
      // Clear any dirty state since we're restoring history
      dirtyNodesRef.current.clear();
      return;
    }
    
    // 2. When force sync is triggered (import, etc.)
    if (triggerForceSync.current) {
      console.log("[FlowSync] Processing force sync");
      setLocalNodes(initialNodes);
      setLocalEdges(initialEdges);
      triggerForceSync.current = false;
      // Clear any dirty state since we're doing a force sync
      dirtyNodesRef.current.clear();
      return;
    }
    
    // For all other scenarios, we don't auto-sync from Redux to local
    // This is a key change from the previous behavior
    
  }, [initialNodes, initialEdges, setLocalNodes, setLocalEdges, isRestoringHistory]);
  
  // Clean up dirty nodes when nodes are deleted
  useEffect(() => {
    // Get the current node IDs
    const currentNodeIds = new Set(localNodes.map(node => node.id));
    
    // Find dirty nodes that no longer exist
    const deletedDirtyNodes = Array.from(dirtyNodesRef.current)
      .filter(nodeId => !currentNodeIds.has(nodeId));
    
    // Remove them from dirty nodes set
    if (deletedDirtyNodes.length > 0) {
      console.log(`[FlowSync] Removing ${deletedDirtyNodes.length} deleted nodes from dirty nodes set`);
      deletedDirtyNodes.forEach(nodeId => {
        dirtyNodesRef.current.delete(nodeId);
      });
    }
  }, [localNodes]);
  
  return {
    localNodes,
    localEdges,
    setLocalNodes,
    setLocalEdges,
    onLocalNodesChange,
    onLocalEdgesChange,
    forceSync,
    commitChanges,
    markNodeDirty,
    isDirty
  };
}; 