import { useCallback, useEffect, useRef } from 'react';
import { 
  Connection, 
  Edge, 
  Node, 
  NodeChange, 
  EdgeChange, 
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  useReactFlow,
  getConnectedEdges,
  OnSelectionChangeParams,
  XYPosition
} from '@xyflow/react';
import { NodeData } from '../types/nodes';
import { 
  setNodes as setZustandNodes, 
  setEdges as setZustandEdges, 
  useFlowStructureStore,
  setSelectedNodeIds as setZustandSelectedNodeIds
} from '../store/useFlowStructureStore';
import { hasEqualSelection } from '../utils/ui/selectionUtils';
import { pushSnapshotAfterNodeOperation } from '../utils/ui/historyUtils';
import { logSelectionChange } from '../utils/ui/selectionUtils';
import { useNodeContentStore } from '../store/useNodeContentStore';

// Define SelectionModifierKey type directly
type SelectionModifierKey = 'ctrl' | 'shift' | 'none';

interface UseNodeHandlersOptions {
  onNodeSelect: (node: Node | null) => void;
}

interface UseNodeHandlersReturn {
  handleNodesChange?: (changes: NodeChange[]) => void;
  handleEdgesChange?: (changes: EdgeChange[]) => void;
  handleConnect: (connection: Connection) => void;
  handleSelectionChange: (params: OnSelectionChangeParams) => void;
  handleNodeDragStop: (event: React.MouseEvent, node: Node<NodeData>) => void;
  handleSelectionDragStop: (event: React.MouseEvent, nodes: Node<NodeData>[]) => void;
  handleEdgesDelete: (edges: Edge[]) => void;
  handleNodesDelete: (nodes: Node<NodeData>[]) => void;
}

