import React, { useEffect, useRef } from 'react';
import { useReactFlow } from 'reactflow';
import { useFlowStructureStore } from '../store/useFlowStructureStore';
import { recentlyPastedNodeIdsRef } from '../hooks/useClipboard';

/**
 * StoreInitializer component initializes Zustand stores when the app loads
 * This is used to establish initial state and ensure persistence across renders
 */
const StoreInitializer: React.FC = () => {
  const reactFlowInstance = useReactFlow();
  const { nodes } = useFlowStructureStore();
  const initializedNodeIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const currentNodes = reactFlowInstance.getNodes();
    const currentNodeIds = new Set(currentNodes.map(node => node.id));

    nodes.forEach(node => {
      // Skip initialization if node is recently pasted or already rendered
      if (recentlyPastedNodeIdsRef.current.has(node.id) || currentNodeIds.has(node.id)) {
        return;
      }

      // Initialize node if not already initialized
      if (!initializedNodeIdsRef.current.has(node.id)) {
        initializedNodeIdsRef.current.add(node.id);
        // Perform initialization logic here
        // TODO: Implement actual initialization logic if needed
        console.log(`[StoreInitializer] Initializing node ${node.id}`);
      }
    });
  }, [nodes, reactFlowInstance]);

  // Log when component unmounts to track lifecycle
  useEffect(() => {
    return () => {
      console.log('[StoreInitializer] Component unmounting, initialized nodes:', 
        Array.from(initializedNodeIdsRef.current)
      );
    };
  }, []);

  // This component doesn't render anything
  return null;
};

export default StoreInitializer; 