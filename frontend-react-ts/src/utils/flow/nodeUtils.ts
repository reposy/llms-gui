import { Node, Edge } from '@xyflow/react';
import { NodeData } from '../../types/nodes';
import { v4 as uuidv4 } from 'uuid';

/**
 * 노드를 그룹에 추가하는 함수
 * @param node 그룹에 추가할 노드
 * @param groupNode 그룹 노드
 * @param nodes 전체 노드 목록
 * @returns 업데이트된 노드 목록
 */
export function addNodeToGroup(
  node: Node<NodeData>, 
  groupNode: Node<NodeData>, 
  nodes: Node<NodeData>[]
): Node<NodeData>[] {
  // console.log(`[nodeUtils] Adding node ${node.id} to group ${groupNode.id}`);
  
  // 노드가 이미 다른 그룹에 속해 있는지 확인
  const wasInGroup = !!node.parentId;
  let oldParentPos = { x: 0, y: 0 };
  
  if (wasInGroup) {
    // 이전 그룹 찾기
    const oldParent = nodes.find(n => n.id === node.parentId);
    if (oldParent) {
      oldParentPos = oldParent.position;
      // console.log(`[nodeUtils] Node was in group ${node.parentId}, will adjust position`);
    }
  }
  
  // 새 위치 계산 (절대 좌표에서 그룹 기준 상대 좌표로 변환)
  const absoluteX = wasInGroup 
    ? oldParentPos.x + node.position.x  // 이전 그룹 내 상대위치를 절대위치로
    : node.position.x;                  // 이미 절대위치
  
  const absoluteY = wasInGroup 
    ? oldParentPos.y + node.position.y
    : node.position.y;
  
  // 그룹 기준 상대 좌표 계산
  const relativeX = absoluteX - groupNode.position.x;
  const relativeY = absoluteY - groupNode.position.y;
  
  // console.log(`[nodeUtils] Position conversion:`, {...});
  
  // 업데이트된 노드 목록 생성
  return nodes.map(n => {
    if (n.id === node.id) {
      return {
        ...n,
        parentId: groupNode.id,     // 그룹 ID 설정
        position: {                 // 상대 위치 설정
          x: relativeX,
          y: relativeY
        },
        // 기존 데이터 유지
        data: n.data
      };
    }
    return n;
  });
}

/**
 * 노드를 그룹에서 제거하는 함수
 * @param node 그룹에서 제거할 노드
 * @param nodes 전체 노드 목록
 * @returns 업데이트된 노드 목록
 */
export function removeNodeFromGroup(
  node: Node<NodeData>, 
  nodes: Node<NodeData>[]
): Node<NodeData>[] {
  // 노드가 그룹에 속해 있지 않으면 변경 없음
  if (!node.parentId) {
    // console.log(`[nodeUtils] Node ${node.id} is not in any group, no changes needed`);
    return nodes;
  }
  
  // console.log(`[nodeUtils] Removing node ${node.id} from group ${node.parentId}`);
  
  // 부모 그룹 찾기
  const parentGroup = nodes.find(n => n.id === node.parentId);
  
  if (!parentGroup) {
    // console.log(`[nodeUtils] Parent group ${node.parentId} not found, just removing parentId`);
    // 부모를 찾을 수 없으면 parentId만 제거
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
  
  // 절대 위치 계산 (그룹 기준 상대 좌표에서 절대 좌표로 변환)
  const absoluteX = parentGroup.position.x + node.position.x;
  const absoluteY = parentGroup.position.y + node.position.y;
  
  // console.log(`[nodeUtils] Converting to absolute position:`, {...});
  
  // 업데이트된 노드 목록 생성
  return nodes.map(n => {
    if (n.id === node.id) {
      return {
        ...n,
        parentId: undefined,  // 그룹 제거
        position: {           // 절대 위치로 변환
          x: absoluteX,
          y: absoluteY
        }
      };
    }
    return n;
  });
}

/**
 * 노드 위치가 그룹 내부에 있는지 확인
 * @param node 확인할 노드
 * @param groupNode 그룹 노드
 * @returns 노드 중심이 그룹 내부에 있으면 true, 아니면 false
 */
export function isNodeInGroup(
  node: Node<NodeData>, 
  groupNode: Node<NodeData>
): boolean {
  // 노드 중심점 계산
  const nodeWidth = node.width || 150;
  const nodeHeight = node.height || 50;
  const nodeCenterX = node.position.x + nodeWidth / 2;
  const nodeCenterY = node.position.y + nodeHeight / 2;
  
  // 그룹 경계 계산
  const groupLeft = groupNode.position.x;
  const groupTop = groupNode.position.y;
  const groupRight = groupLeft + (groupNode.width || 300);
  const groupBottom = groupTop + (groupNode.height || 200);
  
  // 노드 중심이 그룹 내에 있는지 확인
  return (
    nodeCenterX >= groupLeft &&
    nodeCenterX <= groupRight &&
    nodeCenterY >= groupTop &&
    nodeCenterY <= groupBottom
  );
} 