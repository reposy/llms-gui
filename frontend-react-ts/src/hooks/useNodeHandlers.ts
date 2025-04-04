import { useCallback } from 'react';
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
  OnSelectionChangeParams
} from 'reactflow';
import { NodeData } from '../types/nodes';
import { useDispatch } from 'react-redux';
import { setNodes as setReduxNodes, setEdges as setReduxEdges } from '../store/flowSlice';
import { removeConnectedEdges } from '../utils/flowUtils';
import { isEditingNodeRef } from './useFlowSync';

interface UseNodeHandlersOptions {
  onNodeSelect: (node: Node | null) => void;
  pushToHistory: (nodes: Node<NodeData>[], edges: Edge[]) => void;
  isRestoringHistory: React.MutableRefObject<boolean>;
}

interface UseNodeHandlersReturn {
  handleNodesChange: (changes: NodeChange[]) => void;
  handleEdgesChange: (changes: EdgeChange[]) => void;
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
  const { onNodeSelect, pushToHistory, isRestoringHistory } = options;
  const dispatch = useDispatch();
  const { getNodes, getEdges } = useReactFlow();

  // Handle nodes change (selection, position, etc)
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    // Skip if we're currently restoring history to avoid feedback loops
    if (isRestoringHistory.current) return;
    
    // Apply the changes to get the new state
    const nextNodes = applyNodeChanges(changes, localNodes);
    
    // Update local state
    setLocalNodes(nextNodes);
    
    // Determine if any position changed (dragging)
    const hasPositionChange = changes.some(
      change => change.type === 'position' && change.position
    );
    
    // Update Redux if there was a position change (to avoid unnecessary updates)
    if (hasPositionChange) {
      dispatch(setReduxNodes(nextNodes));
    }
    
    // Check for selection changes to update sidebar
    const selectionChange = changes.find(change => 
      change.type === 'select' && change.selected !== undefined
    ) as { id: string; selected: boolean } | undefined;
    
    if (selectionChange) {
      const selectedNode = nextNodes.find(node => node.id === selectionChange.id);
      if (selectedNode && selectionChange.selected) {
        onNodeSelect(selectedNode);
      } else if (!nextNodes.some(node => node.selected)) {
        onNodeSelect(null);
      }
    }
  }, [localNodes, setLocalNodes, dispatch, onNodeSelect, isRestoringHistory]);

  // Handle edges change
  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    // Skip if we're currently restoring history
    if (isRestoringHistory.current) return;
    
    // Apply the changes to get the new state
    const nextEdges = applyEdgeChanges(changes, localEdges);
    
    // Update local state
    setLocalEdges(nextEdges);
    
    // Update Redux
    dispatch(setReduxEdges(nextEdges));
  }, [localEdges, setLocalEdges, dispatch, isRestoringHistory]);

  // Handle new connections
  const handleConnect = useCallback((connection: Connection) => {
    // Skip if we're currently restoring history
    if (isRestoringHistory.current) return;
    
    // Ensure connection has required properties
    if (!connection.source || !connection.target) return;
    
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
    
    // Update Redux
    dispatch(setReduxEdges(nextEdges));
    
    // Add to history
    pushToHistory(localNodes, nextEdges);
  }, [localNodes, localEdges, setLocalEdges, dispatch, pushToHistory, isRestoringHistory]);

  // Handle selection change for sidebar update
  const handleSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    const { nodes } = params;
    
    if (nodes.length === 1) {
      onNodeSelect(nodes[0]);
    } else {
      onNodeSelect(null);
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
      // If we're in the middle of a history restoration, don't register these changes
      if (isRestoringHistory.current) {
        return;
      }
      
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
      
      // Only update if something changed
      if (needsUpdate) {
        setLocalNodes(updatedNodes);
        dispatch(setReduxNodes(updatedNodes));
      }

      // Always push to history to capture position changes
      pushToHistory(needsUpdate ? updatedNodes : localNodes, localEdges);
    },
    [localNodes, setLocalNodes, localEdges, pushToHistory, isRestoringHistory, checkNodeGroupIntersection, dispatch]
  );

  // Handle selection drag stop to update history
  const handleSelectionDragStop = useCallback((event: React.MouseEvent, nodes: Node<NodeData>[]) => {
    if (isRestoringHistory.current) return;
    
    // Push current state to history
    pushToHistory(getNodes(), getEdges());
  }, [getNodes, getEdges, pushToHistory, isRestoringHistory]);

  // Handle edges delete
  const handleEdgesDelete = useCallback((edges: Edge[]) => {
    if (isRestoringHistory.current) return;
    
    if (edges.length > 0) {
      const edgeIds = new Set(edges.map(e => e.id));
      const nextEdges = localEdges.filter(edge => !edgeIds.has(edge.id));
      
      // Update local state
      setLocalEdges(nextEdges);
      
      // Update Redux
      dispatch(setReduxEdges(nextEdges));
      
      // Push to history
      pushToHistory(localNodes, nextEdges);
    }
  }, [localNodes, localEdges, setLocalEdges, dispatch, pushToHistory, isRestoringHistory]);

  // Handle nodes delete
  const handleNodesDelete = useCallback((nodes: Node<NodeData>[]) => {
    if (isRestoringHistory.current) return;
    
    if (nodes.length > 0) {
      const nodeIds = new Set(nodes.map(n => n.id));
      
      // Check if the node being deleted is currently being edited
      if (isEditingNodeRef.current && nodeIds.has(isEditingNodeRef.current)) {
        console.log(`[NodesDelete] Clearing editing reference for deleted node ${isEditingNodeRef.current}`);
        isEditingNodeRef.current = null;
      }
      
      const nextNodes = localNodes.filter(node => !nodeIds.has(node.id));
      
      // Also remove connected edges
      const connectedEdges = getConnectedEdges(nodes, localEdges);
      const edgeIdsToRemove = new Set(connectedEdges.map(e => e.id));
      const nextEdges = localEdges.filter(edge => !edgeIdsToRemove.has(edge.id));
      
      // Update local state
      setLocalNodes(nextNodes);
      setLocalEdges(nextEdges);
      
      // Update Redux
      dispatch(setReduxNodes(nextNodes));
      dispatch(setReduxEdges(nextEdges));
      
      // Clear selection in sidebar
      onNodeSelect(null);
      
      // Push to history
      pushToHistory(nextNodes, nextEdges);
    }
  }, [localNodes, localEdges, setLocalNodes, setLocalEdges, dispatch, onNodeSelect, pushToHistory, isRestoringHistory]);

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