import { Node, Position, XYPosition, Edge } from '@xyflow/react';
import { GroupNodeData, LLMNodeData, NodeData } from '../../types/nodes';
import { v4 as uuidv4 } from 'uuid';

/**
 * 노드를 React Flow에 전달하기 전에 필요한 내부 속성을 설정하는 헬퍼 함수
 * parentId를 사용하여 parentNode 속성을 설정하고 좌표를 일관적으로 관리합니다.
 * @param nodes 처리할 노드 배열
 * @returns 처리된 노드 배열
 */
export function prepareNodesForReactFlow(nodes: Node<NodeData>[]): Node<NodeData>[] {
  // 먼저 그룹 노드들을 필터링합니다
  const groupNodes = nodes.filter(node => node.type === 'group');
  const nonGroupNodes = nodes.filter(node => node.type !== 'group');
  
  // 그룹이 아닌 노드들을 처리합니다
  const processedNonGroupNodes = nonGroupNodes.map(node => {
    // parentId가 있으면 React Flow용 parentNode 속성도 설정
    if (node.parentId) {
      return {
        ...node,
        // React Flow 내부 처리를 위해 parentNode 속성도 설정
        parentNode: node.parentId
      };
    }
    
    // parentId가 없으면 parentNode도 명시적으로 null로 설정
    return {
      ...node,
      parentNode: null // 명시적으로 null을 설정하여 이전에 있었을 수 있는 parentNode를 제거
    };
  });
  
  // 그룹 노드가 먼저 오는 순서로 배열을 구성 (React Flow 요구사항)
  return [...groupNodes, ...processedNonGroupNodes];
}

/**
 * 절대 좌표를 부모 노드 기준의 상대 좌표로 변환합니다
 * @param position 절대 좌표
 * @param parentPosition 부모 노드의 위치
 * @returns 상대 좌표
 */
export function absoluteToRelativePosition(
  position: { x: number, y: number },
  parentPosition: { x: number, y: number }
): { x: number, y: number } {
  return {
    x: position.x - parentPosition.x,
    y: position.y - parentPosition.y
  };
}

/**
 * 상대 좌표를 절대 좌표로 변환합니다
 * @param position 상대 좌표
 * @param parentPosition 부모 노드의 위치
 * @returns 절대 좌표
 */
export function relativeToAbsolutePosition(
  position: { x: number, y: number },
  parentPosition: { x: number, y: number }
): { x: number, y: number } {
  return {
    x: position.x + parentPosition.x,
    y: position.y + parentPosition.y
  };
}

/**
 * Adds a node to a group
 * @param node Node to add to the group
 * @param groupNode Group node
 * @param nodes All nodes in the flow
 * @returns Updated nodes array
 */
export function addNodeToGroup(
  node: Node<NodeData>, 
  groupNode: Node<NodeData>, 
  nodes: Node<NodeData>[]
): Node<NodeData>[] {
  // 노드들을 구분합니다
  const groupNodes = nodes.filter(n => n.type === 'group' && n.id !== node.id);
  const nonGroupNodes = nodes.filter(n => n.type !== 'group' && n.id !== node.id);
  
  // 절대 좌표를 상대 좌표로 변환
  const relativePosition = absoluteToRelativePosition(node.position, groupNode.position);
  
  // 업데이트된 노드 생성
  const updatedNode = {
    ...node,
    parentId: groupNode.id,
    parentNode: groupNode.id, // 명시적으로 parentNode 속성도 설정
    position: relativePosition
  };
  
  // 그룹이 먼저 오는 순서로 반환 (React Flow 요구사항)
  if (updatedNode.type === 'group') {
    return [...groupNodes, updatedNode, ...nonGroupNodes];
  } else {
    return [...groupNodes, ...nonGroupNodes, updatedNode];
  }
}

/**
 * Removes a node from a group
 * @param node Node to remove from group
 * @param nodes All nodes in the flow
 * @returns Updated nodes array
 */
export function removeNodeFromGroup(
  node: Node<NodeData>, 
  nodes: Node<NodeData>[]
): Node<NodeData>[] {
  // No change if node is not in a group
  if (!node.parentId) {
    return nodes;
  }
  
  // 노드들을 구분합니다
  const groupNodes = nodes.filter(n => n.type === 'group' && n.id !== node.id);
  const nonGroupNodes = nodes.filter(n => n.type !== 'group' && n.id !== node.id);
  
  // 수정: handleNodeDragStop에서 이미 절대 좌표를 계산해서 전달해주므로, 여기서는 재계산하지 않음.
  // node.position이 이미 올바른 절대 좌표라고 가정합니다.
  const absolutePosition = node.position; 
  
  // 업데이트된 노드 생성 (parentId 및 parentNode 제거)
  const updatedNode = {
    ...node,
    parentId: undefined,
    parentNode: null, // 명시적으로 parentNode 속성도 제거
    position: absolutePosition
  };
  
  // 그룹이 먼저 오는 순서로 반환하되, updatedNode의 타입에 따라 위치 결정
  if (updatedNode.type === 'group') {
    // 업데이트된 노드가 그룹이면 다른 그룹들과 함께 앞쪽에 배치
    return [...groupNodes, updatedNode, ...nonGroupNodes];
  } else {
    // 업데이트된 노드가 그룹이 아니면 다른 비그룹 노드들과 함께 뒤쪽에 배치
    return [...groupNodes, ...nonGroupNodes, updatedNode];
  }
}

