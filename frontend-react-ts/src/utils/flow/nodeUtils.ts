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
  // Check if the node is already in another group
  const wasInGroup = !!node.parentId;
  let oldParentPos = { x: 0, y: 0 };
  
  if (wasInGroup) {
    // Find previous parent group
    const oldParent = nodes.find(n => n.id === node.parentId);
    if (oldParent) {
      oldParentPos = oldParent.position;
    }
  }
  
  // Calculate new position (convert from absolute to relative position)
  const absoluteX = wasInGroup 
    ? oldParentPos.x + node.position.x  // Convert relative position to absolute
    : node.position.x;                  // Already absolute
  
  const absoluteY = wasInGroup 
    ? oldParentPos.y + node.position.y
    : node.position.y;
  
  // Calculate position relative to the group
  const relativeX = absoluteX - groupNode.position.x;
  const relativeY = absoluteY - groupNode.position.y;
  
  // Create updated nodes array
  return nodes.map(n => {
    if (n.id === node.id) {
      return {
        ...n,
        parentId: groupNode.id,     // Set group ID using parentId property
        position: {                 // Set relative position
          x: relativeX,
          y: relativeY
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
  
  // Find parent group
  const parentGroup = nodes.find(n => n.id === node.parentId);
  
  if (!parentGroup) {
    // If parent not found, just remove the parent reference
    return nodes.map(n => {
      if (n.id === node.id) {
        return {
          ...n,
          parentId: undefined
        };
      }
      return n;
    });
  }
  
  // Calculate absolute position (convert from relative to absolute)
  const absoluteX = parentGroup.position.x + node.position.x;
  const absoluteY = parentGroup.position.y + node.position.y;
  
  // Create updated nodes array
  return nodes.map(n => {
    if (n.id === node.id) {
      return {
        ...n,
        parentId: undefined,  // Remove group reference
        position: {           // Convert to absolute position
          x: absoluteX,
          y: absoluteY
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