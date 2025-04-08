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
  
  // Initialize the Zustand stores when the component mounts or nodes change
  useEffect(() => {
    // Get current contents to check what already exists
    const existingContents = getNodeContents();
    
    // Find nodes that haven't been initialized yet and don't have existing content
    const newNodes = nodes.filter(node => {
      if (!node.id) return false;
      
      // If node is already in our tracking ref, skip it
      if (initializedNodesRef.current.has(node.id)) {
        console.log(`[StoreInitializer] Node ${node.id} already in ref, skipping`);
        return false;
      }
      
      // If content already exists for this node in the store, skip initialization
      // but still add to our tracking ref
      if (existingContents[node.id]) {
        console.log(`[StoreInitializer] Node ${node.id} already has content in store, skipping`);
        initializedNodesRef.current.add(node.id);
        return false;
      }
      
      console.log(`[StoreInitializer] Found new node to initialize: ${node.id} (${node.type})`);
      initializedNodesRef.current.add(node.id);
      return true;
    });
    
    if (newNodes.length > 0) {
      console.log(`[StoreInitializer] Initializing ${newNodes.length} new nodes:`, 
        newNodes.map(n => ({ id: n.id, type: n.type }))
      );
      
      // Only initialize content for new nodes
      loadFromNodes(newNodes);
    }
  }, [nodes, loadFromNodes, getNodeContents]); // Add getNodeContents to dependencies
  
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