/**
 * Checks if a node is positioned inside a group
 * @param node Node to check
 * @param groupNode Group node
 * @returns True if node's center is inside the group
 */
export function isNodeInGroup(
  node: Node<NodeData>, 
  groupNode: Node<NodeData>
): boolean {
  // Calculate node center point
  const nodeWidth = node.width || 150;
  const nodeHeight = node.height || 50;
  
  // 절대 좌표 계산 (노드가 이미 그룹에 속한 경우 상대->절대 변환)
  let absolutePosition = { ...node.position };
  if (node.parentId) {
    const parentNode = node.parentId === groupNode.id 
      ? groupNode // 현재 검사 중인 그룹이 부모인 경우
      : { position: { x: 0, y: 0 } }; // 다른 그룹에 속한 경우 (이 함수에서는 의미 없음)
    
    absolutePosition = relativeToAbsolutePosition(node.position, parentNode.position);
  }
  
  const nodeCenterX = absolutePosition.x + nodeWidth / 2;
  const nodeCenterY = absolutePosition.y + nodeHeight / 2;
  
  // Calculate group boundaries
  const groupLeft = groupNode.position.x;
  const groupTop = groupNode.position.y;
  const groupRight = groupLeft + (groupNode.width || 300);
  const groupBottom = groupTop + (groupNode.height || 200);
  
  // Check if node center is inside group boundaries
  return (
    nodeCenterX >= groupLeft &&
    nodeCenterX <= groupRight &&
    nodeCenterY >= groupTop &&
    nodeCenterY <= groupBottom
  );
}

/**
 * Finds a group node that intersects with the dragged node
 * @param draggedNode The node being dragged
 * @param nodes All nodes in the flow
 * @returns ID of the intersecting group node or null
 */
export function getIntersectingGroupId(
  draggedNode: Node<NodeData>,
  nodes: Node<NodeData>[]
): string | null {
  // Filter for group nodes only
  const groupNodes = nodes.filter(node => node.type === 'group');
  
  if (groupNodes.length === 0) {
    return null;
  }
  
  // Calculate node center
  const nodeWidth = draggedNode.width || 150;
  const nodeHeight = draggedNode.height || 50;
  
  // 절대 좌표 계산 (노드가 이미 그룹에 속한 경우 상대->절대 변환)
  let absolutePosition = { ...draggedNode.position };
  if (draggedNode.parentId) {
    const parentNode = nodes.find(n => n.id === draggedNode.parentId);
    if (parentNode) {
      absolutePosition = relativeToAbsolutePosition(draggedNode.position, parentNode.position);
    }
  }
  
  const nodeCenterX = absolutePosition.x + nodeWidth / 2;
  const nodeCenterY = absolutePosition.y + nodeHeight / 2;
  
  // Check each group node for intersection
  for (const groupNode of groupNodes) {
    // Skip if it's the same node
    if (groupNode.id === draggedNode.id) continue;
    
    // Calculate group boundaries
    const groupLeft = groupNode.position.x;
    const groupTop = groupNode.position.y;
    const groupWidth = groupNode.width || 1200; // Default group size 1200x700
    const groupHeight = groupNode.height || 700;
    const groupRight = groupLeft + groupWidth;
    const groupBottom = groupTop + groupHeight;
    
    // Check if node center is inside the group
    const isInside = (
      nodeCenterX >= groupLeft &&
      nodeCenterX <= groupRight &&
      nodeCenterY >= groupTop &&
      nodeCenterY <= groupBottom
    );
    
    if (isInside) {
      return groupNode.id;
    }
  }
  
  return null;
}

/**
 * 모든 노드의 부모-자식 관계를 업데이트합니다
 * 각 노드의 위치를 확인하여 그룹 내에 있는지 판단하고 부모-자식 관계를 설정합니다
 * @param nodes 모든 노드의 배열
 * @returns 업데이트된 노드 배열
 */
