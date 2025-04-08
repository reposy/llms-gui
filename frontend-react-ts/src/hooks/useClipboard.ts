import { useCallback, useEffect, useRef } from 'react';
import { useReactFlow, XYPosition, ReactFlowInstance, useStoreApi } from 'reactflow';
import { NodeData } from '../types/nodes';
import { 
  copySelectedNodes, 
  pasteClipboardContents, 
  hasClipboardData 
} from '../utils/clipboardUtils';
import { useFlowStructureStore } from '../store/useFlowStructureStore';
import { setNodeContent } from '../store/useNodeContentStore';
import { pushSnapshot } from '../store/useHistoryStore';
import { resetNodeStates } from '../store/useNodeStateStore';
import { getAllNodeContents } from '../store/useNodeContentStore';
import { applyNodeSelection, setSelectedNodeId } from '../store/useFlowStructureStore';
import { cloneDeep } from 'lodash';

export interface UseClipboardReturnType {
  handleCopy: () => void;
  handlePaste: (position?: XYPosition) => void;
  canPaste: boolean;
}

export const useClipboard = (): UseClipboardReturnType => {
  const reactFlowInstance = useReactFlow<NodeData>();
  const { getViewport, fitView, getNodes, getEdges, setViewport } = reactFlowInstance;
  const reactFlowStore = useStoreApi();
  const { nodes, edges, setNodes, setEdges } = useFlowStructureStore();
  
  // Keep track of the last paste operation for animation frame handling
  const lastPasteOpRef = useRef<{
    newNodeIds: string[];
    firstNodeId: string;
    updatedNodes: any[];
    updatedEdges: any[];
  } | null>(null);

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
      
      // Force React Flow's internal store to update
      console.log('[Clipboard] Forcing ReactFlow internal state sync');
      store.setNodes(currentNodes);
      store.setEdges(currentEdges);
    }
  }, [reactFlowStore]);

  /**
   * Ensure selection state is consistent between our Zustand store and ReactFlow
   */
  const syncSelectionState = useCallback((nodesToSelect: string[], primaryNodeId?: string) => {
    if (!nodesToSelect.length) return;
    
    console.log(`[Clipboard] Synchronizing selection state for ${nodesToSelect.length} nodes`);
    
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
        store.setNodes(updatedRfNodes);
      }
    }
    
    // 4. Finally, set the primary selected node for the sidebar if provided
    if (primaryNodeId) {
      setSelectedNodeId(primaryNodeId);
    }
  }, [getNodes, reactFlowStore, forceSyncReactFlow]);

  const handleCopy = useCallback(() => {
    const nodeCount = copySelectedNodes();
    if (nodeCount > 0) {
      console.log(`[Clipboard] Copied ${nodeCount} nodes`);
    }
  }, []);

  // Function to handle deferred UI updates after paste
  const handleDeferredPasteUIUpdates = useCallback(() => {
    if (!lastPasteOpRef.current) return;
    
    const { newNodeIds, firstNodeId, updatedNodes, updatedEdges } = lastPasteOpRef.current;
    
    // Ensure the ReactFlow internal state is up-to-date
    const currentReactFlowNodes = getNodes();
    const allNewNodesInReactFlow = newNodeIds.every(id => 
      currentReactFlowNodes.some(node => node.id === id)
    );
    
    console.log(`[Clipboard] ReactFlow internal state has ${currentReactFlowNodes.length} nodes`);
    
    if (!allNewNodesInReactFlow) {
      console.log(`[Clipboard] Not all pasted nodes are in ReactFlow state yet, delaying UI updates...`);
      // If ReactFlow hasn't fully synced, try to force sync and try again
      forceSyncReactFlow();
      // Delay and try again in next frame
      requestAnimationFrame(() => handleDeferredPasteUIUpdates());
      return;
    }
    
    // Re-apply selection state to ensure consistency
    syncSelectionState(newNodeIds, firstNodeId);
    
    // 3. Ensure group layout is properly updated for children
    const hasGroupNodes = updatedNodes.some(node => node.type === 'group');
    if (hasGroupNodes) {
      console.log('[Clipboard] Group nodes detected, refreshing layout');
      
      // First, get existing and new group nodes
      const groupNodes = updatedNodes.filter(node => node.type === 'group' && newNodeIds.includes(node.id));
      
      // Use a small timeout to ensure React's rendering is complete
      setTimeout(() => {
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
            
            // 4. Try to fit view to ensure new nodes are visible
            // Only fit to selection if few nodes pasted to avoid zooming out too far
            if (newNodeIds.length < 5) {
              try {
                fitView({
                  padding: 0.2,
                  duration: 200,
                  nodes: currentReactFlowNodes.filter(node => newNodeIds.includes(node.id))
                });
              } catch (e) {
                console.warn('[Clipboard] Could not fit view to selection:', e);
              }
            }
          });
        });
      }, 50); // Small timeout to ensure rendering is complete
    } else {
      // No group nodes, just fit view after a short delay
      setTimeout(() => {
        // Try to fit view to ensure new nodes are visible
        if (newNodeIds.length < 5) {
          try {
            fitView({
              padding: 0.2,
              duration: 200,
              nodes: currentReactFlowNodes.filter(node => newNodeIds.includes(node.id))
            });
          } catch (e) {
            console.warn('[Clipboard] Could not fit view to selection:', e);
          }
        }
      }, 50);
    }
    
    // Clear the reference after processing
    lastPasteOpRef.current = null;
  }, [getNodes, getViewport, setViewport, fitView, forceSyncReactFlow, syncSelectionState]);

  const handlePaste = useCallback((mousePosition?: XYPosition) => {
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
    
    // 1. FIRST: Initialize node content BEFORE updating the flow structure
    // This ensures the nodes have their content properly set before ReactFlow renders them
    for (const [nodeId, contentData] of Object.entries(nodeContents)) {
      const { content, nodeType } = contentData;
      console.log(`[Clipboard] Setting content for node ${nodeId} with type: ${nodeType}`);
      // Pass allowFallback=true to ensure content is always created even if type lookup fails
      setNodeContent(nodeId, content, true);
    }
    
    // Ensure nodes are marked as selected before setting them in the store
    const selectedNewNodes = newNodes.map(node => ({
      ...node,
      selected: true
    }));
    
    // 2. SECOND: Update flow structure
    const updatedNodes = [...nodes, ...selectedNewNodes];
    const updatedEdges = [...edges, ...newEdges];
    
    // Update the store
    setNodes(updatedNodes);
    setEdges(updatedEdges);
    
    // Apply selection immediately after setting nodes to reduce flicker
    if (newNodeIds.length > 0) {
      const firstNodeId = newNodeIds[0];
      syncSelectionState(newNodeIds, firstNodeId);
    }
    
    // Force React Flow to update its internal state
    forceSyncReactFlow();
    
    // 3. Reset execution state for pasted nodes
    resetNodeStates(newNodeIds);
    
    // 4. Push snapshot to history
    // Deep clone the contents to ensure we're capturing a true snapshot
    const allNodeContents = getAllNodeContents();
    console.log(`[Clipboard] Pushing snapshot with ${updatedNodes.length} nodes, ${updatedEdges.length} edges, and ${Object.keys(allNodeContents).length} content entries`);
    
    pushSnapshot({
      nodes: updatedNodes,
      edges: updatedEdges,
      contents: cloneDeep(allNodeContents)
    });
    
    // Store paste operation details for deferred processing
    if (newNodeIds.length > 0) {
      lastPasteOpRef.current = {
        newNodeIds,
        firstNodeId: newNodeIds[0],
        updatedNodes,
        updatedEdges
      };
      
      // Use requestAnimationFrame to defer UI updates until after the next render
      requestAnimationFrame(handleDeferredPasteUIUpdates);
    }
    
    console.log(`[Clipboard] Successfully pasted ${newNodes.length} nodes and ${newEdges.length} edges`);
  }, [getViewport, nodes, edges, setNodes, setEdges, handleDeferredPasteUIUpdates, forceSyncReactFlow, syncSelectionState]);

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
    };
  }, [handleCopy, handlePaste]);

  // Check if we have data to paste
  const canPaste = hasClipboardData();

  return {
    handleCopy,
    handlePaste,
    canPaste
  };
}; 