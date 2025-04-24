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
import { 
  getIntersectingGroupId, 
  absoluteToRelativePosition, 
  relativeToAbsolutePosition,
  prepareNodesForReactFlow,
  addNodeToGroup,
  removeNodeFromGroup
} from '../utils/flow/nodeUtils';

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
  const { getNodes, getEdges, setNodes: setReactFlowNodes } = useReactFlow();
  const { nodes, setNodes: setZustandNodes } = useFlowStructureStore();
  
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
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[syncDraggedNodePositionsToZustand] Syncing positions for ${draggedNodes.length} nodes`);
    }
    
    const currentNodes = nodes;
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
  }, [nodes, setZustandNodes]);

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
      if (process.env.NODE_ENV === 'development') {
        // console.log(`[NodeDragStop] 노드 드래그 멈춤: ${draggedNode.id}`);
      }

      // 1. Get the current state from the hook/store
      const currentNodes = nodes; // Use current Zustand nodes

      // 2. Find the potential parent group based on current position
      // Calculate absolute position first, as draggedNode.position might be relative if already in a group
      let absolutePosition = { ...draggedNode.position };
      if (draggedNode.parentId) {
        const parentNode = currentNodes.find(n => n.id === draggedNode.parentId);
        if (parentNode) {
            absolutePosition = relativeToAbsolutePosition(draggedNode.position, parentNode.position);
        }
      }
      const intersectingGroupId = getIntersectingGroupId(draggedNode, currentNodes);

      // 3. Compare with the node's current parentId
      const currentParentId = draggedNode.parentId;

      // 4. Update Zustand state ONLY if the parent relationship has changed
      if (currentParentId !== intersectingGroupId) {
        console.log(`[NodeDragStop] Parent changed for ${draggedNode.id}: ${currentParentId || 'none'} -> ${intersectingGroupId || 'none'}`);
        let updatedNodes;

        if (intersectingGroupId) {
          // Node added to a group
          const groupNode = currentNodes.find(n => n.id === intersectingGroupId);
          if (groupNode) {
            // Use utility function to handle state update (includes sorting)
            updatedNodes = addNodeToGroup({ ...draggedNode, position: absolutePosition }, groupNode, currentNodes);
          } else {
            console.warn(`[NodeDragStop] Intersecting group ${intersectingGroupId} not found!`);
            updatedNodes = currentNodes; // No change if group not found
          }
        } else {
          // Node removed from a group
          // Use utility function to handle state update (includes sorting)
          updatedNodes = removeNodeFromGroup({ ...draggedNode, position: absolutePosition }, currentNodes);
        }

        // Directly update Zustand state with the new correctly structured array
        setZustandNodes(updatedNodes);
        console.log('[NodeDragStop] Updated Zustand state with new parent relationship.');

        // --- 제거: React Flow 상태 직접 업데이트 로직 ---
        // const nodesForReactFlow = prepareNodesForReactFlow(updatedNodes);
        // setReactFlowNodes(nodesForReactFlow);
        // console.log('[NodeDragStop] Updated React Flow state.');

      } else {
        if (process.env.NODE_ENV === 'development') {
          // console.log(`[NodeDragStop] 노드 ${draggedNode.id}의 부모 변경 없음.`);
        }
        // If parent hasn't changed, we might still need to update the node's position
        // if it was dragged within the same group or outside any group.
        // React Flow's onNodesChange should handle this position update automatically.
      }
    },
    [nodes, setZustandNodes, getIntersectingGroupId, addNodeToGroup, removeNodeFromGroup] // Include Zustand setter and utils in dependencies
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