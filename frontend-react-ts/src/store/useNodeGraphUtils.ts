import { Edge, Node } from 'reactflow';
import { createWithEqualityFn } from 'zustand/traditional';
import { devtools } from 'zustand/middleware';
import { NodeData } from '../types/nodes';
import { useFlowStructureStore } from './useFlowStructureStore';

/**
 * 노드 관계 처리를 위한 유틸리티 함수들
 */

/**
 * 특정 노드가 그래프의 루트 노드인지 확인
 * @param nodeId 확인할 노드 ID
 * @param nodes 그래프의 모든 노드 목록
 * @param edges 그래프의 모든 엣지 목록
 * @returns 루트 노드 여부
 */
export const isNodeRootUtil = (nodeId: string, nodes: any[], edges: any[]): boolean => {
  // 노드로 들어오는 엣지가 없으면 루트 노드로 간주
  return !edges.some(edge => edge.target === nodeId);
};

/**
 * 노드의 인풋 노드들 조회
 * @param nodeId 대상 노드 ID
 * @param edges 그래프의 모든 엣지 목록
 * @returns 인풋 노드 ID 배열
 */
export const getInputNodes = (nodeId: string, edges: any[]): string[] => {
  // 현재 노드를 타겟으로 하는 모든 엣지의 소스 노드 ID 반환
  return edges
    .filter(edge => edge.target === nodeId)
    .map(edge => edge.source);
};

/**
 * 노드의 아웃풋 노드들 조회
 * @param nodeId 대상 노드 ID
 * @param edges 그래프의 모든 엣지 목록
 * @returns 아웃풋 노드 ID 배열
 */
export const getOutputNodes = (nodeId: string, edges: any[]): string[] => {
  // 현재 노드를 소스로 하는 모든 엣지의 타겟 노드 ID 반환
  return edges
    .filter(edge => edge.source === nodeId)
    .map(edge => edge.target);
};

/**
 * 모든 루트 노드의 ID 가져오기
 * @param nodes 노드 목록
 * @param edges 엣지 목록
 * @returns 루트 노드 ID 배열
 */
export const getRootNodes = (nodes: any[], edges: any[]): string[] => {
  return nodes
    .filter(node => isNodeRootUtil(node.id, nodes, edges))
    .map(node => node.id);
};

/**
 * 한 노드에서 시작하여 다운스트림 노드들 가져오기
 * @param nodeId 시작 노드 ID
 * @param nodes 노드 목록
 * @param edges 엣지 목록
 * @param includeStartNode 시작 노드도 결과에 포함할지 여부
 * @returns 다운스트림 노드 ID 배열
 */
export const getDownstreamNodes = (
  nodeId: string, 
  nodes: any[], 
  edges: any[], 
  includeStartNode = false
): string[] => {
  const downstream = new Set<string>();
  const queue: string[] = [nodeId];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    
    visited.add(current);

    if (current !== nodeId || includeStartNode) {
      downstream.add(current);
    }

    // 현재 노드의 아웃풋 노드들 찾기
    const children = getOutputNodes(current, edges);
    
    children.forEach(childId => {
      if (!visited.has(childId)) {
        queue.push(childId);
      }
    });
  }
  
  return Array.from(downstream);
};

/**
 * 한 노드에서 시작하여 업스트림 노드들 가져오기
 * @param nodeId 시작 노드 ID
 * @param nodes 노드 목록
 * @param edges 엣지 목록
 * @returns 업스트림 노드 ID 배열
 */
export const getUpstreamNodes = (
  nodeId: string,
  nodes: any[],
  edges: any[]
): string[] => {
  const upstream = new Set<string>();
  const queue: string[] = [nodeId];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    
    visited.add(current);

    if (current !== nodeId) {
      upstream.add(current);
    }

    // 현재 노드의 인풋 노드들 찾기
    const parents = getInputNodes(current, edges);
    
    parents.forEach(parentId => {
      if (!visited.has(parentId)) {
        queue.push(parentId);
      }
    });
  }
  
  return Array.from(upstream);
};

/**
 * 특정 그룹에 속한 노드들 가져오기
 * @param groupId 그룹 노드 ID
 * @param nodes 노드 목록
 * @returns 그룹에 속한 노드 배열
 */
export const getNodesInGroup = (groupId: string, nodes: any[]): any[] => {
  return nodes.filter(node => node.parentNode === groupId);
};

/**
 * 노드가 루트 노드인지 직접 확인하는 함수
 * @param nodeId 확인할 노드 ID
 * @returns 루트 노드 여부
 */
export const isNodeRoot = (nodeId: string): boolean => {
  const { nodes, edges } = useFlowStructureStore.getState();
  return isNodeRootUtil(nodeId, nodes, edges);
};

/**
 * 노드가 루트 노드인지 확인하는 React Hook
 * 컴포넌트에서 사용할 때는 이 훅을 사용해야 함
 * @param nodeId 확인할 노드 ID
 * @returns 루트 노드 여부
 */
export const useIsRootNode = (nodeId: string): boolean => {
  return useFlowStructureStore((state) => {
    const { nodes, edges } = state;
    return isNodeRootUtil(nodeId, nodes, edges);
  });
};

/**
 * useNodeGraphUtils
 * 노드 그래프에 관련된 유틸리티 함수들을 제공하는 모듈
 */