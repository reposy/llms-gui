import { create } from 'zustand';
import { Node, Edge } from '@xyflow/react';
import { FlowData } from '../utils/data/importExportUtils';
import { NodeFactory } from '../core/NodeFactory';
import { Node as BaseNode } from '../core/Node';
import { GroupNode } from '../core/GroupNode';

// 그래프 노드 정보 인터페이스
interface GraphNode {
  id: string;
  type: string;
  parentNodeId: string | null;
  children: string[];
  nodeInstance?: BaseNode;
  isGroupNode: boolean;
}

// 플로우 그래프 인터페이스
interface FlowGraph {
  nodes: Record<string, GraphNode>;
  nodeInstances: Record<string, BaseNode>;
  rootNodeIds: string[];
  leafNodeIds: string[];
  lastResult?: any;
}

// 스토어 상태 인터페이스
interface ExecutorGraphState {
  // Flow ID별 그래프 정보 저장
  flowGraphs: Record<string, FlowGraph>;
  nodeFactory: NodeFactory;
  
  // 그래프 설정 함수
  setFlowGraph: (flowId: string, flowData: FlowData) => void;
  
  // 그래프 데이터 접근 함수
  getFlowGraph: (flowId: string) => FlowGraph | null;
  getRootNodeIds: (flowId: string) => string[];
  getLeafNodeIds: (flowId: string) => string[];
  getNodeInstance: (flowId: string, nodeId: string) => BaseNode | null;
  
  // 결과 관리
  setFlowResult: (flowId: string, result: any) => void;
  getFlowResult: (flowId: string) => any;
  
  // 그래프 초기화
  resetFlowGraphs: () => void;
}

// 개선된 노드 분석 함수 - 객체 체이닝 방식 고려
const buildGraph = (flowId: string, nodes: Node[], edges: Edge[], nodeFactory: NodeFactory): FlowGraph => {
  // 1. 그래프 구조 초기화
  const graph: FlowGraph = {
    nodes: {},
    nodeInstances: {},
    rootNodeIds: [],
    leafNodeIds: []
  };
  
  // 2. 모든 노드 등록 (기본 정보)
  nodes.forEach(node => {
    graph.nodes[node.id] = {
      id: node.id,
      type: node.type || '',
      parentNodeId: node.parentNode || null,
      children: [],
      isGroupNode: node.type === 'group'
    };
  });
  
  // 3. 그룹 노드 및 내부 노드 관계 설정
  const nodesInGroups = new Set<string>();
  nodes.forEach(node => {
    if (node.type === 'group' && node.data?.nodeIds) {
      const groupNode = graph.nodes[node.id];
      node.data.nodeIds.forEach((childId: string) => {
        if (graph.nodes[childId]) {
          groupNode.children.push(childId);
          nodesInGroups.add(childId);
        }
      });
    }
  });
  
  // 4. 엣지 기반 부모-자식 관계 설정
  edges.forEach(edge => {
    if (edge.source && edge.target && graph.nodes[edge.source]) {
      graph.nodes[edge.source].children.push(edge.target);
    }
  });
  
  // 5. 루트 노드 식별 (진입 엣지가 없는 최상위 노드)
  const hasIncomingEdge = new Set<string>();
  edges.forEach(edge => {
    if (edge.target) {
      hasIncomingEdge.add(edge.target);
    }
  });
  
  // 6. 노드 인스턴스 생성 및 루트/리프 노드 식별
  Object.keys(graph.nodes).forEach(nodeId => {
    const nodeData = graph.nodes[nodeId];
    
    // 그룹에 속하지 않은 노드만 루트/리프 노드 후보로 고려
    if (!nodesInGroups.has(nodeId)) {
      // 루트 노드: 들어오는 엣지가 없고 부모 노드가 없는 노드
      if (!hasIncomingEdge.has(nodeId) && !nodeData.parentNodeId) {
        graph.rootNodeIds.push(nodeId);
      }
      
      // 리프 노드: 자식이 없는 노드
      if (nodeData.children.length === 0) {
        graph.leafNodeIds.push(nodeId);
      }
    }
    
    // 노드 인스턴스 생성 (실제 실행 시 사용)
    try {
      const nodeInstance = nodeFactory.create(
        nodeId,
        nodeData.type,
        nodes.find(n => n.id === nodeId)?.data || {},
        null // 컨텍스트는 실행 시점에 주입
      );
      
      graph.nodeInstances[nodeId] = nodeInstance;
      nodeData.nodeInstance = nodeInstance;
    } catch (error) {
      console.error(`[useExecutorGraphStore] Failed to create node instance for ${nodeId}:`, error);
    }
  });
  
  console.log(`[useExecutorGraphStore] Built graph for flow ${flowId}:`, {
    nodeCount: Object.keys(graph.nodes).length,
    rootNodes: graph.rootNodeIds,
    leafNodes: graph.leafNodeIds
  });
  
  return graph;
};

export const useExecutorGraphStore = create<ExecutorGraphState>((set, get) => ({
  flowGraphs: {},
  nodeFactory: new NodeFactory(),
  
  // Flow 그래프 설정
  setFlowGraph: (flowId, flowData) => {
    set(state => {
      // 노드/엣지 확인 및 기본값 설정
      const nodes = flowData.nodes || [];
      const edges = flowData.edges || [];
      
      // 그래프 구축
      const graph = buildGraph(flowId, nodes, edges, state.nodeFactory);
      
      // 상태 업데이트
      return {
        flowGraphs: {
          ...state.flowGraphs,
          [flowId]: graph
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
  
  getNodeInstance: (flowId, nodeId) => {
    return get().flowGraphs[flowId]?.nodeInstances[nodeId] || null;
  },
  
  // 결과 관리
  setFlowResult: (flowId, result) => {
    set(state => {
      const flowGraph = state.flowGraphs[flowId];
      if (!flowGraph) return state;
      
      return {
        flowGraphs: {
          ...state.flowGraphs,
          [flowId]: {
            ...flowGraph,
            lastResult: result
          }
        }
      };
    });
  },
  
  getFlowResult: (flowId) => {
    return get().flowGraphs[flowId]?.lastResult;
  },
  
  // 그래프 초기화
  resetFlowGraphs: () => {
    set({ flowGraphs: {} });
  }
})); 