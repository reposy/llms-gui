import React, { useEffect, useRef } from 'react';
import { useNodeContentStore } from '../store/useNodeContentStore';
import { useNodes } from '../store/useFlowStructureStore';

/**
 * StoreInitializer component initializes Zustand stores when the app loads
 * This is used to establish initial state and ensure persistence across renders
 */
const StoreInitializer: React.FC = () => {
  // Get nodes from Zustand
  const nodes = useNodes();
  const initializedNodesRef = useRef(new Set<string>());
  const loadFromNodes = useNodeContentStore(state => state.loadFromNodes);
  const getNodeContents = useNodeContentStore(state => state.getAllNodeContents);
  
  // Track the last node count to detect bulk operations like paste
  const lastNodeCountRef = useRef<number>(0);
  
  // Initialize the Zustand stores when the component mounts or nodes change
  useEffect(() => {
    // Get current contents to check what already exists
    const existingContents = getNodeContents();
    const currentNodeCount = nodes.length;
    
    // Detect bulk operations like paste by checking for sudden node increases
    const isBulkOperation = currentNodeCount > lastNodeCountRef.current + 1;
    if (isBulkOperation) {
      console.log(`[StoreInitializer] Detected bulk operation: ${lastNodeCountRef.current} → ${currentNodeCount} nodes`);
    }
    
    // Update for next render
    lastNodeCountRef.current = currentNodeCount;
    
    // Find nodes that haven't been initialized yet and don't have existing content
    const newNodes = nodes.filter(node => {
      if (!node.id || !node.data?.type) {
        console.warn(`[StoreInitializer] Found node with missing id or type:`, node);
        return false;
      }
      
      // If node is already in our tracking ref, skip it
      if (initializedNodesRef.current.has(node.id)) {
        // Only log in non-bulk operations to reduce console noise
        if (!isBulkOperation) {
          console.log(`[StoreInitializer] Node ${node.id} already in ref, skipping`);
        }
        return false;
      }
      
      // If content already exists for this node in the store, skip initialization
      // but still add to our tracking ref to avoid future initialization attempts
      if (existingContents[node.id]) {
        console.log(`[StoreInitializer] Node ${node.id} already has content in store, marking as initialized`);
        initializedNodesRef.current.add(node.id);
        return false;
      }
      
      console.log(`[StoreInitializer] Found new node to initialize: ${node.id} (${node.data.type})`);
      initializedNodesRef.current.add(node.id);
      return true;
    });
    
    if (newNodes.length > 0) {
      console.log(`[StoreInitializer] Initializing ${newNodes.length} new nodes:`, 
        newNodes.map(n => ({ id: n.id, type: n.data?.type }))
      );
      
      // Only initialize content for new nodes
      loadFromNodes(newNodes);
    }
  }, [nodes, loadFromNodes, getNodeContents]);
  
  // Log when component unmounts to track lifecycle
  useEffect(() => {
    return () => {
      console.log('[StoreInitializer] Component unmounting, initialized nodes:', 
        Array.from(initializedNodesRef.current)
      );
    };
  }, []);
  
  // This component doesn't render anything
  return null;
};

export default StoreInitializer; 