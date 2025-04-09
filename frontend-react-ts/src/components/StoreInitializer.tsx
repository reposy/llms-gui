import React, { useEffect, useRef, useMemo } from 'react';
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
  
  // Keep previous nodes count to detect significant changes
  const prevNodesCountRef = useRef<number>(0);

  // Only run initialization when necessary - significant changes in node count
  // or when specifically requested via props
  useEffect(() => {
    // Skip initialization during paste operations
    if (recentlyPastedNodeIdsRef.current.size > 0) {
      console.log(`[StoreInitializer] Skipping initialization during paste operation`);
      return;
    }

    // Detect significant node count changes to avoid unnecessary work
    const currentNodeCount = nodes.length;
    const prevNodeCount = prevNodesCountRef.current;
    const hasSignificantChange = Math.abs(currentNodeCount - prevNodeCount) > 2;
    
    if (!hasSignificantChange && prevNodeCount > 0) {
      // Skip initialization if no significant changes
      return;
    }
    
    console.log(`[StoreInitializer] Processing ${currentNodeCount} nodes (previous: ${prevNodeCount})`);
    prevNodesCountRef.current = currentNodeCount;
    
    // Get list of current ReactFlow nodes
    const currentNodes = reactFlowInstance.getNodes();
    const currentNodeIds = new Set(currentNodes.map(node => node.id));

    // Find nodes that need initialization
    const nodesToInitialize = nodes.filter(node => 
      // Skip if recently pasted
      !recentlyPastedNodeIdsRef.current.has(node.id) &&
      // Skip if already in ReactFlow
      !currentNodeIds.has(node.id) &&
      // Skip if already initialized
      !initializedNodeIdsRef.current.has(node.id)
    );
    
    if (nodesToInitialize.length === 0) {
      return;
    }

    console.log(`[StoreInitializer] Initializing ${nodesToInitialize.length} new nodes`);
    
    // Mark nodes as initialized
    nodesToInitialize.forEach(node => {
      initializedNodeIdsRef.current.add(node.id);
      console.log(`[StoreInitializer] Initialized node ${node.id}`);
    });
  }, [nodes, reactFlowInstance]);

  // This component doesn't render anything
  return null;
};

export default React.memo(StoreInitializer); // Memoize to prevent unnecessary re-renders 