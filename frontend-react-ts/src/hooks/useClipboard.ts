import { useCallback, useEffect, useRef } from 'react';
import { useReactFlow, XYPosition, useStoreApi, Node, Edge } from '@xyflow/react';
import { NodeData } from '../types/nodes';
import { flushSync } from 'react-dom';
import { 
  copySelectedNodes, 
  pasteClipboardContents, 
  hasClipboardData,
  clearClipboard
} from '../utils/ui/clipboardUtils';
import { useFlowStructureStore } from '../store/useFlowStructureStore';
import { setNodeContent, NodeContent, getAllNodeContents as getAllNodeContentsFromStore } from '../store/useNodeContentStore';
import { pushSnapshot } from '../store/useHistoryStore';
import { cloneDeep } from 'lodash';
import { pushSnapshotAfterNodeOperation } from '../utils/ui/historyUtils';

// Adjust _devFlags type to match global declaration
declare global {
  interface Window {
    _devFlags?: { 
      [key: string]: any; 
      hasJustPasted?: boolean;
      // lastPasteTimestamp?: number; // Commented out based on likely conflict
      pasteVersion?: number;
      debugMode?: boolean; // Added based on likely conflict
    };
  }
}

// Adjust initialization to match the modified type
if (typeof window !== 'undefined') {
  if (!window._devFlags) {
    window._devFlags = { 
      hasJustPasted: false,
      // lastPasteTimestamp: 0, // Commented out
      pasteVersion: 0,
      debugMode: false // Initialize potentially conflicting property
    };
  } else {
    window._devFlags.hasJustPasted = window._devFlags.hasJustPasted ?? false;
    // window._devFlags.lastPasteTimestamp = window._devFlags.lastPasteTimestamp ?? 0; // Commented out
    window._devFlags.pasteVersion = window._devFlags.pasteVersion ?? 0;
    window._devFlags.debugMode = window._devFlags.debugMode ?? false; // Ensure this is checked
  }
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

  // Moved checkNodesInDOM declaration before verifyReactFlowSync
  const checkNodesInDOM = useCallback((nodeIds: string[]) => {
    if (!nodeIds.length) return;
    
    console.log(`[Clipboard] Checking DOM rendering for ${nodeIds.length} nodes`);
    
    // Wait a moment to ensure rendering had a chance to complete
    setTimeout(() => {
      const missingFromDOM: string[] = [];
      
      nodeIds.forEach(nodeId => {
        if (!document.querySelector(`[data-id="${nodeId}"]`)) {
          missingFromDOM.push(nodeId);
        }
      });
      
      if (missingFromDOM.length > 0) {
        console.warn(`[Clipboard] Nodes missing from DOM after paste: ${missingFromDOM.join(', ')}`);
        console.log('[Clipboard] Attempting re-sync again...');
        forceSyncReactFlow();
        
        // Final check after re-sync
        setTimeout(() => {
          const stillMissing = missingFromDOM.filter(id => !document.querySelector(`[data-id="${id}"]`));
          if (stillMissing.length > 0) {
            console.error(`[Clipboard] CRITICAL: Nodes still missing after re-sync: ${stillMissing.join(', ')}. Manual intervention likely needed.`);
          }
        }, 100);
      } else {
        console.log('[Clipboard] All pasted nodes verified in DOM.');
      }
      
      // Use non-null assertion for devFlags here
      const devFlags = window._devFlags!;
      if (devFlags) { 
        devFlags.hasJustPasted = false;
      }
    }, 100); // Delay check slightly to allow DOM updates
    
  }, [forceSyncReactFlow]);

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
      const devFlags = window._devFlags!;
      if (devFlags?.hasJustPasted) {
        const newNodeIds = zustandNodes.filter(n => n.selected).map(n => n.id);
        if (newNodeIds.length > 0) {
          checkNodesInDOM(newNodeIds);
        }
      }
    }
  }, [forceSyncReactFlow, getNodes, checkNodesInDOM]);
  
  /**
   * Ensure selection state is consistent between our Zustand store and ReactFlow
   */
  const syncSelectionState = useCallback((nodesToSelect: string[], primaryNodeId?: string) => {
    if (!nodesToSelect.length) return;
    
    console.log(`[Clipboard] Synchronizing selection state for ${nodesToSelect.length} nodes`);
    
    // 1. First update our Zustand store selection state
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
      // Pass the single ID wrapped in an array
      useFlowStructureStore.getState().setSelectedNodeIds?.([primaryNodeId]); 
    }
    
    // Schedule selection unlock with delay to prevent immediate override
    const timeoutId = window.setTimeout(() => {
      console.log(`[Clipboard] Unlocking selection after paste`);
    }, MAX_SELECTION_LOCK_TIME);
    
    // Track the timeout
    activeTimeoutRefs.current.push(timeoutId);
    
  }, [getNodes, reactFlowStore, forceSyncReactFlow]);

  const handleCopy = useCallback(() => {
    copySelectedNodes();
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
            if (window._devFlags) {
              window._devFlags.pasteVersion = (window._devFlags.pasteVersion || 0) + 1;
              pasteVersionRef.current = window._devFlags.pasteVersion;
              window._devFlags.hasJustPasted = true;
              console.log(`[Clipboard] Initiating paste operation (v${window._devFlags.pasteVersion})`);
            }
            
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
              if (window._devFlags) {
                window._devFlags.hasJustPasted = false;
                isManualPasteInProgressRef.current = false;
              }
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
          if (window._devFlags) {
            window._devFlags.hasJustPasted = false;
            isManualPasteInProgressRef.current = false;
          }
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
  }, [getNodes, getViewport, setViewport, forceSyncReactFlow, syncSelectionState, verifyReactFlowSync, focusViewportOnNodes]);

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

  const handlePaste = useCallback((position?: XYPosition) => {
    // 1. Check if data exists
    if (!hasClipboardData()) {
      console.warn('[Clipboard] No clipboard data found to paste.');
      return;
    }

    // 2. Check for ongoing paste
    if (isManualPasteInProgressRef.current) {
      console.warn('[Clipboard] Paste already in progress, skipping.');
      return;
    }
    isManualPasteInProgressRef.current = true;
    
    // Clear timeouts
    activeTimeoutRefs.current.forEach(clearTimeout);
    activeTimeoutRefs.current = [];
    
    // Store viewport
    viewportBeforePasteRef.current = getViewport();

    // 3. Update dev flags safely using non-null assertion
    const devFlags = window._devFlags!;
    if (devFlags) { 
      devFlags.pasteVersion = (devFlags.pasteVersion || 0) + 1;
      devFlags.hasJustPasted = true; 
    }
    
    console.log(`[Clipboard] Initiating paste operation (v${devFlags.pasteVersion})`);

    // 4. Get paste content
    const pasteResult: PasteResult | null = pasteClipboardContents(position);
    
    if (!pasteResult) { 
      isManualPasteInProgressRef.current = false;
      if (devFlags) devFlags.hasJustPasted = false; 
      return;
    }
    
    // Destructure using correct names from PasteResult type
    const { 
      newNodes: pastedNodes, 
      newEdges: pastedEdges, 
      nodeContents: pastedNodeContentsInfo, // Rename for clarity
      oldToNewIdMap, // Needed for content mapping
      newNodeIds // Use this directly later
    } = pasteResult;

    if (!pastedNodes || pastedNodes.length === 0) {
      console.warn('[Clipboard] No nodes were generated from clipboard data.');
      isManualPasteInProgressRef.current = false;
      if (devFlags) devFlags.hasJustPasted = false; 
      return;
    }
    
    // Create final nodes with offset and z-index (use pastedNodes)
    const finalNodes = pastedNodes.map((node: Node<NodeData>) => ({ // Add type to node
      ...node,
      selected: false, 
      zIndex: (node.zIndex || 0) + PASTE_Z_INDEX_BOOST 
    }));
    
    // Edges are already prepared in pasteResult (use pastedEdges)
    const finalEdges = pastedEdges;

    // Map node contents (use pastedNodeContentsInfo)
    const newNodeContents: Record<string, NodeContent> = {};
    Object.entries(pastedNodeContentsInfo).forEach(([oldId, contentInfo]) => {
      // contentInfo structure: {content: NodeContent, nodeId: string, nodeType: string}
      const newId = oldToNewIdMap[oldId]; // Use the mapping from PasteResult
      if (newId) {
        newNodeContents[newId] = cloneDeep(contentInfo.content); // Extract content
      }
    });

    // Use newNodeIds from PasteResult for logging and selection
    // const newNodeIds = finalNodes.map(node => node.id); // No longer needed
    const firstNodeId = newNodeIds.length > 0 ? newNodeIds[0] : null;
    
    // Update lastPasteOpRef (ensure structure matches usage)
    lastPasteOpRef.current = {
      newNodeIds, // Use directly from PasteResult
      firstNodeId: firstNodeId || '', 
      updatedNodes: finalNodes, // Store the final calculated nodes
      updatedEdges: finalEdges // Store the final edges
    };

    console.log(`[Clipboard] Pasting ${finalNodes.length} nodes and ${finalEdges.length} edges`);
    console.log(`[Clipboard] New node IDs: ${newNodeIds.join(', ')}`);
    
    try {
      flushSync(() => {
        // 1. Add new node contents to the store
        Object.entries(newNodeContents).forEach(([id, content]) => {
          setNodeContent(id, content);
        });
        
        // 2. Add nodes and edges to the structure store
        const currentNodes = useFlowStructureStore.getState().nodes;
        const currentEdges = useFlowStructureStore.getState().edges;
        setNodes([...currentNodes, ...finalNodes]); // Use finalNodes
        setEdges([...currentEdges, ...finalEdges]); // Use finalEdges
        
        // 3. Take snapshot - remove explicit type, rely on function signature
        const updatedNodes = useFlowStructureStore.getState().nodes;
        const updatedEdges = useFlowStructureStore.getState().edges;
        const updatedContents = getAllNodeContentsFromStore(); 
        pushSnapshot({ 
          nodes: updatedNodes,
          edges: updatedEdges,
          contents: cloneDeep(updatedContents)
        }); 
      });
      
      console.log('[Clipboard] State updated (flushSync complete)');

      function continueWithPasteProcess() {
        const currentLastPasteOp = lastPasteOpRef.current;
        if (!currentLastPasteOp) return;
        
        const { newNodeIds: pastedNodeIds } = currentLastPasteOp;
        
        setTimeout(() => {
          const allNodes = getNodes(); 
          const updatedNodesForSelection = allNodes.map((n: Node<NodeData>) => ({ 
            ...n,
            selected: pastedNodeIds.includes(n.id)
          }));
          setNodes(updatedNodesForSelection); 
          
          if (pastedNodeIds.length > 0) {
             // Pass the FIRST ID as an array 
             useFlowStructureStore.getState().setSelectedNodeIds?.([pastedNodeIds[0]]); 
             console.log(`[Clipboard] Selected ${pastedNodeIds.length} pasted nodes.`);
          }
          
          recentlyPastedNodeIdsRef.current = new Set(pastedNodeIds);
          focusViewportOnNodes(pastedNodeIds);
          
          const verifyTimeout = setTimeout(verifyReactFlowSync, 500);
          activeTimeoutRefs.current.push(verifyTimeout as unknown as number);
          
          const lockTimeout = setTimeout(() => {
            recentlyPastedNodeIdsRef.current.clear(); 
            console.log('[Clipboard] Selection lock released.');
          }, MAX_SELECTION_LOCK_TIME);
          activeTimeoutRefs.current.push(lockTimeout as unknown as number);

         }, 0); 
      }

      requestAnimationFrame(continueWithPasteProcess);
      
    } catch (error) {
      console.error('[Clipboard] Error during paste operation:', error);
      if (devFlags) devFlags.hasJustPasted = false; 
    } finally {
      // Ensure the paste lock is released
      const releaseLockTimeout = setTimeout(() => {
        isManualPasteInProgressRef.current = false;
        console.log('[Clipboard] Paste operation lock released.');
      }, 200);
      activeTimeoutRefs.current.push(releaseLockTimeout as unknown as number);
    }

  }, [reactFlowInstance, screenToFlowPosition, getViewport, setNodes, setEdges, setNodeContent, pushSnapshot, getNodes, focusViewportOnNodes, verifyReactFlowSync, nodes, edges, checkNodesInDOM, syncSelectionState]);

  // Check if pasting is possible
  const canPaste = hasClipboardData();

  /**
   * Keyboard event handler for Ctrl+C / Ctrl+V
   */
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey) {
      if (event.key === 'c' || event.key === 'C') {
        // Check if focus is on an input/textarea to avoid hijacking copy there
        if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
          return;
        }
        handleCopy();
      } else if (event.key === 'v' || event.key === 'V') {
        // Check if focus is on an input/textarea to avoid pasting there
        if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
          return;
        }
        // Get mouse position for pasting
        // This might need a more robust way to get the intended paste position
        const flowPane = document.querySelector('.react-flow__pane');
        let pastePosition: XYPosition | undefined = undefined;
        if (flowPane) {
          // For simplicity, pasting near center if mouse isn't over the pane
          // A better approach might store last mouse position over the pane
          pastePosition = screenToFlowPosition({
            x: window.innerWidth / 2, 
            y: window.innerHeight / 2
          });
        }
        handlePaste(pastePosition);
      }
    }
  };

  // Attach/detach keydown listener
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Clear any remaining timeouts on unmount
      activeTimeoutRefs.current.forEach(clearTimeout);
    };
  }, [handleCopy, handlePaste]);

  return { 
    handleCopy, 
    handlePaste, 
    canPaste,
    pasteVersion: window._devFlags?.pasteVersion || 0
  };
}; 