export function updateNodeParentRelationships(nodes: Node<NodeData>[]): Node<NodeData>[] {
  // 그룹 노드만 미리 필터링 (잠재적 부모로 사용)
  const groupNodes = nodes.filter(node => node.type === 'group');

  if (groupNodes.length === 0) {
    // 그룹 노드가 없으면 변경 없음
    return nodes;
  }

  // 모든 노드를 순회하며 부모 업데이트
  const updatedNodesWithParents = nodes.map(node => {
    // 현재 부모 ID 저장
    const currentParentId = node.parentId;
    let absolutePosition = { ...node.position };

    // 현재 부모가 있으면 절대 좌표 계산 (기존 로직과 유사하게)
    if (currentParentId) {
      // nodes 배열에서 현재 부모를 찾아야 함
      const parentNode = nodes.find(n => n.id === currentParentId);
      if (parentNode) {
        absolutePosition = relativeToAbsolutePosition(node.position, parentNode.position);
      }
    }

    // 노드 중심점 계산 (기존 로직)
    const nodeWidth = node.width || 150;
    const nodeHeight = node.height || 50;
    const nodeCenterX = absolutePosition.x + nodeWidth / 2;
    const nodeCenterY = absolutePosition.y + nodeHeight / 2;

    // 노드가 속하게 될 새로운 부모 그룹 찾기
    let newParentId: string | undefined = undefined;
    let intersectingGroupNode = null;

    // 모든 '그룹' 노드를 잠재적 부모로 검사
    for (const groupNode of groupNodes) {
      // 자기 자신을 부모로 삼을 수 없음
      if (node.id === groupNode.id) continue;

      // 그룹 경계 계산 (기존 로직)
      const groupLeft = groupNode.position.x;
      const groupTop = groupNode.position.y;
      const groupWidth = groupNode.width || 1200; // 그룹 크기 기본값 조정 가능
      const groupHeight = groupNode.height || 700;
      const groupRight = groupLeft + groupWidth;
      const groupBottom = groupTop + groupHeight;

      // 노드 중심점이 다른 그룹 내부에 있는지 확인
      const isInside = (
        nodeCenterX >= groupLeft &&
        nodeCenterX <= groupRight &&
        nodeCenterY >= groupTop &&
        nodeCenterY <= groupBottom
      );

      if (isInside) {
        newParentId = groupNode.id;
        intersectingGroupNode = groupNode;
        break; // 가장 안쪽 그룹 하나만 찾으면 됨 (겹쳐있는 경우)
      }
    }

    // 부모 ID가 변경되었는지 확인하고 노드 업데이트
    if (currentParentId !== newParentId) {
      if (newParentId && intersectingGroupNode) {
        // 그룹에 추가됨: 절대 좌표 -> 상대 좌표 변환
        const relativePosition = absoluteToRelativePosition(absolutePosition, intersectingGroupNode.position);
        console.log(`[updateNodeParentRelationships] Node ${node.id} added to group ${newParentId}`);
        return { 
          ...node, 
          parentId: newParentId, 
          position: relativePosition, 
          // parentNode는 prepareNodesForReactFlow에서 설정하므로 여기서 제거 가능 
        };
      } else if (currentParentId) {
         // 그룹에서 제거됨: 절대 좌표 사용 (이미 계산됨)
         console.log(`[updateNodeParentRelationships] Node ${node.id} removed from group ${currentParentId}`);
         return { 
           ...node, 
           parentId: undefined, 
           parentNode: null, // 명시적으로 제거 
           position: absolutePosition 
         };
      }
    }

    // 부모 변경 없음, 기존 노드 반환
    // 단, 절대 좌표가 계산되었다면 위치 업데이트는 필요할 수 있음 (부모는 그대로지만 부모 위치가 바뀐 경우 등)
    // 하지만 이 함수는 parentId 변경에 초점을 맞추므로 여기서는 기존 노드 반환
    return node;
  });

  // 최종적으로 React Flow 요구사항에 맞게 그룹 노드를 앞으로 정렬
  const finalGroupNodes = updatedNodesWithParents.filter(node => node.type === 'group');
  const finalNonGroupNodes = updatedNodesWithParents.filter(node => node.type !== 'group');

  // 정렬된 배열 반환
  return [...finalGroupNodes, ...finalNonGroupNodes];
}

/**
 * Sorts nodes for rendering, ensuring group nodes come before other nodes.
 * This helps React Flow render groups correctly so children appear inside them.
 */
export const sortNodesForRendering = (nodes: Node[]): Node[] => {
  return [...nodes].sort((a, b) => {
    const isAGroup = a.type === 'group';
    const isBGroup = b.type === 'group';
    if (isAGroup && !isBGroup) return -1; // a (group) comes before b (non-group)
    if (!isAGroup && isBGroup) return 1;  // b (group) comes before a (non-group)
    return 0; // Keep original order for nodes of the same type (group/non-group)
  });
}; 