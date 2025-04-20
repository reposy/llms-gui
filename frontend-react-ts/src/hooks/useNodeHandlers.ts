import { useCallback, useEffect, useRef } from 'react';
import { 
  Connection, 
  Edge, 
  Node,
  addEdge,
  useReactFlow,
  getConnectedEdges,
} from '@xyflow/react'; 
import { NodeData } from '../types/nodes';
import { 
  setNodes as setZustandNodes, 
  setEdges as setZustandEdges, 
  useFlowStructureStore,
  setSelectedNodeIds
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

  // Handle node drag stop - 그룹 노드 관련 처리 수정 (위치 조정 제거)
  const handleNodeDragStop = useCallback(
    (event: React.MouseEvent, draggedNode: Node<NodeData>) => {
      // 드래그 종료 후 React Flow가 내부적으로 업데이트한 최신 노드 상태를 가져옵니다.
      const allNodes = getNodes();
      const draggedNodeWithUpdates = allNodes.find(n => n.id === draggedNode.id);
      
      if (!draggedNodeWithUpdates) return;

      // 1. 모든 그룹 노드 찾기
      const groupNodes = allNodes.filter(n => n.type === 'group');
      
      // 2. 현재 노드의 중심점 좌표 계산
      const draggedNodeCenter = {
        x: draggedNodeWithUpdates.position.x + (draggedNodeWithUpdates.width || 100) / 2,
        y: draggedNodeWithUpdates.position.y + (draggedNodeWithUpdates.height || 50) / 2
      };
      
      // 3. 노드가 어떤 그룹 안에 있는지 확인
      let foundParentGroup = null;
      for (const groupNode of groupNodes) {
        // 그룹 자신은 자신의 부모가 될 수 없음
        if (groupNode.id === draggedNode.id) continue;
        
        // 그룹 노드의 경계 계산
        const groupBounds = {
          left: groupNode.position.x,
          right: groupNode.position.x + (groupNode.width || 1200),
          top: groupNode.position.y,
          bottom: groupNode.position.y + (groupNode.height || 700)
        };
        
        // 노드 중심점이 그룹 내부에 있는지 확인
        if (
          draggedNodeCenter.x >= groupBounds.left &&
          draggedNodeCenter.x <= groupBounds.right &&
          draggedNodeCenter.y >= groupBounds.top &&
          draggedNodeCenter.y <= groupBounds.bottom
        ) {
          foundParentGroup = groupNode;
          break;
        }
      }
      
      // 4. 복사본 생성 후 업데이트
      const updatedNodes = allNodes.map(node => {
        if (node.id !== draggedNode.id) return node;
        
        // 현재 노드의 업데이트된 복사본 생성
        const updatedNode = { ...node } as any; // 타입 에러 해결을 위해 as any 사용
        
        if (foundParentGroup) {
          // 그룹 내부로 드래그된 경우, parentNode만 설정하고 위치는 변경하지 않음
          updatedNode.parentId = foundParentGroup.id;
          
          // extent 속성 제거 - 이 속성이 자동 위치 조정을 일으킴
          delete updatedNode.extent;
          
          // 위치는 변경하지 않고 그대로 유지 (절대 좌표 유지)
          // console.log(`[NodeDragStop] Node ${node.id} is now child of group ${foundParentGroup.id}, keeping absolute position`);
        } else if (updatedNode.parentId) {
          // 그룹 밖으로 드래그된 경우, parentNode 제거
          // parentNode 및 extent 속성 제거
          delete updatedNode.parentId;
          delete updatedNode.extent;
          
          // 위치는 이미 알맞게 설정되어 있으므로 변경 불필요
          // console.log(`[NodeDragStop] Node ${node.id} removed from group, keeping absolute position`);
        }
        
        return updatedNode;
      });
      
      // 5. 상태 업데이트
      setZustandNodes(updatedNodes as Node<NodeData>[]);
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

  // Handle nodes delete
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
    // 선택 상태 업데이트 로직...
    const currentSelectedIds = useFlowStructureStore.getState().selectedNodeIds;
    const newSelectedIds = currentSelectedIds.filter(id => !nodeIdsToDelete.has(id));
    if (newSelectedIds.length !== currentSelectedIds.length) {
        setSelectedNodeIds(newSelectedIds); // 여기서 사용됨
        onNodeSelect(newSelectedIds.length > 0 ? newSelectedIds : null);
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