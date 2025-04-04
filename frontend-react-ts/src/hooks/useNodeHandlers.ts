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
  handleNodeDragStop: (event: React.MouseEvent, node: Node) => void;
  handleSelectionDragStop: (event: React.MouseEvent, nodes: Node[]) => void;
  handleEdgesDelete: (edges: Edge[]) => void;
  handleNodesDelete: (nodes: Node[]) => void;
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
    );
    
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
    
    // Create new edge with the connection
    const newEdge: Edge = {
      ...connection,
      id: crypto.randomUUID(),
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

  // Handle node drag stop to update history
  const handleNodeDragStop = useCallback((event: React.MouseEvent, node: Node) => {
    if (isRestoringHistory.current) return;
    
    // Push current state to history
    pushToHistory(getNodes(), getEdges());
  }, [getNodes, getEdges, pushToHistory, isRestoringHistory]);

  // Handle selection drag stop to update history
  const handleSelectionDragStop = useCallback((event: React.MouseEvent, nodes: Node[]) => {
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
  const handleNodesDelete = useCallback((nodes: Node[]) => {
    if (isRestoringHistory.current) return;
    
    if (nodes.length > 0) {
      const nodeIds = new Set(nodes.map(n => n.id));
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