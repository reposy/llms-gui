import { Node, Edge } from '@xyflow/react';
import { NodeData } from '../../types/nodes';
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
  const groupNodes = nodes.filter(n => n.type === 'group');
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
  return [...groupNodes, ...nonGroupNodes, updatedNode];
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
  const groupNodes = nodes.filter(n => n.type === 'group');
  const nonGroupNodes = nodes.filter(n => n.type !== 'group' && n.id !== node.id);
  
  // 현재 부모 노드를 찾습니다
  const parentNode = nodes.find(n => n.id === node.parentId);
  
  // 상대 좌표를 절대 좌표로 변환 (부모가 있는 경우)
  const absolutePosition = parentNode 
    ? relativeToAbsolutePosition(node.position, parentNode.position)
    : node.position;
  
  // 업데이트된 노드 생성
  const updatedNode = {
    ...node,
    parentId: undefined,
    parentNode: null, // 명시적으로 parentNode 속성도 제거
    position: absolutePosition
  };
  
  // 그룹이 먼저 오는 순서로 반환
  return [...groupNodes, ...nonGroupNodes, updatedNode];
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
  // 그룹 노드만 필터링
  const groupNodes = nodes.filter(node => node.type === 'group');
  
  if (groupNodes.length === 0) {
    // 그룹 노드가 없으면 변경 없음
    return nodes;
  }
  
  // 먼저 그룹 노드들을 모아둡니다 (React Flow에서는 부모가 자식보다 먼저 와야 함)
  let updatedNodes = [...groupNodes];
  
  // 비그룹 노드만 필터링하여 처리
  const nonGroupNodes = nodes.filter(node => node.type !== 'group');
  
  // 모든 비그룹 노드를 순회하며 부모-자식 관계 업데이트
  const processedNonGroupNodes = nonGroupNodes.map(node => {
    // 현재 부모 ID 저장
    const currentParentId = node.parentId;
    
    // 노드 중심점 계산을 위한 노드 위치 (절대 좌표)
    let absolutePosition = { ...node.position };
    if (currentParentId) {
      // 현재 부모가 있으면 절대 좌표 계산
      const parentNode = nodes.find(n => n.id === currentParentId);
      if (parentNode) {
        absolutePosition = relativeToAbsolutePosition(node.position, parentNode.position);
      }
    }
    
    // 노드 중심점 계산
    const nodeWidth = node.width || 150;
    const nodeHeight = node.height || 50;
    const nodeCenterX = absolutePosition.x + nodeWidth / 2;
    const nodeCenterY = absolutePosition.y + nodeHeight / 2;
    
    // 노드가 속한 그룹 찾기
    let newParentId: string | undefined = undefined;
    let intersectingGroupNode = null;
    
    for (const groupNode of groupNodes) {
      // 그룹 경계 계산
      const groupLeft = groupNode.position.x;
      const groupTop = groupNode.position.y;
      const groupWidth = groupNode.width || 1200;
      const groupHeight = groupNode.height || 700;
      const groupRight = groupLeft + groupWidth;
      const groupBottom = groupTop + groupHeight;
      
      // 노드 중심점이 그룹 내부에 있는지 확인
      const isInside = (
        nodeCenterX >= groupLeft &&
        nodeCenterX <= groupRight &&
        nodeCenterY >= groupTop &&
        nodeCenterY <= groupBottom
      );
      
      if (isInside) {
        newParentId = groupNode.id;
        intersectingGroupNode = groupNode;
        break;
      }
    }
    
    // 부모 ID가 변경된 경우에만 업데이트
    if (currentParentId !== newParentId) {
      if (newParentId && intersectingGroupNode) {
        // 그룹에 추가될 때: 절대 좌표 -> 상대 좌표 변환
        const relativePosition = absoluteToRelativePosition(absolutePosition, intersectingGroupNode.position);
        
        return {
          ...node,
          parentId: newParentId,
          position: relativePosition
        };
      } else if (currentParentId) {
        // 그룹에서 제거될 때: 이미 절대 좌표로 변환했으므로 그대로 사용
        return {
          ...node,
          parentId: undefined,
          parentNode: null, // 명시적으로 parentNode 속성도 제거
          position: absolutePosition
        };
      }
    }
    
    // 변경 없음
    return node;
  });
  
  // 업데이트된 노드 배열에 비그룹 노드 추가 (순서 중요: 그룹 노드가 먼저 와야 함)
  updatedNodes = [...updatedNodes, ...processedNonGroupNodes];
  
  return updatedNodes;
} 