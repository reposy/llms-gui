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
  prepareNodesForReactFlow 
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
      if (process.env.NODE_ENV === 'development') {
        console.log(`[handleNodeDragStop] 노드 드래그 종료: id=${draggedNode.id}, type=${draggedNode.type}, position=(${draggedNode.position.x}, ${draggedNode.position.y})`);
      }
      
      const nodes = getNodes() as Node<NodeData>[];
      
      // 1. 현재 노드의 절대 위치 계산 (그룹 내부에 있는 경우 상대 위치를 절대 위치로 변환)
      let absolutePosition = { ...draggedNode.position };
      if (draggedNode.parentId) {
        const parentNode = nodes.find(n => n.id === draggedNode.parentId);
        if (parentNode) {
          absolutePosition = relativeToAbsolutePosition(draggedNode.position, parentNode.position);
        }
      }
      
      // 2. 노드가 그룹 내부에 있는지 확인
      const intersectingGroupId = getIntersectingGroupId(draggedNode, nodes);
      const currentParentId = draggedNode.parentId;
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`[handleNodeDragStop] 현재 부모: ${currentParentId || '없음'}, 교차하는 그룹: ${intersectingGroupId || '없음'}`);
      }
      
      // 3. 부모 관계 변경 시에만 처리
      if (currentParentId !== intersectingGroupId) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`[NodeDragStop] 노드 ${draggedNode.id}의 부모 변경: ${currentParentId || 'none'} -> ${intersectingGroupId || 'none'}`);
        }
        
        let updatedNodes;
        
        if (intersectingGroupId) {
          // 노드가 그룹에 추가됨
          const groupNode = nodes.find(n => n.id === intersectingGroupId);
          if (groupNode) {
            if (process.env.NODE_ENV === 'development') {
              console.log(`[handleNodeDragStop] 노드 ${draggedNode.id}를 그룹 ${intersectingGroupId}에 추가합니다.`);
            }
            
            // 그룹 노드와 비그룹 노드 분리
            const groupNodes = nodes.filter(n => n.type === 'group');
            const nonGroupNodes = nodes.filter(n => n.type !== 'group' && n.id !== draggedNode.id);
            
            // 절대 좌표를 그룹 기준 상대 좌표로 변환
            const relativePosition = absoluteToRelativePosition(absolutePosition, groupNode.position);
            
            if (process.env.NODE_ENV === 'development') {
              console.log(`[handleNodeDragStop] 좌표 변환: 절대(${absolutePosition.x}, ${absolutePosition.y}) -> 상대(${relativePosition.x}, ${relativePosition.y})`);
            }
            
            // 업데이트된 노드 생성
            const updatedDraggedNode = {
              ...draggedNode,
              parentId: intersectingGroupId,
              position: relativePosition
            };
            
            // 노드 배열 구성 (그룹 -> 비그룹 -> 변경된 노드)
            updatedNodes = [...groupNodes, ...nonGroupNodes, updatedDraggedNode];
          } else {
            // 그룹을 찾을 수 없음
            updatedNodes = nodes;
          }
        } else if (currentParentId) {
          // 노드가 그룹에서 제거됨
          if (process.env.NODE_ENV === 'development') {
            console.log(`[handleNodeDragStop] 노드 ${draggedNode.id}를 그룹 ${currentParentId}에서 제거합니다.`);
          }
          
          // 그룹과 비그룹 노드 분리
          const groupNodes = nodes.filter(n => n.type === 'group');
          const nonGroupNodes = nodes.filter(n => n.type !== 'group' && n.id !== draggedNode.id);
          
          // 업데이트된 노드 생성 (절대 좌표 사용)
          const updatedDraggedNode = {
            ...draggedNode,
            parentId: undefined,
            parentNode: null,
            position: absolutePosition
          };
          
          // 노드 배열 구성 (그룹 -> 비그룹 -> 변경된 노드)
          updatedNodes = [...groupNodes, ...nonGroupNodes, updatedDraggedNode];
        } else {
          // 부모 변경 없음, 위치만 업데이트
          if (process.env.NODE_ENV === 'development') {
            console.log(`[handleNodeDragStop] 부모 변경이 없으나, 위치는 업데이트합니다.`);
          }
          updatedNodes = nodes;
        }
        
        // 4. 상태 업데이트: React Flow -> Zustand
        if (process.env.NODE_ENV === 'development') {
          console.log(`[handleNodeDragStop] React Flow와 Zustand 상태 업데이트`);
        }
        
        // React Flow에 전달하기 전에 parentNode 속성 설정
        const nodesForReactFlow = prepareNodesForReactFlow(updatedNodes);
        
        // React Flow 내부 상태 먼저 업데이트
        setReactFlowNodes(nodesForReactFlow);
        
        // 그 다음 Zustand 상태 업데이트 (React Flow의 parentNode 속성을 제거하고 단일 방식 사용)
        setZustandNodes(updatedNodes);
      } else {
        // 단순 위치 변경만 있는 경우
        if (process.env.NODE_ENV === 'development') {
          console.log(`[handleNodeDragStop] 부모 변경 없음, 위치만 업데이트: 노드 ${draggedNode.id}`);
        }
        setZustandNodes(nodes);
      }
    },
    [getNodes, setReactFlowNodes]
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