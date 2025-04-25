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
    // Create a base node
    const processedNode = { ...node } as Node<NodeData>;
    
    // parentId가 있으면 React Flow용 parentNode 속성도 설정
    if (node.parentId) {
      // React Flow 내부 처리를 위해 parentNode 속성도 설정
      (processedNode as any).parentNode = node.parentId;
    } else {
      // parentId가 없으면 parentNode도 명시적으로 undefined로 설정
      // (React Flow에서는 parentNode가 undefined일 때 부모 관계가 없다고 간주함)
      processedNode.parentId = undefined;
      (processedNode as any).parentNode = undefined;
    }
    
    return processedNode;
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
 * Add a node to a group and update parent-child relationships
 * This includes converting position from absolute to relative
 */
export function addNodeToGroup(
  node: Node<NodeData>, 
  groupNode: Node<NodeData>, 
  nodes: Node<NodeData>[]
): Node<NodeData>[] {
  // Skip if node is already in this group
  if (node.parentId === groupNode.id) {
    return nodes;
  }

  // Calculate relative position
  const relativePosition = absoluteToRelativePosition(node.position, groupNode.position);
  
  console.log(`[addNodeToGroup] Adding node ${node.id} to group ${groupNode.id}:`, {
    nodeId: node.id,
    parentId: groupNode.id,
    absolutePos: node.position,
    relativePos: relativePosition
  });

  // Update the nodes array with the modified node
  return nodes.map(n => {
    if (n.id === node.id) {
      // Create a base updated node
      const updatedNode = {
        ...n,
        position: relativePosition,
        parentId: groupNode.id,
        // Keep existing extent if present, otherwise don't add it
        ...(n.extent ? { extent: n.extent } : {})
      } as Node<NodeData>;
      
      // Add parentNode via type assertion to avoid TypeScript error
      (updatedNode as any).parentNode = groupNode.id;
      
      return updatedNode;
    }
    return n;
  });
}

/**
 * Remove a node from its parent group and update parent-child relationships
 * This includes converting position from relative to absolute
 */
