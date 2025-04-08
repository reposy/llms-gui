import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import { useNodeContentStore } from '../store/useNodeContentStore';
import { useNodes } from '../store/useFlowStructureStore';
import { recentlyPastedNodes, explicitlyInitializedNodeIds } from '../utils/clipboardUtils';
import { throttle } from '../utils/throttleUtils';

// Constants
const BULK_OPERATION_THRESHOLD = 5; // Consider 5+ new nodes a bulk operation
const THROTTLE_DELAY = 100; // 100ms throttle for bulk operations

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
  const processingBulkOperationRef = useRef<boolean>(false);

  // Create a throttled loadFromNodes function for bulk operations
  const throttledLoadFromNodes = useMemo(() => 
    throttle((nodesToLoad) => {
      console.log(`[StoreInitializer] Throttled loading of ${nodesToLoad.length} nodes`);
      loadFromNodes(nodesToLoad);
      
      // Clear bulk operation flag when done
      setTimeout(() => {
        processingBulkOperationRef.current = false;
        console.log('[StoreInitializer] Bulk operation processing completed');
      }, 200);
    }, THROTTLE_DELAY),
  [loadFromNodes]);
  
  // Helper function to safely check if a node needs initialization
  const shouldInitializeNode = useCallback((nodeId: string, nodeType: string) => {
    // Skip if node has already been initialized in this session
    if (initializedNodesRef.current.has(nodeId)) {
      return false;
    }
    
    // Skip if node was recently pasted (handled by clipboard utils)
    if (recentlyPastedNodes.has(nodeId)) {
      console.log(`[StoreInitializer] Node ${nodeId} was recently pasted, skipping initialization`);
      initializedNodesRef.current.add(nodeId); // Still mark as initialized
      return false;
    }
    
    // Skip if node was explicitly initialized elsewhere (common tracking with NodeContentStore)
    if (explicitlyInitializedNodeIds.has(nodeId)) {
      console.log(`[StoreInitializer] Node ${nodeId} was explicitly initialized, skipping initialization`);
      initializedNodesRef.current.add(nodeId); // Still mark as initialized
      return false;
    }
    
    // Skip if node already has content in the store
    const existingContents = getNodeContents();
    if (existingContents[nodeId]) {
      // Just mark as initialized for future reference
      initializedNodesRef.current.add(nodeId);
      // Also add to global tracking
      explicitlyInitializedNodeIds.add(nodeId);
      return false;
    }
    
    console.log(`[StoreInitializer] Node ${nodeId} (${nodeType}) needs initialization`);
    return true;
  }, [getNodeContents]);
  
  // Initialize the Zustand stores when the component mounts or nodes change
  useEffect(() => {
    if (processingBulkOperationRef.current) {
      console.log('[StoreInitializer] Skipping while bulk operation is in progress');
      return;
    }
    
    // Get current counts
    const currentNodeCount = nodes.length;
    const newNodeCount = currentNodeCount - lastNodeCountRef.current;
    
    // Detect bulk operations like paste by checking for sudden node increases
    const isBulkOperation = newNodeCount >= BULK_OPERATION_THRESHOLD;
    
    if (isBulkOperation) {
      console.log(`[StoreInitializer] Detected bulk operation: ${lastNodeCountRef.current} → ${currentNodeCount} nodes (+${newNodeCount})`);
      processingBulkOperationRef.current = true;
    }
    
    // Update for next render
    lastNodeCountRef.current = currentNodeCount;
    
    // Get existing content to check what already exists
    const existingContents = getNodeContents();
    
    // Find nodes that haven't been initialized yet and don't have existing content
    const newNodes = nodes.filter(node => {
      if (!node.id || !node.data?.type) {
        console.warn(`[StoreInitializer] Found node with missing id or type:`, node);
        return false;
      }
      
      return shouldInitializeNode(node.id, node.data.type);
    });
    
    if (newNodes.length === 0) {
      return; // Nothing to initialize
    }
    
    // Record all new nodes as initialized
    newNodes.forEach(node => {
      initializedNodesRef.current.add(node.id);
      // Also mark in global tracking - will be set again in NodeContentStore but that's ok
      explicitlyInitializedNodeIds.add(node.id);
    });
    
    console.log(`[StoreInitializer] Found ${newNodes.length} nodes needing initialization`);
    
    // Use throttled function for bulk operations, regular for small batches
    if (isBulkOperation) {
      console.log(`[StoreInitializer] Using throttled load for ${newNodes.length} nodes`);
      throttledLoadFromNodes(newNodes);
    } else {
      console.log(`[StoreInitializer] Loading ${newNodes.length} new nodes normally`);
      loadFromNodes(newNodes);
    }
  }, [nodes, loadFromNodes, getNodeContents, throttledLoadFromNodes, shouldInitializeNode]);
  
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