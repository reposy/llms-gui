import { useCallback, useEffect, useRef } from 'react';
import { 
  Connection, 
  Edge, 
  Node, 
  addEdge,
  useReactFlow,
  getConnectedEdges,
  XYPosition,
} from '@xyflow/react';
import { NodeData } from '../types/nodes';
import { 
  setNodes as setZustandNodes, 
  setEdges as setZustandEdges, 
  useFlowStructureStore,
  setSelectedNodeIds as setZustandSelectedNodeIds
} from '../store/useFlowStructureStore';

// Define SelectionModifierKey type directly
type SelectionModifierKey = 'ctrl' | 'shift' | 'none';

interface UseNodeHandlersOptions {
  onNodeSelect: (nodeIds: string[] | null) => void;
}

interface UseNodeHandlersReturn {
  handleConnect: (connection: Connection) => void;
  handleNodeDragStop: (event: React.MouseEvent, node: Node<NodeData>) => void;
  handleSelectionDragStop: (event: React.MouseEvent, nodes: Node<NodeData>[]) => void;
  handleEdgesDelete: (edges: Edge[]) => void;
  handleNodesDelete: (nodes: Node<NodeData>[]) => void;
}

export const useNodeHandlers = (
  options: UseNodeHandlersOptions
): UseNodeHandlersReturn => {
  const { onNodeSelect } = options;
  const { getNodes, getEdges, getNode } = useReactFlow();
  
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
   * Only syncs `position`, not `positionAbsolute`.
   */
  const syncDraggedNodePositionsToZustand = useCallback((draggedNodes: Node<NodeData>[]) => {
    if (draggedNodes.length === 0) return;
    
    console.log(`[syncDraggedNodePositionsToZustand] Syncing positions for ${draggedNodes.length} nodes`);
    
    const currentNodes = useFlowStructureStore.getState().nodes;
    const draggedNodeIds = new Set(draggedNodes.map(n => n.id));
    
    const updatedNodes = currentNodes.map(node => {
      const draggedVersion = draggedNodes.find(dn => dn.id === node.id);
      if (draggedVersion) {
        return {
          ...node, 
          position: draggedVersion.position, 
        };
      }
      return node; 
    });
    
    setZustandNodes(updatedNodes);
  }, []);

  // Handle new connections
  const handleConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) {
      console.warn("[handleConnect] Invalid connection: missing source or target");
      return;
    }
    
    const sourceNode = getNode(connection.source);
    const targetNode = getNode(connection.target);
    
    if (!sourceNode || !targetNode) {
      console.warn(`[handleConnect] Invalid connection: ${!sourceNode ? 'source' : 'target'} node not found`);
      return;
    }
    
    const currentEdges = getEdges();
    const connectionExists = currentEdges.some(edge => 
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
    
    const newEdge: Edge = {
      ...connection,
      id: crypto.randomUUID(),
      source: connection.source,
      target: connection.target,
    };
    
    const newEdges = addEdge(newEdge, currentEdges);
    setZustandEdges(newEdges);
  }, [getNode, getEdges]);

  // Handle node drag stop to update history
  const handleNodeDragStop = useCallback(
    (event: React.MouseEvent, draggedNode: Node<NodeData>) => {
      const latestNode = getNode(draggedNode.id);
      if (!latestNode) return; 

      // Group membership logic removed. Only sync position.
      console.log('[NodeDrag] Syncing dragged node position to Zustand.');
      // Assert the type of latestNode before passing to sync function
      syncDraggedNodePositionsToZustand([latestNode as Node<NodeData>]); 
    },
    // Removed checkNodeGroupIntersection. Only getNode, getNodes, sync... needed.
    [getNode, getNodes, syncDraggedNodePositionsToZustand] 
  );

  // Handle selection drag stop to update history
  const handleSelectionDragStop = useCallback((event: React.MouseEvent, draggedNodes: Node<NodeData>[]) => {
    console.log(`[SelectionDragStop] Multi-selection drag completed for ${draggedNodes.length} nodes`);
    
    const latestDraggedNodes = draggedNodes.map(n => getNode(n.id)).filter(Boolean) as Node<NodeData>[];
    
    if (latestDraggedNodes.length > 0) {
      syncDraggedNodePositionsToZustand(latestDraggedNodes);
    }
  }, [getNode, syncDraggedNodePositionsToZustand]);

  // Handle edges delete
  const handleEdgesDelete = useCallback((edgesToDelete: Edge[]) => {
    if (edgesToDelete.length === 0) return;
    
    console.log(`[EdgesDelete] Deleting ${edgesToDelete.length} edges`);
    const edgeIdsToDelete = new Set(edgesToDelete.map(e => e.id));
    const currentEdges = getEdges();
    
    const nextEdges = currentEdges.filter((edge) => !edgeIdsToDelete.has(edge.id));
    setZustandEdges(nextEdges);
  }, [getEdges]);

  // Handle nodes delete
  const handleNodesDelete = useCallback((nodesToDelete: Node<NodeData>[]) => {
    if (nodesToDelete.length === 0) return;
    
    const nodeIdsToDelete = new Set(nodesToDelete.map(n => n.id));
    const currentNodes = getNodes() as Node<NodeData>[];
    const currentEdges = getEdges();
    
    // 1. Filter out nodes to delete
    const remainingNodes = currentNodes.filter(node => !nodeIdsToDelete.has(node.id));
    
    // 2. Get all connected edges to deleted nodes
    const connectedEdges = getConnectedEdges(nodesToDelete, currentEdges);
    const connectedEdgeIds = new Set(connectedEdges.map(e => e.id));
    
    // 3. Filter out connected edges
    const remainingEdges = currentEdges.filter(edge => !connectedEdgeIds.has(edge.id));
    
    // 4. Update Zustand state
    setZustandNodes(remainingNodes);
    setZustandEdges(remainingEdges);

    // 5. Clear selection if all selected nodes were deleted
    if (remainingNodes.every(node => !node.selected)) {
      setZustandSelectedNodeIds([]);
      onNodeSelect(null);
    } else {
      // If some selected nodes remain, update selection
      const selectedNodeIds = remainingNodes
        .filter(node => node.selected)
        .map(node => node.id);
      setZustandSelectedNodeIds(selectedNodeIds);
      onNodeSelect(selectedNodeIds.length > 0 ? selectedNodeIds : null);
    }
  }, [getNodes, getEdges, onNodeSelect]);

  return {
    handleConnect,
    handleNodeDragStop,
    handleSelectionDragStop,
    handleEdgesDelete,
    handleNodesDelete
  };
}; 