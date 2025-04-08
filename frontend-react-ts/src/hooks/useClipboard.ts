import { useCallback, useEffect, useRef } from 'react';
import { useReactFlow, XYPosition, ReactFlowInstance, useStoreApi } from 'reactflow';
import { NodeData } from '../types/nodes';
import { flushSync } from 'react-dom';
import { 
  copySelectedNodes, 
  pasteClipboardContents, 
  hasClipboardData,
  clearClipboard
} from '../utils/clipboardUtils';
import { useFlowStructureStore } from '../store/useFlowStructureStore';
import { setNodeContent } from '../store/useNodeContentStore';
import { pushSnapshot } from '../store/useHistoryStore';
import { resetNodeStates } from '../store/useNodeStateStore';
import { getAllNodeContents } from '../store/useNodeContentStore';
import { applyNodeSelection, setSelectedNodeId, useSelectionLock } from '../store/useFlowStructureStore';
import { cloneDeep } from 'lodash';

// Global flag for paste operations (for debugging and coordination)
declare global {
  interface Window {
    _devFlags: {
      hasJustPasted: boolean;
      lastPasteTimestamp: number;
      pasteVersion: number;
    };
  }
}

// Initialize global dev flags
if (typeof window !== 'undefined') {
  window._devFlags = window._devFlags || {
    hasJustPasted: false,
    lastPasteTimestamp: 0,
    pasteVersion: 0
  };
}

// Ensure we set pasted nodes at a higher z-index than existing ones
const PASTE_Z_INDEX_BOOST = 10; // Ensure pasted nodes appear above others
const MAX_SELECTION_LOCK_TIME = 1500; // Lock selection changes for 1.5s after paste

export interface UseClipboardReturnType {
  handleCopy: () => void;
  handlePaste: (position?: XYPosition) => void;
  canPaste: boolean;
  pasteVersion: number;
}

// Global ref for tracking recently pasted node IDs
export const recentlyPastedNodeIdsRef = { current: new Set<string>() };

