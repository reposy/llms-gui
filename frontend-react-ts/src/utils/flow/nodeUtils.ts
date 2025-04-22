import { Node, Edge } from '@xyflow/react';
import { NodeData } from '../../types/nodes';
import { v4 as uuidv4 } from 'uuid';

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
  // 절대 좌표 유지 - UI 가이드라인에 따르면 그룹 내 자식 노드는 절대 좌표를 유지해야 함
  // 위치 변환 없이 parentId만 설정
  return nodes.map(n => {
    if (n.id === node.id) {
      return {
        ...n,
        parentId: groupNode.id,     // Set group ID using parentId property
        // 현재 위치 유지 (절대 좌표 유지)
        position: {
          x: n.position.x,
          y: n.position.y
        },
        // Preserve existing data
        data: n.data
      };
    }
    return n;
  });
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
  
  // 절대 좌표 유지 - UI 가이드라인에 따르면 절대 좌표를 유지해야 함
  // Create updated nodes array
  return nodes.map(n => {
    if (n.id === node.id) {
      return {
        ...n,
        parentId: undefined,  // Remove group reference
        // 현재 위치 유지 (절대 좌표)
        position: {
          x: n.position.x,
          y: n.position.y
        }
      };
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
  const nodeCenterX = node.position.x + nodeWidth / 2;
  const nodeCenterY = node.position.y + nodeHeight / 2;
  
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
  
  // Current parent (if any)
  const currentParentId = draggedNode.parentId;
  
  // Calculate node center
  const nodeWidth = draggedNode.width || 150;
  const nodeHeight = draggedNode.height || 50;
  const nodeCenterX = draggedNode.position.x + nodeWidth / 2;
  const nodeCenterY = draggedNode.position.y + nodeHeight / 2;
  
  // Check each group node for intersection
  for (const groupNode of groupNodes) {
    // Skip if it's the same node
    if (groupNode.id === draggedNode.id) continue;
    
    // Calculate group boundaries
    const groupLeft = groupNode.position.x;
    const groupTop = groupNode.position.y;
    const groupRight = groupLeft + (groupNode.width || 1200); // Default group size 1200x700
    const groupBottom = groupTop + (groupNode.height || 700);
    
    // Check if node center is inside the group
    if (
      nodeCenterX >= groupLeft &&
      nodeCenterX <= groupRight &&
      nodeCenterY >= groupTop &&
      nodeCenterY <= groupBottom
    ) {
      return groupNode.id;
    }
  }
  
  return null;
} 