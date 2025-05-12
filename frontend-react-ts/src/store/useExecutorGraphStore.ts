import { create } from 'zustand';
import { Node, Edge } from '@xyflow/react';
import { FlowData } from '../utils/data/importExportUtils';

// Flow 노드 정보 분석 함수 (FlowChainManager의 함수와 동일)
const analyzeFlowNodes = (nodes: Node[], edges: Edge[]) => {
  // 노드 연결 정보 초기화
  const nodeConnections: Record<string, { hasInputs: boolean; hasOutputs: boolean }> = {};
  
  // 초기화
  nodes.forEach(node => {
    nodeConnections[node.id] = { hasInputs: false, hasOutputs: false };
  });
  
  // 그룹 노드 및 그 내부 노드 식별
  const groupNodes = nodes.filter(node => node.type === 'group');
  const nodesInGroups = new Set<string>();
  
  // 그룹 내부 노드 식별
  groupNodes.forEach(groupNode => {
    const groupData = groupNode.data;
    if (groupData && groupData.nodeIds) {
      groupData.nodeIds.forEach((nodeId: string) => {
        nodesInGroups.add(nodeId);
      });
    }
  });
  
  // 엣지 분석 - 방향성 고려
  edges.forEach(edge => {
    if (edge.source && edge.target) {
      // 소스 노드는 출력(우측 핸들)이 있음
      if (nodeConnections[edge.source]) {
        nodeConnections[edge.source].hasOutputs = true;
      }
      
      // 타겟 노드는 입력(좌측 핸들)이 있음
      if (nodeConnections[edge.target]) {
        nodeConnections[edge.target].hasInputs = true;
      }
    }
  });
  
  // 루트 및 리프 노드 식별
  // 루트 노드: 입력 연결이 없는 노드 (그룹에 속하지 않음)
  const rootNodes = nodes.filter(node => 
    !nodesInGroups.has(node.id) &&
    node.id in nodeConnections &&
    !nodeConnections[node.id].hasInputs
  );
  
  // 리프 노드: 출력 연결이 없는 노드 (그룹에 속하지 않음)
  const leafNodes = nodes.filter(node => 
    !nodesInGroups.has(node.id) &&
    node.id in nodeConnections &&
    !nodeConnections[node.id].hasOutputs
  );
  
  return {
    rootNodeIds: rootNodes.map(n => n.id),
    leafNodeIds: leafNodes.map(n => n.id)
  };
};

// Flow 그래프 정보 인터페이스
interface FlowGraphInfo {
  nodes: Node[];
  edges: Edge[];
  rootNodeIds: string[];
  leafNodeIds: string[];
}

// 스토어 상태 인터페이스
interface ExecutorGraphState {
  // Flow ID별 그래프 정보 저장
  flowGraphs: Record<string, FlowGraphInfo>;
  
  // 그래프 설정 함수
  setFlowGraph: (flowId: string, flowData: FlowData) => void;
  
  // 그래프 데이터 접근 함수
  getFlowGraph: (flowId: string) => FlowGraphInfo | null;
  getRootNodeIds: (flowId: string) => string[];
  getLeafNodeIds: (flowId: string) => string[];
  
  // 그래프 초기화
  resetFlowGraphs: () => void;
}

export const useExecutorGraphStore = create<ExecutorGraphState>((set, get) => ({
  flowGraphs: {},
  
  // Flow 그래프 설정
  setFlowGraph: (flowId, flowData) => {
    set(state => {
      // 노드/엣지 확인 및 기본값 설정
      const nodes = flowData.nodes || [];
      const edges = flowData.edges || [];
      
      // 루트/리프 노드 분석
      const { rootNodeIds, leafNodeIds } = analyzeFlowNodes(nodes, edges);
      
      // 새 그래프 정보 객체 생성
      const newFlowGraphInfo: FlowGraphInfo = {
        nodes,
        edges,
        rootNodeIds,
        leafNodeIds
      };
      
      // 상태 업데이트
      return {
        flowGraphs: {
          ...state.flowGraphs,
          [flowId]: newFlowGraphInfo
        }
      };
    });
  },
  
  // 그래프 데이터 접근 함수
  getFlowGraph: (flowId) => {
    return get().flowGraphs[flowId] || null;
  },
  
  getRootNodeIds: (flowId) => {
    return get().flowGraphs[flowId]?.rootNodeIds || [];
  },
  
  getLeafNodeIds: (flowId) => {
    return get().flowGraphs[flowId]?.leafNodeIds || [];
  },
  
  // 그래프 초기화
  resetFlowGraphs: () => {
    set({ flowGraphs: {} });
  }
})); 