export const useNodeHandlers = (
  localNodes: Node<NodeData>[],
  setLocalNodes: React.Dispatch<React.SetStateAction<Node<NodeData>[]>>,
  localEdges: Edge[],
  setLocalEdges: React.Dispatch<React.SetStateAction<Edge[]>>,
  options: UseNodeHandlersOptions
): UseNodeHandlersReturn => {
  const { onNodeSelect } = options;
  const { getNodes, getEdges } = useReactFlow();
  
  // Add refs to track modifier key states
  const isShiftPressed = useRef(false);
  const isCtrlPressed = useRef(false);
  
  // Set up keyboard listeners to track modifier key states
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        isShiftPressed.current = true;
      }
      if (e.key === 'Control' || e.key === 'Meta') { // Meta for Mac
        isCtrlPressed.current = true;
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        isShiftPressed.current = false;
      }
      if (e.key === 'Control' || e.key === 'Meta') {
        isCtrlPressed.current = false;
      }
    };
    
    // Handle focus/blur events to reset modifier states when window loses focus
    const handleBlur = () => {
      isShiftPressed.current = false;
      isCtrlPressed.current = false;
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  // Helper to determine which modifier key is active
  const getActiveModifierKey = (): SelectionModifierKey => {
    if (isShiftPressed.current) return 'shift';
    if (isCtrlPressed.current) return 'ctrl';
    return 'none';
  };

  /**
   * Shared helper function to sync dragged node positions to Zustand.
   * 
   * This function centralizes the position update logic to:
   * 1. Avoid duplicate code across different drag handlers
   * 2. Ensure consistent behavior between single and multi-node drags
   * 3. Prevent selection-related infinite update loops
   * 
   * Key aspects:
   * - Only updates positions without changing selection state (preventing loops)
   * - Used by both handleNodeDragStop and handleSelectionDragStop
   * - Properly respects history restoration to avoid interfering with undo/redo
   * 
   * @param draggedNodes - The nodes that were directly involved in the drag operation
   * @param allNodes - All nodes in the flow (defaults to localNodes if not provided)
   * @returns The nodes that were synced to Zustand (primarily for testing)
   */
  const syncDraggedNodesToZustand = (
    draggedNodes: Node<NodeData>[], 
    allNodes: Node<NodeData>[],
  ) => {
    // Skip empty sets of nodes
    if (draggedNodes.length === 0) return;
    
    console.log(`[syncDraggedNodesToZustand] Syncing positions for ${draggedNodes.length} nodes`);
    
    // Get current Zustand state for selection info
    const zustandState = useFlowStructureStore.getState();
    const zustandSelectedIds = zustandState.selectedNodeIds;
    
    // For each node being updated, preserve its original selection state from Zustand
    // This ensures we're only updating positions, not selection state
    const nodesToUpdate = allNodes.map(node => {
      // Check if this node's selection state matches Zustand's
      const shouldBeSelected = zustandSelectedIds.includes(node.id);
      
      // If selection state needs correction, fix it
      if (!!node.selected !== shouldBeSelected) {
        return {
          ...node,
          selected: shouldBeSelected // Ensure visual selection matches Zustand
        };
      }
      
      // Otherwise, keep node as is
      return node;
    });
    
    // Update Zustand nodes with the corrected selection state
    // This is critical for persisting drag operations without affecting selection
    setZustandNodes(nodesToUpdate);
    
    return nodesToUpdate;
  };

  /**
   * Applies node selection changes to the Zustand store,
   * respecting modifier keys for multi-selection.
   */
  const applyNodeSelection = useCallback((selectedNodeIds: string[], modifierKey: SelectionModifierKey) => {
    const currentSelection = useFlowStructureStore.getState().selectedNodeIds;
    let nextSelection: string[] = [];

    if (modifierKey === 'ctrl' || modifierKey === 'shift') {
      // Add/toggle selection
      nextSelection = [...currentSelection];
      selectedNodeIds.forEach(id => {
        if (nextSelection.includes(id)) {
          // If Ctrl/Cmd clicked on already selected node, remove it
          if (modifierKey === 'ctrl') {
             nextSelection = nextSelection.filter(nid => nid !== id);
          }
          // If Shift clicked, do nothing (already selected)
        } else {
          // Add to selection
          nextSelection.push(id);
        }
      });
      // Handle the case where the only node clicked was *already* selected and should be deselected with ctrl
      if (selectedNodeIds.length === 1 && nextSelection.length === 0 && currentSelection.includes(selectedNodeIds[0])) {
          // Stay deselected (handled by the filter above)
      } else if (selectedNodeIds.length === 1 && !currentSelection.includes(selectedNodeIds[0])) {
          // It was a new single selection added via modifier, keep others selected
      }

    } else {
      // Replace selection (no modifier or single click)
      nextSelection = selectedNodeIds;
    }

    // Only update if the final selection is different
    if (!hasEqualSelection(currentSelection, nextSelection)) {
      console.log(`[applyNodeSelection] Updating selection:`, nextSelection);
      setZustandSelectedNodeIds(nextSelection);
    }

  }, []);

  // Handle nodes change (selection, position, etc)
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    // Use the modifier key state
    const modifierKey = getActiveModifierKey();
    
    // Filter selection changes for special handling
    const selectionChanges = changes.filter(change => 
      change.type === 'select' && change.selected !== undefined
    );
    
    // Filter position changes (dragging)
    const positionChanges = changes.filter(change => 
      change.type === 'position' && change.position
    );
    
    // Apply the changes to get the new state ONLY for local ReactFlow display
    // This doesn't affect Zustand's source of truth yet
    const nextNodes = applyNodeChanges(changes, localNodes);
    
    // Update local React Flow state
    setLocalNodes(nextNodes);
    
    // Special selection debounce for paste operations
    // We'll track when the last paste-triggered selection happened to avoid loops
    const now = Date.now();
    const lastSelectionChange = useRef({ time: 0 });
    const isPossiblePasteSelection = selectionChanges.length > 1 && 
      selectionChanges.every(change => (change as any).selected === true);
    
    // Handle selection changes - delegate to applyNodeSelection
    if (selectionChanges.length > 0) {
      // Get the currently selected node IDs
      const selectedNodeIds = nextNodes
        .filter(node => node.selected)
        .map(node => node.id);
      
      // Get current selection from Zustand
      const currentSelection = useFlowStructureStore.getState().selectedNodeIds;
      
      // For selection operations after paste, be more aggressive with debouncing
      // to avoid loops of unnecessary selection updates  
      if (isPossiblePasteSelection && now - lastSelectionChange.current.time < 200) {
        console.log('[handleNodesChange] Debouncing rapid selection change', {
          selectedNodeIds,
          timeSinceLastChange: now - lastSelectionChange.current.time
        });
      } 
      // Otherwise, handle the selection normally
      else {
        // Only update if the selection actually changed
        const selectionHasSameElements = hasEqualSelection(selectedNodeIds, currentSelection);
        
        // Update if selection changed or we have a multi-selection
        if (!selectionHasSameElements || selectedNodeIds.length > 1) {
          console.log('[handleNodesChange] Selection changed:', selectedNodeIds);
          
          // Delegate to applyNodeSelection - the SINGLE SOURCE OF TRUTH for selection
          applyNodeSelection(selectedNodeIds, modifierKey);
          
          // Update lastSelectionChange time
          lastSelectionChange.current.time = now;
          
          // Handle sidebar updates based on selection count
          const selectedNodes = nextNodes.filter(node => node.selected);
          if (selectedNodes.length === 1) {
            onNodeSelect(selectedNodes[0]);
          } else if (selectedNodes.length > 1) {
            // Multiple nodes selected
            onNodeSelect(null);
          } else {
            onNodeSelect(null);
          }
        } else {
          console.log('[handleNodesChange] Selection unchanged, skipping update', {
            selectedNodeIds,
            currentSelection
          });
        }
      }
    }
    
    // Handle position changes separately (dragging)
    // These are local changes that will be committed on drag stop
    if (positionChanges.length > 0) {
      console.log(`[handleNodesChange] Processing ${positionChanges.length} position changes. MultiSelect: ${nextNodes.filter(n => n.selected).length > 1}`);
      
      // We don't update Zustand here - position updates will be handled in 
      // handleNodeDragStop/handleSelectionDragStop when the drag operation completes.
      // This avoids excessive updates during dragging.
      
      // For multi-node selections during drag, ensure selection state consistency
      const selectedNodeIds = nextNodes
        .filter(node => node.selected)
        .map(node => node.id);
        
      if (selectedNodeIds.length > 1) {
        // Get current selection from Zustand
        const currentSelection = useFlowStructureStore.getState().selectedNodeIds;
        
        // Only update selection if it's actually different
        if (!hasEqualSelection(selectedNodeIds, currentSelection)) {
          console.log('[handleNodesChange] Multi-node drag detected with selection change');
          // Delegate to applyNodeSelection
          applyNodeSelection(selectedNodeIds, 'none'); // 'none' to preserve current multiple selection
        }
      }
    }
  }, [localNodes, setLocalNodes, onNodeSelect, applyNodeSelection]);

  // Handle edges change
  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    // Apply the changes to get the new state
    const nextEdges = applyEdgeChanges(changes, localEdges);
    
    // Update local state
    setLocalEdges(nextEdges);
    
    // Update Zustand
    setZustandEdges(nextEdges);
  }, [localEdges, setLocalEdges]);

  // Handle new connections
  const handleConnect = useCallback((connection: Connection) => {
    // Ensure connection has required properties
    if (!connection.source || !connection.target) {
      console.warn("[handleConnect] Invalid connection: missing source or target");
      return;
    }
    
    // Get source and target nodes
    const sourceNode = localNodes.find(node => node.id === connection.source);
    const targetNode = localNodes.find(node => node.id === connection.target);
    
    if (!sourceNode || !targetNode) {
      console.warn(`[handleConnect] Invalid connection: ${!sourceNode ? 'source' : 'target'} node not found`);
      return;
    }
    
    // Check if this connection already exists to prevent duplicates
    const connectionExists = localEdges.some(edge => 
      edge.source === connection.source && 
      edge.target === connection.target && 
      edge.sourceHandle === connection.sourceHandle && 
      edge.targetHandle === connection.targetHandle
    );
    
    if (connectionExists) {
      console.warn("[handleConnect] Connection already exists, skipping duplicate");
      return;
    }
    
    console.log(`[handleConnect] Creating edge from ${sourceNode.type}:${connection.source} to ${targetNode.type}:${connection.target}`, {
      sourceHandle: connection.sourceHandle,
      targetHandle: connection.targetHandle
    });
    
    // Create new edge with the connection
    const newEdge: Edge = {
      ...connection,
      id: crypto.randomUUID(),
      source: connection.source,
      target: connection.target,
    };
    
    // Add the new edge to the existing edges
    const nextEdges = addEdge(newEdge, localEdges);
    
    // Update local state
    setLocalEdges(nextEdges);
    
    // Update Zustand
    setZustandEdges(nextEdges);
    
    // Use timeout to ensure state updates settle before snapshot
    setTimeout(() => {
      const { nodes: currentNodes } = useFlowStructureStore.getState();
      setZustandNodes(currentNodes); // Sync nodes (might not be necessary but safer)
      setZustandEdges(nextEdges); // Sync the newly added edge
      pushSnapshotAfterNodeOperation('Connect Edge');
    }, 0);
  }, [localNodes, localEdges, setLocalEdges]);

  // Handle selection change for sidebar update
  const handleSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    const { nodes: selectedNodes } = params;
    const selectedNode = selectedNodes.length === 1 ? selectedNodes[0] : null;
    
    // Call the passed onNodeSelect callback
    onNodeSelect(selectedNode);

    // Update Zustand selection state
    const selectedIds = selectedNodes.map(n => n.id);
    if (!hasEqualSelection(useFlowStructureStore.getState().selectedNodeIds, selectedIds)) {
      logSelectionChange(selectedIds); // Log the selection change
      setZustandSelectedNodeIds(selectedIds);
    }
  }, [onNodeSelect]);

  // Helper function to detect group intersections
  const checkNodeGroupIntersection = useCallback((node: Node<NodeData>, allNodes: Node<NodeData>[]) => {
    // Skip if node is already in a group
    if (node.parentNode) return null;

    // Find all group nodes
    const groupNodes = allNodes.filter(n => n.type === 'group' && n.id !== node.id);

    // Check if the node intersects with any group
    for (const group of groupNodes) {
      if (!group.position || !group.style) continue;
      
      const groupBounds = {
        left: group.position.x,
        top: group.position.y,
        right: group.position.x + (group.style.width as number || 800),
        bottom: group.position.y + (group.style.height as number || 400)
      };
      
      const nodeBounds = {
        left: node.position.x,
        top: node.position.y,
        right: node.position.x + (node.width || 350), // Estimated default width
        bottom: node.position.y + (node.height || 150) // Estimated default height
      };
      
      // Check if node is fully contained within the group
      if (
        nodeBounds.left >= groupBounds.left &&
        nodeBounds.right <= groupBounds.right &&
        nodeBounds.top >= groupBounds.top &&
        nodeBounds.bottom <= groupBounds.bottom
      ) {
        return {
          group,
          relativePosition: {
            x: node.position.x - group.position.x,
            y: node.position.y - group.position.y
          }
        };
      }
    }
    
    return null;
  }, []);

  // Handle node drag stop to update history
  const handleNodeDragStop = useCallback(
    (event: React.MouseEvent, node: Node<NodeData>) => {
      let updatedNodes = [...localNodes];
      let needsUpdate = false;
      
      // Case 1: Check if node is being dragged into a group
      if (!node.parentNode) {
        const intersection = checkNodeGroupIntersection(node, localNodes);
        
        if (intersection) {
          // Node intersects with a group, update its parentNode
          updatedNodes = localNodes.map(n => {
            if (n.id === node.id) {
              return {
                ...n,
                parentNode: intersection.group.id,
                position: intersection.relativePosition,
              };
            }
            return n;
          });

          console.log(`[NodeDrag] Node ${node.id} placed in group ${intersection.group.id}`);
          needsUpdate = true;
        }
      } 
      // Case 2: Check if node is being dragged out of its parent group
      else {
        // Find the parent group
        const parentGroup = localNodes.find(n => n.id === node.parentNode);
        
        if (parentGroup && parentGroup.position && parentGroup.style) {
          // Calculate parent group bounds
          const groupBounds = {
            left: parentGroup.position.x,
            top: parentGroup.position.y,
            right: parentGroup.position.x + (parentGroup.style.width as number || 800),
            bottom: parentGroup.position.y + (parentGroup.style.height as number || 400)
          };
          
          // Get the node's absolute position in the flow
          const nodeAbsolutePos = {
            x: parentGroup.position.x + node.position.x,
            y: parentGroup.position.y + node.position.y
          };
          
          const nodeBounds = {
            left: nodeAbsolutePos.x,
            top: nodeAbsolutePos.y,
            right: nodeAbsolutePos.x + (node.width || 350), // Estimated default width
            bottom: nodeAbsolutePos.y + (node.height || 150) // Estimated default height
          };
          
          // Check if node is no longer fully contained within the parent group
          const isOutsideGroup = 
            nodeBounds.left < groupBounds.left ||
            nodeBounds.right > groupBounds.right ||
            nodeBounds.top < groupBounds.top ||
            nodeBounds.bottom > groupBounds.bottom;
          
          if (isOutsideGroup) {
            // Node is outside its parent group, remove parentNode reference
            updatedNodes = localNodes.map(n => {
              if (n.id === node.id) {
                // Return node with absolute position and no parent
                return {
                  ...n,
                  parentNode: undefined,
                  position: nodeAbsolutePos
                };
              }
              return n;
            });
            
            console.log(`[NodeDrag] Node ${node.id} removed from group ${parentGroup.id}`);
            needsUpdate = true;
          }
        }
      }
      
      // Only update local state if node-group membership changed
      if (needsUpdate) {
        setLocalNodes(updatedNodes);
      }

      // Sync the final node positions to Zustand (either modified nodes or current nodes)
      const nodesToSync = needsUpdate ? updatedNodes : localNodes;
      syncDraggedNodesToZustand([node], nodesToSync);
      
      // Use timeout to ensure state updates settle before snapshot
      setTimeout(() => {
        const { nodes: currentNodes } = useFlowStructureStore.getState();
        setZustandNodes(currentNodes); // Sync nodes (might not be necessary but safer)
        setZustandEdges(localEdges); // Sync the updated edges
        pushSnapshotAfterNodeOperation('Drag Node');
      }, 0);
    },
    [localNodes, setLocalNodes, localEdges, syncDraggedNodesToZustand]
  );

  // Handle selection drag stop to update history
  const handleSelectionDragStop = useCallback((event: React.MouseEvent, nodes: Node<NodeData>[]) => {
    console.log(`[SelectionDragStop] Multi-selection drag completed for ${nodes.length} nodes`);
    
    // Get the current nodes with their updated positions after drag
    const currentNodes = getNodes();
    const currentEdges = getEdges();
    
    // Sync dragged node positions to Zustand using the shared helper
    syncDraggedNodesToZustand(nodes, currentNodes);
    
    // Use timeout to ensure state updates settle before snapshot
    setTimeout(() => {
      const { nodes: currentNodes } = useFlowStructureStore.getState();
      setZustandNodes(currentNodes); // Sync nodes (might not be necessary but safer)
      setZustandEdges(currentEdges); // Sync the updated edges
      pushSnapshotAfterNodeOperation('Drag Node');
    }, 0);
  }, [getNodes, getEdges, syncDraggedNodesToZustand]);

  // Handle edges delete
  const handleEdgesDelete = useCallback((edges: Edge[]) => {
    if (edges.length > 0) {
      console.log(`[EdgesDelete] Deleting ${edges.length} edges`);
      const edgeIds = new Set(edges.map(e => e.id));
      const nextEdges = localEdges.filter(edge => !edgeIds.has(edge.id));
      
      // Update local state
      setLocalEdges(nextEdges);
      
      // Update Zustand store - ensure this happens for proper persistence
      setZustandEdges(nextEdges);
      
      // Use timeout to ensure state updates settle before snapshot
      setTimeout(() => {
        const { nodes: currentNodes } = useFlowStructureStore.getState();
        setZustandNodes(currentNodes); // Sync nodes (might not be necessary but safer)
        setZustandEdges(nextEdges); // Sync the updated edges
        pushSnapshotAfterNodeOperation('Delete Edges');
      }, 0);
      
      console.log(`[EdgesDelete] Updated edges count: ${nextEdges.length}`);
    }
  }, [localEdges, setLocalEdges]);

  // Handle nodes delete
  const handleNodesDelete = useCallback((nodes: Node<NodeData>[]) => {
    if (nodes.length > 0) {
      const nodeIds = new Set(nodes.map(n => n.id));
      
      // Find any group nodes being deleted
      const groupNodesToDelete = nodes.filter(node => node.type === 'group');
      let updatedNodes = [...localNodes];
      
      // If we're deleting group nodes, we need to update their children
      if (groupNodesToDelete.length > 0) {
        console.log(`[NodesDelete] Processing ${groupNodesToDelete.length} group nodes`);
        
        // Process each group node
        for (const groupNode of groupNodesToDelete) {
          // Find all child nodes for this group
          const childNodes = updatedNodes.filter(node => node.parentNode === groupNode.id);
          
          if (childNodes.length > 0) {
            console.log(`[NodesDelete] Updating ${childNodes.length} child nodes for group ${groupNode.id}`);
            
            // Update child nodes to remove parent reference and update positions
            updatedNodes = updatedNodes.map(node => {
              if (node.parentNode === groupNode.id) {
                // Calculate absolute position based on group's position
                const absolutePosition = {
                  x: (groupNode.position?.x || 0) + node.position.x,
                  y: (groupNode.position?.y || 0) + node.position.y
                };
                
                // Return updated node with absolute position and no parent
                return {
                  ...node,
                  parentNode: undefined,
                  position: absolutePosition,
                  positionAbsolute: absolutePosition
                };
              }
              return node;
            });
          }
        }
      }
      
      // Filter out nodes to delete
      const nextNodes = updatedNodes.filter(node => !nodeIds.has(node.id));
      
      // Also remove connected edges
      const connectedEdges = getConnectedEdges(nodes, localEdges);
      const edgeIdsToRemove = new Set(connectedEdges.map(e => e.id));
      const nextEdges = localEdges.filter(edge => !edgeIdsToRemove.has(edge.id));
      
      // Update local state
      setLocalNodes(nextNodes);
      setLocalEdges(nextEdges);
      
      // Update Zustand
      setZustandNodes(nextNodes);
      setZustandEdges(nextEdges);
      
      // Clear selection in sidebar
      onNodeSelect(null);
      
      // Use timeout to ensure state updates settle before snapshot
      setTimeout(() => {
        const { nodes: currentNodes } = useFlowStructureStore.getState();
        setZustandNodes(currentNodes); // Sync nodes (might not be necessary but safer)
        setZustandEdges(nextEdges); // Sync the updated edges
        pushSnapshotAfterNodeOperation('Delete Nodes');
      }, 0);
    }
  }, [localNodes, localEdges, setLocalNodes, setLocalEdges, onNodeSelect, getConnectedEdges]);

  return {
    handleNodesChange,
    handleEdgesChange,
    handleConnect,
    handleSelectionChange,
    handleNodeDragStop,
    handleSelectionDragStop,
    handleEdgesDelete,
    handleNodesDelete
  };
}; 