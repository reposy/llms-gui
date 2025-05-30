import { useCallback } from 'react';
import { 
  Connection, 
  Edge, 
  Node,
  addEdge,
  useReactFlow,
  getConnectedEdges,
  NodeMouseHandler
} from '@xyflow/react'; 
import { NodeProperty } from '../types/nodes';
import { 
  setNodes as setZustandNodes, 
  setEdges as setZustandEdges, 
  useFlowStructureStore,
  setSelectedNodeIds
} from '../store/useFlowStructureStore';
import { 
  getIntersectingGroupId, 
  absoluteToRelativePosition, 
  relativeToAbsolutePosition,
  prepareNodesForReactFlow,
  addNodeToGroup,
  removeNodeFromGroup
} from '../utils/flow/nodeUtils';

interface UseNodeHandlersParams {
  onNodeSelect?: (nodeIds: string[] | null) => void;
}

interface UseNodeHandlersReturn {
  handleConnect: (connection: Connection) => void;
  handleNodeDragStop: (event: React.MouseEvent, node: Node<NodeProperty>) => void;
  handleSelectionDragStop: (event: React.MouseEvent, nodes: Node<NodeProperty>[]) => void;
  handleEdgesDelete: (edges: Edge[]) => void;
  handleNodesDelete: (nodes: Node<NodeProperty>[]) => void;
  handleNodeClick: NodeMouseHandler;
}

/**
 * Calculate absolute position for a node, accounting for parent groups
 */
function getNodeAbsolutePosition(
  node: Node<NodeProperty>, 
  allNodes: Node<NodeProperty>[]
): { x: number, y: number } {
  if (!node.parentId) return { ...node.position };
  
  const parentNode = allNodes.find(n => n.id === node.parentId);
  return parentNode 
    ? relativeToAbsolutePosition(node.position, parentNode.position) 
    : { ...node.position };
}

/**
 * Update a node's parent relationship
 */
function updateNodeParentRelationship(
  node: Node<NodeProperty>, 
  newParentId: string | null, 
  allNodes: Node<NodeProperty>[]
): Node<NodeProperty>[] {
  const absolutePosition = getNodeAbsolutePosition(node, allNodes);
  const nodeWithAbsPos = { ...node, position: absolutePosition };
  
  if (newParentId) {
    const groupNode = allNodes.find(n => n.id === newParentId);
    if (!groupNode) {
      console.warn(`[updateNodeParentRelationship] Group ${newParentId} not found!`);
      return allNodes;
    }
    
    console.log(`[NodeDragStop] Adding node ${node.id} to group ${newParentId}`);
    return addNodeToGroup(nodeWithAbsPos, groupNode, allNodes);
  } else {
    console.log(`[NodeDragStop] Removing node ${node.id} from group ${node.parentId}`);
    return removeNodeFromGroup(nodeWithAbsPos, allNodes);
  }
}

