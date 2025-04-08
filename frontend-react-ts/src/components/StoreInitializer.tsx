import React, { useEffect } from 'react';
import { loadFromNodes } from '../store/useNodeContentStore';
import { useNodes } from '../store/useFlowStructureStore';

/**
 * StoreInitializer component initializes Zustand stores when the app loads
 * This is used to establish initial state and ensure persistence across renders
 */
const StoreInitializer: React.FC = () => {
  // Get nodes from Zustand
  const nodes = useNodes();
  
  // Initialize the Zustand stores when the component mounts or nodes change
  useEffect(() => {
    // Initialize node content store with nodes
    console.log(`Loading ${nodes.length} nodes into Zustand content store...`);
    
    // Load all nodes into Zustand store
    loadFromNodes(nodes);
  }, [nodes]);
  
  // This component doesn't render anything
  return null;
};

export default StoreInitializer; 