import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { Node } from 'reactflow';
import { InputNodeData, NodeData } from '../types/nodes';
import { loadFromReduxNodes as loadInputNodesContent } from '../store/useInputNodeContentStore';

interface StoreInitializerProps {
  // No props needed
}

/**
 * This component initializes Zustand stores from Redux state when the app loads
 */
const StoreInitializer: React.FC<StoreInitializerProps> = () => {
  // Get nodes from Redux
  const nodes = useSelector((state: RootState) => state.flow.nodes);
  
  // Initialize the Zustand stores when the component mounts or nodes change
  useEffect(() => {
    // Filter for input nodes
    const inputNodes = nodes
      .filter(node => node.type === 'input')
      .map(node => {
        // Extract the node data and explicitly add the id to the data
        const data = node.data as InputNodeData;
        return {
          ...data,
          id: node.id
        };
      });
    
    console.log(`[StoreInitializer] Loading ${inputNodes.length} input nodes into Zustand store`);
    
    // Initialize the input node content store
    loadInputNodesContent(inputNodes);
    
  }, [nodes]);
  
  // This component doesn't render anything
  return null;
};

export default StoreInitializer; 