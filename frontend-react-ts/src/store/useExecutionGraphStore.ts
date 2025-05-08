import { createWithEqualityFn } from 'zustand/traditional';
import { shallow } from 'zustand/shallow';
import { Node, Edge } from '@xyflow/react';
import { buildExecutionGraph, GraphNode } from '../utils/flow/flowUtils';
import { useCallback } from 'react';

// 실행 그래프 스토어 인터페이스
interface ExecutionGraphState {
  // 그래프 데이터
  graph: Map<string, GraphNode>;
  
  // 액션 및 셀렉터
  buildGraph: (nodes: Node[], edges: Edge[]) => void;
  getNodeLevel: (nodeId: string) => number;
  getChildNodeIds: (nodeId: string) => string[];
  getParentNodeIds: (nodeId: string) => string[];
  getRootNodeIds: () => string[];
}

// 실행 그래프 관리 스토어
export const useExecutionGraphStore = createWithEqualityFn<ExecutionGraphState>()(
  (set, get) => ({
    // 초기 상태
    graph: new Map<string, GraphNode>(),
    
    // 그래프 구축 또는 재구축
    buildGraph: (nodes: Node[], edges: Edge[]) => {
      const graph = buildExecutionGraph(nodes, edges);
      console.log(`[ExecutionGraphStore] Built graph with ${graph.size} nodes`);
      
      // 그래프 기본 통계 로깅
      const levels = new Map<number, number>();
      let maxLevel = 0;
      
      graph.forEach(node => {
        maxLevel = Math.max(maxLevel, node.level);
        const count = levels.get(node.level) || 0;
        levels.set(node.level, count + 1);
      });
      
      set({ graph });
    },
    
    // 노드의 레벨(깊이) 가져오기
    getNodeLevel: (nodeId: string) => {
      const { graph } = get();
      const node = graph.get(nodeId);
      return node ? node.level : -1;
    },
    
    // 주어진 노드의 자식 노드 ID 가져오기
    getChildNodeIds: (nodeId: string) => {
      const { graph } = get();
      const node = graph.get(nodeId);
      return node ? node.childIds : [];
    },
    
    // 주어진 노드의 부모 노드 ID 가져오기
    getParentNodeIds: (nodeId: string) => {
      const { graph } = get();
      const node = graph.get(nodeId);
      return node ? node.parentIds : [];
    },
    
    // 모든 루트 노드 ID 가져오기 (부모가 없는 노드들)
    getRootNodeIds: () => {
      const { graph } = get();
      const rootNodeIds: string[] = [];
      
      graph.forEach((node, id) => {
        if (node.parentIds.length === 0) {
          rootNodeIds.push(id);
        }
      });
      
      return rootNodeIds;
    }
  }),
  shallow
);

// 직접 스토어 상태와 액션에 접근하기 위한 헬퍼 함수들
export const buildExecutionGraphFromFlow = (nodes: Node[], edges: Edge[]) => 
  useExecutionGraphStore.getState().buildGraph(nodes, edges);

export const getExecutionGraph = () => 
  useExecutionGraphStore.getState().graph;

export const getNodeLevel = (nodeId: string) => 
  useExecutionGraphStore.getState().getNodeLevel(nodeId);

export const getChildNodeIds = (nodeId: string) => 
  useExecutionGraphStore.getState().getChildNodeIds(nodeId);

export const getParentNodeIds = (nodeId: string) => 
  useExecutionGraphStore.getState().getParentNodeIds(nodeId);

export const getRootNodeIds = () => 
  useExecutionGraphStore.getState().getRootNodeIds();

// 컴포넌트에서 사용하기 위한 커스텀 훅
export const useNodeLevel = (nodeId: string) => {
  return useExecutionGraphStore(
    useCallback(
      (state) => state.getNodeLevel(nodeId),
      [nodeId]
    )
  );
};

export const useChildNodeIds = (nodeId: string) => {
  return useExecutionGraphStore(
    useCallback(
      (state) => state.getChildNodeIds(nodeId),
      [nodeId]
    )
  );
};

export const useParentNodeIds = (nodeId: string) => {
  return useExecutionGraphStore(
    useCallback(
      (state) => state.getParentNodeIds(nodeId),
      [nodeId]
    )
  );
};

export const useRootNodeIds = () => {
  return useExecutionGraphStore(
    useCallback(
      (state) => state.getRootNodeIds(),
      []
    )
  );
};