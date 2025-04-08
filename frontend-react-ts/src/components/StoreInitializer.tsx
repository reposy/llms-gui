import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { loadFromNodes } from '../store/useNodeContentStore';
import { Node } from 'reactflow';
import { NodeData } from '../types/nodes';

/**
 * StoreInitializer component initializes Zustand stores from Redux state when the app loads
 * This is used to establish initial state and ensure persistence across renders
 */
const StoreInitializer: React.FC = () => {
  // Get nodes from Redux
  const nodes = useSelector((state: RootState) => state.flow.nodes);
  
  // Initialize the Zustand stores when the component mounts or nodes change
  useEffect(() => {
    // Initialize zustand stores with Redux data
    console.log(`Loading ${nodes.length} nodes into Zustand store...`);
    
    // Load all nodes into Zustand store
    loadFromNodes(nodes);
  }, [nodes]);
  
  // This component doesn't render anything
  return null;
};

export default StoreInitializer; 