export function useNodeHandlers({ onNodeSelect }: UseNodeHandlersParams = {}): UseNodeHandlersReturn {
  const { getNodes, getEdges, setNodes: setReactFlowNodes } = useReactFlow();
  const { nodes, setNodes: setZustandNodes } = useFlowStructureStore();

  // Handle new connections
  const handleConnect = useCallback((connection: Connection) => {
    const nodes = getNodes(); 
    const sourceNode = nodes.find(n => n.id === connection.source);
    const targetNode = nodes.find(n => n.id === connection.target);
    
    if (!sourceNode || !targetNode) return;
    
    const currentEdges = getEdges();
    const connectionExists = currentEdges.some(edge => 
      edge.source === connection.source && 
      edge.target === connection.target && 
      edge.sourceHandle === connection.sourceHandle && 
      edge.targetHandle === connection.targetHandle
    );
    
    if (connectionExists) return;
    
    const newEdge: Edge = {
      ...connection,
      id: crypto.randomUUID(),
      source: connection.source,
      target: connection.target,
    };
    
    setZustandEdges(addEdge(newEdge, currentEdges));
  }, [getNodes, getEdges]);

  // Handle node drag stop
  const handleNodeDragStop = useCallback(
    (event: React.MouseEvent, draggedNode: Node<NodeProperty>) => {
      // Find the group node that the dragged node intersects with
      const intersectingGroupId = getIntersectingGroupId(draggedNode, nodes);
      const currentParentId = draggedNode.parentId;

      // Update state only if parent relationship has changed
      if (currentParentId !== intersectingGroupId) {
        console.log(`[NodeDragStop] Parent changed for ${draggedNode.id}: ${currentParentId || 'none'} -> ${intersectingGroupId || 'none'}`);
        
        // Update node parent relationship
        const updatedNodes = updateNodeParentRelationship(draggedNode, intersectingGroupId, nodes);
        setZustandNodes(updatedNodes);
      } else {
        // If parent hasn't changed, we don't need to do anything
        // React Flow's onNodesChange will handle position updates
        console.log(`[NodeDragStop] Node ${draggedNode.id} position changed but parent remains the same`);
      }
    },
    [nodes, setZustandNodes]
  );

  // Handle selection drag stop
  const handleSelectionDragStop = useCallback((event: React.MouseEvent, draggedNodesInput: Node<NodeProperty>[]) => {
    setZustandNodes(getNodes() as Node<NodeProperty>[]); 
  }, [getNodes]);

  // Handle edges delete
  const handleEdgesDelete = useCallback((edgesToDelete: Edge[]) => {
    if (edgesToDelete.length === 0) return;
    
    const edgeIdsToDelete = new Set(edgesToDelete.map(e => e.id));
    const currentEdges = getEdges();
    const nextEdges = currentEdges.filter((edge) => !edgeIdsToDelete.has(edge.id));
    
    setZustandEdges(nextEdges);
  }, [getEdges]);

  // Handle nodes delete with updated type handling
  const handleNodesDelete = useCallback((nodesToDelete: Node<NodeProperty>[]) => {
    if (nodesToDelete.length === 0) return;
    
    // Process node deletion
    const nodeIdsToDelete = new Set(nodesToDelete.map(n => n.id));
    const currentNodes = getNodes() as Node<NodeProperty>[]; 
    const currentEdges = getEdges();
    
    // Remove deleted nodes
    const remainingNodes = currentNodes.filter(node => !nodeIdsToDelete.has(node.id));
    
    // Remove connected edges
    const connectedEdges = getConnectedEdges(nodesToDelete, currentEdges);
    const connectedEdgeIds = new Set(connectedEdges.map(e => e.id));
    const remainingEdges = currentEdges.filter(edge => !connectedEdgeIds.has(edge.id));
    
    // Update state
    setZustandNodes(remainingNodes);
    setZustandEdges(remainingEdges);
    
    // Update selection state
    const currentSelectedIds = useFlowStructureStore.getState().selectedNodeIds;
    
    // Standardize to array format
    const currentSelectedArray = Array.isArray(currentSelectedIds) 
      ? currentSelectedIds 
      : (typeof currentSelectedIds === 'string' ? [currentSelectedIds] : []);
    
    // Filter out deleted nodes
    const newSelectedIds = currentSelectedArray.filter(id => !nodeIdsToDelete.has(id));
    const selectionChanged = newSelectedIds.length !== currentSelectedArray.length;
    
    // Update selection if needed
    if (selectionChanged) {
      setSelectedNodeIds(newSelectedIds);
      if (onNodeSelect) {
        onNodeSelect(newSelectedIds.length > 0 ? newSelectedIds : null);
      }
    }
  }, [getNodes, getEdges, onNodeSelect]);

  // Node click handler
  const handleNodeClick: NodeMouseHandler = useCallback((event, node) => {
    // Pass single node ID as array
    if (onNodeSelect) {
      onNodeSelect([node.id]);
    }
  }, [onNodeSelect]);

  return {
    handleConnect,
    handleNodeDragStop,
    handleSelectionDragStop,
    handleEdgesDelete,
    handleNodesDelete,
    handleNodeClick
  };
}