export function removeNodeFromGroup(
  node: Node<NodeData>, 
  nodes: Node<NodeData>[]
): Node<NodeData>[] {
  // Skip if node has no parent
  if (!node.parentId) {
    return nodes;
  }

  console.log(`[removeNodeFromGroup] Removing node ${node.id} from group ${node.parentId}:`, {
    nodeId: node.id,
    previousParentId: node.parentId,
    position: node.position
  });

  // Node already has absolute position passed in
  return nodes.map(n => {
    if (n.id === node.id) {
      // Create new node without parent references and with absolute position
      // Use a type assertion to access parentNode, since TS doesn't know about it
      const { parentId, ...nodeWithoutParent } = n;
      // Use a type assertion to tell TypeScript this is valid
      const updatedNode = {
        ...nodeWithoutParent,
        position: node.position,
        // Explicitly set to undefined to ensure React Flow treats it as a root node
        parentId: undefined,
      } as Node<NodeData>;
      
      // Add parentNode: undefined via type assertion to avoid TypeScript error
      (updatedNode as any).parentNode = undefined;
      
      return updatedNode;
    }
    return n;
  });
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
 * Returns the ID of the smallest intersecting group or null if none found
 */
export function getIntersectingGroupId(
  draggedNode: Node<NodeData>,
  nodes: Node<NodeData>[]
): string | null {
  // Skip self-check for groups (groups can't be their own parent)
  if (draggedNode.type === 'group') {
    console.log(`[getIntersectingGroupId] Skipping intersection check for group node ${draggedNode.id}`);
    return null;
  }

  // Filter for potential parent group nodes
  const groupNodes = nodes.filter(node => 
    node.type === 'group' && node.id !== draggedNode.id
  );
  
  if (groupNodes.length === 0) {
    return null;
  }
  
  // Calculate node center in absolute coordinates
  const nodeCenter = getNodeCenterAbsolute(draggedNode, nodes);
  
  // Find all intersecting groups
  const intersectingGroups = groupNodes.filter(groupNode => 
    isPointInsideGroup(nodeCenter, groupNode)
  );

  if (intersectingGroups.length === 0) {
    return null;
  }
  
  // If multiple groups intersect, pick the smallest one by area
  if (intersectingGroups.length > 1) {
    const smallestGroup = findSmallestGroupByArea(intersectingGroups);
    console.log(`[getIntersectingGroupId] Multiple intersections found for node ${draggedNode.id}. Selected smallest group: ${smallestGroup.id}`);
    return smallestGroup.id;
  }
  
  return intersectingGroups[0].id;
}

/**
 * Calculate the center point of a node in absolute coordinates
 */
function getNodeCenterAbsolute(
  node: Node<NodeData>, 
  allNodes: Node<NodeData>[]
): { x: number, y: number } {
  const nodeWidth = node.width || 150;
  const nodeHeight = node.height || 50;
  
  // Calculate absolute position if node is in a group
  let absolutePosition = { ...node.position };
  if (node.parentId) {
    const parentNode = allNodes.find(n => n.id === node.parentId);
    if (parentNode) {
      absolutePosition = relativeToAbsolutePosition(node.position, parentNode.position);
    }
  }
  
  return {
    x: absolutePosition.x + nodeWidth / 2,
    y: absolutePosition.y + nodeHeight / 2
  };
}

/**
 * Check if a point is inside a group node's boundaries
 */
function isPointInsideGroup(
  point: { x: number, y: number }, 
  groupNode: Node<NodeData>
): boolean {
  const groupLeft = groupNode.position.x;
  const groupTop = groupNode.position.y;
  const groupWidth = groupNode.width || 1200; // Default group size
  const groupHeight = groupNode.height || 700;
  const groupRight = groupLeft + groupWidth;
  const groupBottom = groupTop + groupHeight;
  
  return (
    point.x >= groupLeft &&
    point.x <= groupRight &&
    point.y >= groupTop &&
    point.y <= groupBottom
  );
}

/**
 * Find the smallest group node by area
 */
function findSmallestGroupByArea(groupNodes: Node<NodeData>[]): Node<NodeData> {
  return groupNodes.reduce((smallest, current) => {
    const smallestArea = (smallest.width || 1200) * (smallest.height || 700);
    const currentArea = (current.width || 1200) * (current.height || 700);
    return currentArea < smallestArea ? current : smallest;
  }, groupNodes[0]);
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
    // 자신이 그룹이면 자신을 부모로 설정할 수 없으므로 스킵
    if (node.type === 'group') {
      return node;
    }
    
    // 현재 부모 ID 저장
    const currentParentId = node.parentId;
    
    // 노드 중심점 계산 (절대 좌표 기준)
    const nodeCenter = getNodeCenterAbsolute(node, nodes);

    // 교차하는 그룹 찾기
    const intersectingGroups = groupNodes.filter(groupNode => 
      isPointInsideGroup(nodeCenter, groupNode)
    );
    
    // 여러 그룹과 교차하는 경우 가장 작은 그룹 선택
    let newParentId: string | undefined = undefined;
    let intersectingGroupNode: Node<NodeData> | null = null;
    
    if (intersectingGroups.length > 0) {
      if (intersectingGroups.length > 1) {
        intersectingGroupNode = findSmallestGroupByArea(intersectingGroups);
      } else {
        intersectingGroupNode = intersectingGroups[0];
      }
      newParentId = intersectingGroupNode.id;
    }

    // 부모 ID가 변경되었는지 확인하고 노드 업데이트
    if (currentParentId !== newParentId) {
      if (newParentId && intersectingGroupNode) {
        // 그룹에 추가: 절대 좌표 -> 상대 좌표 변환
        // 이미 존재하는 addNodeToGroup 함수 활용
        console.log(`[updateNodeParentRelationships] Node ${node.id} added to group ${newParentId}`);
        const absolutePosition = getNodeCenterAbsolute(node, nodes);
        const nodeWithAbsPos = { ...node, position: absolutePosition };
        return addNodeToGroup(nodeWithAbsPos, intersectingGroupNode, [node])[0];
      } else if (currentParentId) {
        // 그룹에서 제거: 절대 좌표 사용
        // 이미 존재하는 removeNodeFromGroup 함수 활용
        console.log(`[updateNodeParentRelationships] Node ${node.id} removed from group ${currentParentId}`);
        return removeNodeFromGroup(node, [node])[0];
      }
    }

    // 부모 변경 없음, 기존 노드 반환
    return node;
  });

  // 노드 렌더링을 위한 정렬
  return sortNodesForRendering(updatedNodesWithParents as Node[]) as Node<NodeData>[];
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