import { useCallback, useEffect, useRef } from 'react';
import { 
  Connection, 
  Edge, 
  Node,
  addEdge,
  useReactFlow,
  getConnectedEdges,
  useStore,
  NodeChange,
  NodeMouseHandler,
  OnNodesChange
} from '@xyflow/react'; 
import { NodeData } from '../types/nodes';
import { 
  setNodes as setZustandNodes, 
  setEdges as setZustandEdges, 
  useFlowStructureStore,
  setSelectedNodeIds
} from '../store/useFlowStructureStore';
import { getIntersectingGroupId } from '../utils/flow/nodeUtils';

// Define SelectionModifierKey type directly
type SelectionModifierKey = 'ctrl' | 'shift' | 'none';

interface UseNodeHandlersParams {
  onNodeSelect?: (nodeIds: string[] | null) => void;
}

interface UseNodeHandlersReturn {
  handleConnect: (connection: Connection) => void;
  handleNodeDragStop: (event: React.MouseEvent, node: Node<NodeData>) => void;
  handleSelectionDragStop: (event: React.MouseEvent, nodes: Node<NodeData>[]) => void;
  handleEdgesDelete: (edges: Edge[]) => void;
  handleNodesDelete: (nodes: Node<NodeData>[]) => void;
  handleNodeClick: NodeMouseHandler;
}

export function useNodeHandlers({ onNodeSelect }: UseNodeHandlersParams = {}): UseNodeHandlersReturn {
  const { getNodes, getEdges, setNodes } = useReactFlow();
  
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
    (event: React.MouseEvent, draggedNode: Node<NodeData>) => {
      const nodes = getNodes() as Node<NodeData>[];
      
      // Find intersecting group node
      const intersectingGroupId = getIntersectingGroupId(draggedNode, nodes);
      
      // Get current parent relationship
      // Note: React Flow v11+ uses parentNode, but our NodeData may use parentId
      // Added type assertion to avoid TypeScript errors
      const currentParentId = (draggedNode as any).parentNode || draggedNode.parentId;
      
      // Only update if parent relationship changed
      if (currentParentId !== intersectingGroupId) {
        console.log(`[NodeDragStop] Node ${draggedNode.id} parent changed: ${currentParentId || 'none'} -> ${intersectingGroupId || 'none'}`);
        
        let updatedNodes;
        
        if (intersectingGroupId) {
          // Node is being added to a group
          const groupNode = nodes.find(n => n.id === intersectingGroupId);
          if (groupNode) {
            // Calculate relative position
            const absoluteX = currentParentId 
              ? (draggedNode.position.x + (nodes.find(n => n.id === currentParentId)?.position.x || 0))
              : draggedNode.position.x;
            
            const absoluteY = currentParentId
              ? (draggedNode.position.y + (nodes.find(n => n.id === currentParentId)?.position.y || 0))
              : draggedNode.position.y;
            
            const relativeX = absoluteX - groupNode.position.x;
            const relativeY = absoluteY - groupNode.position.y;
            
            // Update node with new parent and relative position
            updatedNodes = nodes.map(node => {
              if (node.id === draggedNode.id) {
                return {
                  ...node,
                  // Use parentId that exists in our type definition
                  // The actual React Flow will interpret this correctly
                  parentId: intersectingGroupId,
                  position: {
                    x: relativeX,
                    y: relativeY
                  }
                };
              }
              return node;
            });
          } else {
            // Group not found, keep nodes unchanged
            updatedNodes = nodes;
          }
        } else if (currentParentId) {
          // Node is being removed from a group
          const parentNode = nodes.find(n => n.id === currentParentId);
          if (parentNode) {
            // Calculate absolute position
            const absoluteX = parentNode.position.x + draggedNode.position.x;
            const absoluteY = parentNode.position.y + draggedNode.position.y;
            
            // Update node with no parent and absolute position
            updatedNodes = nodes.map(node => {
              if (node.id === draggedNode.id) {
                return {
                  ...node,
                  parentId: undefined, // Clear parentId to remove from group
                  position: {
                    x: absoluteX,
                    y: absoluteY
                  }
                };
              }
              return node;
            });
          } else {
            // Parent not found, just remove parent references
            updatedNodes = nodes.map(node => {
              if (node.id === draggedNode.id) {
                return {
                  ...node,
                  parentId: undefined
                };
              }
              return node;
            });
          }
        } else {
          // No parent change, but might need other updates
          updatedNodes = nodes;
        }
        
        // Update store
        setZustandNodes(updatedNodes);
      } else {
        // No parent change, just update position
        setZustandNodes(nodes);
      }
    },
    [getNodes]
  );

  // Handle selection drag stop
  const handleSelectionDragStop = useCallback((event: React.MouseEvent, draggedNodesInput: Node[]) => {
      // console.log(`[SelectionDragStop] Multi-selection drag completed. Syncing positions.`);
      setZustandNodes(getNodes() as Node<NodeData>[]); 
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
  const handleNodesDelete = useCallback((nodesToDelete: Node<NodeData>[]) => {
    if (nodesToDelete.length === 0) return;
    const nodeIdsToDelete = new Set(nodesToDelete.map(n => n.id));
    const currentNodes = getNodes() as Node<NodeData>[]; 
    const currentEdges = getEdges();
    const remainingNodes = currentNodes.filter(node => !nodeIdsToDelete.has(node.id));
    const connectedEdges = getConnectedEdges(nodesToDelete, currentEdges);
    const connectedEdgeIds = new Set(connectedEdges.map(e => e.id));
    const remainingEdges = currentEdges.filter(edge => !connectedEdgeIds.has(edge.id));
    setZustandNodes(remainingNodes);
    setZustandEdges(remainingEdges);
    
    // 선택 상태 업데이트 로직 - 타입 안전하게 수정
    const currentSelectedIds = useFlowStructureStore.getState().selectedNodeIds;
    
    // 배열 타입 처리
    if (Array.isArray(currentSelectedIds)) {
      const newSelectedIds = currentSelectedIds.filter(id => !nodeIdsToDelete.has(id));
      if (newSelectedIds.length !== currentSelectedIds.length) {
        setSelectedNodeIds(newSelectedIds); 
        
        // onNodeSelect 호출 시 타입 안전성 확보
        if (onNodeSelect) {
          if (newSelectedIds.length > 0) {
            onNodeSelect(newSelectedIds);
          } else {
            onNodeSelect(null);
          }
        }
      }
    } 
    // 단일 ID 문자열 처리
    else if (typeof currentSelectedIds === 'string' && nodeIdsToDelete.has(currentSelectedIds)) {
      setSelectedNodeIds([]); // 빈 배열로 변경
      if (onNodeSelect) {
        onNodeSelect(null);
      }
    }
  }, [getNodes, getEdges, onNodeSelect]);

  // 노드 클릭 핸들러
  const handleNodeClick: NodeMouseHandler = useCallback((event, node) => {
    // 단일 노드 ID를 배열로 변환하여 전달
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