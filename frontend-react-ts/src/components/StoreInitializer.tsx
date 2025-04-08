import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import { useNodeContentStore } from '../store/useNodeContentStore';
import { useNodes } from '../store/useFlowStructureStore';
import { recentlyPastedNodes, explicitlyInitializedNodeIds } from '../utils/clipboardUtils';
import { throttle } from '../utils/throttleUtils';

// Constants
const BULK_OPERATION_THRESHOLD = 5; // Consider 5+ new nodes a bulk operation
const THROTTLE_DELAY = 100; // 100ms throttle for bulk operations
const PASTE_PROTECTION_WINDOW = 3000; // 3000ms protection window after paste (extended)

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
  
  // Add a recently pasted timestamp to track paste operations
  const lastPasteOperationTimestampRef = useRef<number>(0);
  const nodesOnLastRenderRef = useRef<string[]>([]);
  
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

  // Helper to detect if nodes were just pasted
  const detectPasteOperation = useCallback((currentNodes: Array<{id: string, selected?: boolean}>) => {
    // Get current node IDs
    const currentNodeIds = currentNodes.map(node => node.id);
    const previousNodeIds = nodesOnLastRenderRef.current;
    
    // Find new nodes in this render
    const newNodeIds = currentNodeIds.filter(id => !previousNodeIds.includes(id));
    
    // First check global paste flag if available
    if (window._devFlags?.hasJustPasted) {
      console.log(`[StoreInitializer] Global paste flag is set, timestamp: ${window._devFlags.lastPasteTimestamp}`);
      lastPasteOperationTimestampRef.current = window._devFlags.lastPasteTimestamp || Date.now();
      
      // Add all new nodes to our tracking sets to prevent initialization
      newNodeIds.forEach(id => {
        initializedNodesRef.current.add(id);
        explicitlyInitializedNodeIds.add(id);
      });
      
      // Update tracking of nodes
      nodesOnLastRenderRef.current = currentNodeIds;
      return true;
    }
    
    // Fallback detection: If we have at least 2 new nodes that are all selected, it's likely a paste operation
    const isPasteOperation = newNodeIds.length >= 2 && 
      newNodeIds.every(id => {
        const node = currentNodes.find(n => n.id === id);
        return node?.selected === true;
      });
    
    if (isPasteOperation) {
      console.log(`[StoreInitializer] Detected paste operation with ${newNodeIds.length} new nodes`);
      lastPasteOperationTimestampRef.current = Date.now();
      
      // Add all these nodes to our tracking sets to prevent initialization issues
      newNodeIds.forEach(id => {
        initializedNodesRef.current.add(id);
        explicitlyInitializedNodeIds.add(id);
      });
    }
    
    // Update our tracking of nodes
    nodesOnLastRenderRef.current = currentNodeIds;
    
    return isPasteOperation;
  }, []);
  
  // Initialize the Zustand stores when the component mounts or nodes change
  useEffect(() => {
    // Check global paste flag first (most reliable indicator)
    if (window._devFlags?.hasJustPasted) {
      console.log(`[StoreInitializer] Global paste flag is set, SKIPPING ALL INITIALIZATION`);
      
      // Track the nodes for future renders
      const currentNodeIds = nodes.map(node => node.id);
      nodesOnLastRenderRef.current = currentNodeIds;
      
      // Still detect paste for our internal tracking
      detectPasteOperation(nodes);
      
      // Update node count for next render
      lastNodeCountRef.current = nodes.length;
      
      return;
    }
    
    // Otherwise use our normal detection
    const isPasteOperation = detectPasteOperation(nodes);
    
    // If we're within the paste protection window, skip StoreInitializer work
    const timeSinceLastPaste = Date.now() - lastPasteOperationTimestampRef.current;
    if (timeSinceLastPaste < PASTE_PROTECTION_WINDOW) {
      console.log(`[StoreInitializer] Skipping initialization during paste protection window (${timeSinceLastPaste}ms since paste)`);
      
      // Update node count for next render
      lastNodeCountRef.current = nodes.length;
      
      return;
    }
    
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
    
    // First, let's do a debug check to see which nodes are in the React Flow vs Zustand state
    // Helpful for tracking desync when issues occur
    if (newNodeCount !== 0) {
      console.log(`[StoreInitializer] Current node IDs: [${nodes.map(n => n.id).join(', ')}]`);
      console.log(`[StoreInitializer] Current content keys: [${Object.keys(existingContents).join(', ')}]`);
    }
    
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
  }, [nodes, loadFromNodes, getNodeContents, throttledLoadFromNodes, shouldInitializeNode, detectPasteOperation]);
  
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