export const useClipboard = (): UseClipboardReturnType => {
  const reactFlowInstance = useReactFlow<NodeData>();
  const { getViewport, fitView, getNodes, getEdges, setViewport, screenToFlowPosition } = reactFlowInstance;
  const reactFlowStore = useStoreApi();
  const { nodes, edges, setNodes, setEdges } = useFlowStructureStore();
  
  // Get selection lock functions (to prevent selection override)
  const { lockSelection, unlockSelection } = useSelectionLock();
  
  // Paste version counter for forcing remounts
  const pasteVersionRef = useRef<number>(0);
  
  // Keep track of the last paste operation for animation frame handling
  const lastPasteOpRef = useRef<{
    newNodeIds: string[];
    firstNodeId: string;
    updatedNodes: any[];
    updatedEdges: any[];
    boundingBox?: { minX: number; minY: number; maxX: number; maxY: number; };
  } | null>(null);
  
  // Track active paste operations to prevent node loss
  const activeTimeoutRefs = useRef<number[]>([]);
  const forceUpdateCountRef = useRef<number>(0);
  const isManualPasteInProgressRef = useRef<boolean>(false);
  const viewportBeforePasteRef = useRef<{x: number, y: number, zoom: number} | null>(null);

  /**
   * Force ReactFlow to synchronize with our updated nodes and edges
   * This helps prevent visual glitches with groups and their children
   */
  const forceSyncReactFlow = useCallback(() => {
    // Force React Flow's internal state to update by accessing the store directly
    const store = reactFlowStore.getState();
    if (store && typeof store.setNodes === 'function') {
      // Get the current nodes from our Zustand store
      const currentNodes = useFlowStructureStore.getState().nodes;
      const currentEdges = useFlowStructureStore.getState().edges;
      
      const updateCount = ++forceUpdateCountRef.current;
      console.log(`[Clipboard] Forcing ReactFlow internal state sync (#${updateCount})`);
      console.log(`[Clipboard] Current Zustand nodes: ${currentNodes.length} (IDs: ${currentNodes.map(n => n.id).join(', ')})`);
      
      // Log ReactFlow's current node IDs vs Zustand's to identify desync
      const rfNodes = getNodes();
      console.log(`[Clipboard] ReactFlow nodes before sync: ${rfNodes.length} (IDs: ${rfNodes.map(n => n.id).join(', ')})`);
      
      try {
        // Use flushSync to ensure synchronous updates
        flushSync(() => {
          // Force React Flow's internal store to update
          store.setNodes(currentNodes);
          store.setEdges(currentEdges);
        });
      } catch (err) {
        // Fallback if flushSync fails (e.g., if already in a batch update)
        console.warn('[Clipboard] flushSync failed, using normal update:', err);
        store.setNodes(currentNodes);
        store.setEdges(currentEdges);
      }
      
      // Get node count after sync
      const rfNodesAfter = getNodes();
      console.log(`[Clipboard] ReactFlow nodes after sync: ${rfNodesAfter.length} (IDs: ${rfNodesAfter.map(n => n.id).join(', ')})`);
    }
  }, [reactFlowStore, getNodes]);
  
  /**
   * Calculate the bounding box of a set of nodes for viewport focusing
   */
  const calculateNodesBoundingBox = useCallback((nodeIds: string[]) => {
    const allNodes = getNodes();
    const targetNodes = allNodes.filter(node => nodeIds.includes(node.id));
    
    if (targetNodes.length === 0) return null;
    
    // Initialize with first node's position
    let minX = targetNodes[0].position.x;
    let minY = targetNodes[0].position.y;
    let maxX = minX + (targetNodes[0].width || 200);
    let maxY = minY + (targetNodes[0].height || 100);
    
    // Expand bounding box to include all nodes
    targetNodes.forEach(node => {
      const nodeWidth = node.width || 200;
      const nodeHeight = node.height || 100;
      
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + nodeWidth);
      maxY = Math.max(maxY, node.position.y + nodeHeight);
    });
    
    return { minX, minY, maxX, maxY };
  }, [getNodes]);
  
  /**
   * Focus viewport on newly pasted nodes
   */
  const focusViewportOnNodes = useCallback((nodeIds: string[], animate = true) => {
    if (!nodeIds.length) return;
    
    try {
      const duration = animate ? 800 : 0;
      
      // When only one node is pasted, center on it instead of using fitView
      if (nodeIds.length === 1) {
        const node = getNodes().find(n => n.id === nodeIds[0]);
        if (node) {
          const nodeCenter = {
            x: node.position.x + (node.width || 200) / 2,
            y: node.position.y + (node.height || 100) / 2
          };
          
          const { x, y, zoom } = getViewport();
          const targetZoom = zoom; // Keep current zoom level
          
          // Center on node
          setViewport(
            { 
              x: -nodeCenter.x * targetZoom + window.innerWidth / 2,
              y: -nodeCenter.y * targetZoom + window.innerHeight / 2,
              zoom: targetZoom
            },
            { duration }
          );
        }
      } else {
        // For multiple nodes, use fitView with padding
        fitView({
          padding: 0.2,
          duration,
          nodes: getNodes().filter(node => nodeIds.includes(node.id)),
          minZoom: getViewport().zoom * 0.9, // Don't zoom out too much
          maxZoom: getViewport().zoom * 1.2  // Don't zoom in too much
        });
      }
      
      console.log(`[Clipboard] Focused viewport on ${nodeIds.length} pasted nodes`);
    } catch (e) {
      console.warn('[Clipboard] Error focusing viewport:', e);
    }
  }, [getNodes, getViewport, setViewport, fitView]);

  /**
   * Double-check that ReactFlow is in sync with Zustand after a delay
   * This helps catch and fix cases where nodes disappear after paste
   */
  const verifyReactFlowSync = useCallback(() => {
    // Get current node IDs from both stores
    const zustandNodes = useFlowStructureStore.getState().nodes;
    const reactFlowNodes = getNodes();
    
    if (zustandNodes.length !== reactFlowNodes.length) {
      console.warn(`[Clipboard] Node count mismatch: Zustand has ${zustandNodes.length} nodes, ReactFlow has ${reactFlowNodes.length} nodes`);
      
      // Find missing nodes
      const zustandIds = new Set(zustandNodes.map(n => n.id));
      const reactFlowIds = new Set(reactFlowNodes.map(n => n.id));
      
      // Nodes in Zustand but missing from ReactFlow
      const missingFromReactFlow = zustandNodes.filter(n => !reactFlowIds.has(n.id));
      if (missingFromReactFlow.length > 0) {
        console.warn(`[Clipboard] Nodes missing from ReactFlow: ${missingFromReactFlow.map(n => n.id).join(', ')}`);
        console.log('[Clipboard] Re-forcing sync to fix missing nodes...');
        forceSyncReactFlow();
        
        // Check if nodes are rendered in the DOM
        setTimeout(() => {
          checkNodesInDOM(missingFromReactFlow.map(n => n.id));
        }, 50);
      }
      
      // Nodes in ReactFlow but missing from Zustand (shouldn't happen)
      const missingFromZustand = reactFlowNodes.filter(n => !zustandIds.has(n.id));
      if (missingFromZustand.length > 0) {
        console.warn(`[Clipboard] Nodes in ReactFlow but missing from Zustand: ${missingFromZustand.map(n => n.id).join(', ')}`);
      }
    } else {
      console.log(`[Clipboard] Sync verification: Zustand and ReactFlow both have ${zustandNodes.length} nodes`);
      
      // Still check DOM rendering even if counts match
      if (window._devFlags.hasJustPasted) {
        const newNodeIds = zustandNodes.filter(n => n.selected).map(n => n.id);
        if (newNodeIds.length > 0) {
          checkNodesInDOM(newNodeIds);
        }
      }
    }
  }, [forceSyncReactFlow, getNodes]);
  
  /**
   * Check if nodes are actually rendered in the DOM
   * This is a final verification to ensure ReactFlow has rendered the nodes
   */
  const checkNodesInDOM = useCallback((nodeIds: string[]) => {
    if (!nodeIds.length) return;
    
    console.log(`[Clipboard] Checking DOM rendering for ${nodeIds.length} nodes`);
    
    // Wait a moment to ensure rendering had a chance to complete
    setTimeout(() => {
      const missingFromDOM: string[] = [];
      
      // Check each node ID to see if it's in the DOM
      nodeIds.forEach((id: string) => {
        const nodeElement = document.querySelector(`[data-id="${id}"]`);
        if (!nodeElement) {
          missingFromDOM.push(id);
        }
      });
      
      if (missingFromDOM.length > 0) {
        console.warn(`[Clipboard] Nodes missing from DOM: ${missingFromDOM.join(', ')}`);
        
        // Try one more forceful ReactFlow update
        const store = reactFlowStore.getState();
        if (store && typeof store.setNodes === 'function') {
          const zustandNodes = useFlowStructureStore.getState().nodes;
          console.log('[Clipboard] Forcing one more ReactFlow update to fix DOM rendering');
          
          try {
            flushSync(() => {
              store.setNodes([...zustandNodes]);
            });
          } catch (err) {
            console.warn('[Clipboard] flushSync failed in DOM check, using normal update');
            store.setNodes([...zustandNodes]);
          }
          
          // Force a key change on ReactFlow component as last resort
          if (window._devFlags.pasteVersion) {
            window._devFlags.pasteVersion += 1;
            pasteVersionRef.current += 1;
            console.log(`[Clipboard] Incremented paste version to ${pasteVersionRef.current} to force ReactFlow remount`);
          }
        }
      } else {
        console.log(`[Clipboard] All nodes correctly rendered in DOM`);
      }
    }, 100); // Small delay to ensure rendering had time to complete
  }, [reactFlowStore, pasteVersionRef]);

  /**
   * Ensure selection state is consistent between our Zustand store and ReactFlow
   */
  const syncSelectionState = useCallback((nodesToSelect: string[], primaryNodeId?: string) => {
    if (!nodesToSelect.length) return;
    
    console.log(`[Clipboard] Synchronizing selection state for ${nodesToSelect.length} nodes`);
    
    // Lock selection to prevent immediate override
    lockSelection();
    
    // 1. First update our Zustand store selection state
    applyNodeSelection(nodesToSelect);
    
    // 2. Force ReactFlow to sync with our updated store
    forceSyncReactFlow();
    
    // 3. Verify ReactFlow's nodes have correct selection state
    const reactFlowNodes = getNodes();
    const allNodesSelected = nodesToSelect.every(id => {
      const node = reactFlowNodes.find(n => n.id === id);
      return node?.selected === true;
    });
    
    if (!allNodesSelected) {
      console.log('[Clipboard] Selection state mismatch detected, applying direct fix');
      
      // Direct fix: Update the ReactFlow store directly
      const store = reactFlowStore.getState();
      if (store && typeof store.setNodes === 'function') {
        const updatedRfNodes = reactFlowNodes.map(node => {
          if (nodesToSelect.includes(node.id)) {
            return { ...node, selected: true };
          }
          return node;
        });
        
        try {
          flushSync(() => {
            store.setNodes(updatedRfNodes);
          });
        } catch (err) {
          console.warn('[Clipboard] flushSync failed in selection sync, using normal update');
          store.setNodes(updatedRfNodes);
        }
      }
    }
    
    // 4. Finally, set the primary selected node for the sidebar if provided
    if (primaryNodeId) {
      setSelectedNodeId(primaryNodeId);
    }
    
    // Schedule selection unlock with delay to prevent immediate override
    const timeoutId = window.setTimeout(() => {
      console.log(`[Clipboard] Unlocking selection after paste`);
      unlockSelection();
    }, MAX_SELECTION_LOCK_TIME);
    
    // Track the timeout
    activeTimeoutRefs.current.push(timeoutId);
    
  }, [getNodes, reactFlowStore, forceSyncReactFlow, lockSelection, unlockSelection]);

  const handleCopy = useCallback(() => {
    const nodeCount = copySelectedNodes();
    if (nodeCount > 0) {
      console.log(`[Clipboard] Copied ${nodeCount} nodes`);
    }
  }, []);

  // Function to handle deferred UI updates after paste
  const handleDeferredPasteUIUpdates = useCallback(() => {
    if (!lastPasteOpRef.current) return;
    
    const { newNodeIds, firstNodeId, updatedNodes, updatedEdges, boundingBox } = lastPasteOpRef.current;
    
    // CRITICAL: Ensure the ReactFlow internal state is completely up-to-date
    const currentReactFlowNodes = getNodes();
    console.log(`[Clipboard] ReactFlow internal state has ${currentReactFlowNodes.length} nodes`);
    console.log(`[Clipboard] Looking for ${newNodeIds.length} new nodes with IDs: ${newNodeIds.join(', ')}`);
    
    // Check if all new nodes exist in ReactFlow's state
    const allNewNodesInReactFlow = newNodeIds.every(id => 
      currentReactFlowNodes.some(node => node.id === id)
    );
    
    const missingNodeIds = newNodeIds.filter(id => 
      !currentReactFlowNodes.some(node => node.id === id)
    );
    
    if (missingNodeIds.length > 0) {
      console.warn(`[Clipboard] Nodes missing from ReactFlow: ${missingNodeIds.join(', ')}`);
      
      // Force a double sync to ReactFlow to ensure nodes appear
      // 1. First force our store to update its own nodes
      const zustandNodes = useFlowStructureStore.getState().nodes;
      setNodes([...zustandNodes]);
      
      // 2. Then directly update ReactFlow's internal store
      const store = reactFlowStore.getState();
      if (store && typeof store.setNodes === 'function') {
        console.log('[Clipboard] Forcefully updating ReactFlow internal state to fix missing nodes');
        // First use the direct API
        try {
          flushSync(() => {
            store.setNodes(zustandNodes);
            store.setEdges(useFlowStructureStore.getState().edges);
          });
        } catch (err) {
          console.warn('[Clipboard] flushSync failed, using normal update');
          store.setNodes(zustandNodes);
          store.setEdges(useFlowStructureStore.getState().edges);
        }
      }
      
      // 3. Delay further processing to the next animation frame
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          // Double requestAnimationFrame ensures maximum reconciliation time
          // Force another check after both React and browser have had time to update
          const updatedReactFlowNodes = getNodes();
          const stillMissingNodeIds = newNodeIds.filter(id => 
            !updatedReactFlowNodes.some(node => node.id === id)
          );
          
          if (stillMissingNodeIds.length > 0) {
            console.error(`[Clipboard] Nodes still missing after forced update: ${stillMissingNodeIds.join(', ')}`);
            
            // Last resort: attempt to trigger a key change on the ReactFlow component
            // through the global paste version counter
            window._devFlags.pasteVersion += 1;
            pasteVersionRef.current += 1;
            console.log(`[Clipboard] Incremented paste version to ${pasteVersionRef.current} to force ReactFlow remount`);
            
            // Try one final force sync after incrementing the version
            forceSyncReactFlow();
          }
          
          // Continue with the pasting process anyway
          continueWithPasteProcess();
        });
      });
      return;
    }
    
    // If all nodes are present, continue with normal process
    continueWithPasteProcess();
    
    // Helper function to continue with the normal paste process
    function continueWithPasteProcess() {
      // Re-apply selection state to ensure consistency
      syncSelectionState(newNodeIds, firstNodeId);
      
      // Handle group layout update for children
      const hasGroupNodes = updatedNodes.some(node => node.type === 'group');
      if (hasGroupNodes) {
        console.log('[Clipboard] Group nodes detected, refreshing layout');
        
        // First, get existing and new group nodes
        const groupNodes = updatedNodes.filter(node => node.type === 'group' && newNodeIds.includes(node.id));
        
        // Use a small timeout to ensure React's rendering is complete
        const timeoutId = window.setTimeout(() => {
          // Force a small viewport change to trigger ReactFlow layout recalculation
          const viewport = getViewport();
          setViewport({ x: viewport.x + 0.01, y: viewport.y, zoom: viewport.zoom });
          
          // Then restore the viewport in the next frame
          requestAnimationFrame(() => {
            setViewport(viewport);
            
            // Use a double requestAnimationFrame for extra safety
            // This ensures we're definitely after ReactFlow's internal updates
            requestAnimationFrame(() => {
              // Re-apply selection after layout changes to prevent selection loss
              syncSelectionState(newNodeIds, firstNodeId);
              
              // Check sync again
              verifyReactFlowSync();
              
              // Focus viewport on pasted nodes with animation
              focusViewportOnNodes(newNodeIds, true);
              
              // Final verification after all layout and fit operations
              setTimeout(verifyReactFlowSync, 500);
              
              // Release selection lock and clear paste flag after delay
              const releaseTimeout = window.setTimeout(() => {
                console.log('[Clipboard] Releasing selection lock and clearing paste flag');
                unlockSelection();
                window._devFlags.hasJustPasted = false;
                
                isManualPasteInProgressRef.current = false;
              }, 1000);
              
              activeTimeoutRefs.current.push(releaseTimeout);
            });
          });
        }, 50); // Small timeout to ensure rendering is complete
        
        // Store the timeout ID so we can clear it if needed
        activeTimeoutRefs.current.push(timeoutId);
      } else {
        // No group nodes, just fit view after a short delay
        const timeoutId = window.setTimeout(() => {
          // Focus viewport on pasted nodes with animation
          focusViewportOnNodes(newNodeIds, true);
          
          // Final verification after view fitting
          setTimeout(verifyReactFlowSync, 500);
          
          // Release selection lock and clear paste flag after delay
          const releaseTimeout = window.setTimeout(() => {
            console.log('[Clipboard] Releasing selection lock and clearing paste flag');
            unlockSelection();
            window._devFlags.hasJustPasted = false;
            
            isManualPasteInProgressRef.current = false;
          }, 1000);
          
          activeTimeoutRefs.current.push(releaseTimeout);
        }, 50);
        
        // Store the timeout ID
        activeTimeoutRefs.current.push(timeoutId);
      }
    }
    
    // Set up several delayed verification checks to catch desync issues
    [100, 300, 800, 1500].forEach(delay => {
      const timeoutId = window.setTimeout(() => {
        console.log(`[Clipboard] Running verification check at t+${delay}ms`);
        verifyReactFlowSync();
        
        // Remove this timeout from tracking
        activeTimeoutRefs.current = activeTimeoutRefs.current.filter(id => id !== timeoutId);
      }, delay);
      
      activeTimeoutRefs.current.push(timeoutId);
    });
    
    // Clear the reference after processing
    lastPasteOpRef.current = null;
  }, [getNodes, getViewport, setViewport, forceSyncReactFlow, syncSelectionState, verifyReactFlowSync, focusViewportOnNodes, unlockSelection, setNodes, reactFlowStore, pasteVersionRef]);

  /**
   * Find the highest z-index currently in use
   */
  const getHighestZIndex = useCallback(() => {
    const allNodes = getNodes();
    let highest = 0;
    
    allNodes.forEach(node => {
      if (typeof node.zIndex === 'number' && node.zIndex > highest) {
        highest = node.zIndex;
      }
    });
    
    return highest;
  }, [getNodes]);

  const handlePaste = useCallback((mousePosition?: XYPosition) => {
    isManualPasteInProgressRef.current = true;
    
    // Store the current viewport for potential restoration
    viewportBeforePasteRef.current = getViewport();
    
    // If no position is provided, calculate a position based on the viewport center
    let position: XYPosition | undefined = mousePosition;
    if (!position) {
      const viewport = getViewport();
      // Use window dimensions to calculate center
      position = {
        x: -viewport.x / viewport.zoom + window.innerWidth / 2 / viewport.zoom,
        y: -viewport.y / viewport.zoom + window.innerHeight / 2 / viewport.zoom,
      };
    }
    
    // Get paste data from clipboard
    const pasteResult = pasteClipboardContents(position);
    if (!pasteResult) return;
    
    const { newNodes, newEdges, nodeContents, newNodeIds } = pasteResult;
    
    console.log(`[Clipboard] Applying paste with ${newNodes.length} nodes and ${newEdges.length} edges`);
    
    // Track recently pasted node IDs
    newNodeIds.forEach(id => recentlyPastedNodeIdsRef.current.add(id));
    
    // Clean up recently pasted node IDs after 1000ms
    setTimeout(() => {
      newNodeIds.forEach(id => recentlyPastedNodeIdsRef.current.delete(id));
    }, 1000);
    
    // Get the highest current z-index for layering
    const highestZIndex = getHighestZIndex();
    const zIndexBoost = highestZIndex + PASTE_Z_INDEX_BOOST;
    
    // Preemptively lock selection to prevent any other component from changing it
    lockSelection();
    
    // Special group handling: identify parent-child relationships
    const groupNodes = newNodes.filter(node => node.type === 'group');
    const childrenByParentId: Record<string, string[]> = {};
    
    // Track children of each group
    newNodes.forEach(node => {
      if (node.parentNode) {
        if (!childrenByParentId[node.parentNode]) {
          childrenByParentId[node.parentNode] = [];
        }
        childrenByParentId[node.parentNode].push(node.id);
      }
    });
    
    // Log parent-child relationships for debugging
    if (groupNodes.length > 0) {
      console.log(`[Clipboard] Pasting ${groupNodes.length} group nodes with children:`, childrenByParentId);
    }
    
    // Add nodes directly to ReactFlow
    const selectedHighZNewNodes = newNodes.map(node => ({
      ...node,
      selected: true,
      zIndex: (node.zIndex || 0) + zIndexBoost // Ensure pasted nodes appear above others
    }));
    
    reactFlowInstance.addNodes(selectedHighZNewNodes);
    reactFlowInstance.addEdges(newEdges);
    
    // Update Zustand after rendering
    setNodes([...nodes, ...selectedHighZNewNodes]);
    setEdges([...edges, ...newEdges]);
    
    // Initialize node content
    for (const [nodeId, contentData] of Object.entries(nodeContents)) {
      const { content, nodeType } = contentData;
      setNodeContent(nodeId, content, true);
    }
    
    // Apply selection
    if (newNodeIds.length > 0) {
      applyNodeSelection(newNodeIds);
      setSelectedNodeId(newNodeIds[0]);
    }
    
    // Reset execution state for pasted nodes
    resetNodeStates(newNodeIds);
    
    // Calculate the bounding box of pasted nodes for viewport focusing
    const boundingBox = calculateNodesBoundingBox(newNodeIds);
    
    // Push snapshot to history
    const allNodeContents = getAllNodeContents();
    pushSnapshot({
      nodes: useFlowStructureStore.getState().nodes,
      edges: useFlowStructureStore.getState().edges,
      contents: cloneDeep(allNodeContents)
    });
    
    // Clear clipboard memory after successful paste
    clearClipboard();
    console.log('[Clipboard] Cleared clipboard memory after successful paste');
    
    // Immediate focus on pasted nodes without animation
    focusViewportOnNodes(newNodeIds, false);
    
    console.log(`[Clipboard] Successfully pasted ${newNodes.length} nodes and ${newEdges.length} edges`);
  }, [getViewport, nodes, edges, setNodes, setEdges, reactFlowInstance, getHighestZIndex, calculateNodesBoundingBox, focusViewportOnNodes, lockSelection]);

  // Set up keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check if Ctrl/Cmd + C is pressed (copy)
      if ((event.ctrlKey || event.metaKey) && event.key === 'c') {
        event.preventDefault();
        handleCopy();
      }
      
      // Check if Ctrl/Cmd + V is pressed (paste)
      if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
        event.preventDefault();
        handlePaste();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    
    // Cleanup on unmount
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Clear any active timeouts
      activeTimeoutRefs.current.forEach(timeoutId => window.clearTimeout(timeoutId));
      // Clear global paste flag
      if (window._devFlags) {
        window._devFlags.hasJustPasted = false;
      }
      // Ensure selection is unlocked
      unlockSelection();
    };
  }, [handleCopy, handlePaste, unlockSelection]);

  // Check if we have data to paste
  const canPaste = hasClipboardData();

  return {
    handleCopy,
    handlePaste,
    canPaste,
    pasteVersion: pasteVersionRef.current
  };
}; 