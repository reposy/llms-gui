import { create } from 'zustand';
import {
  Connection,
  NodeChange,
  EdgeChange,
  Node,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  Edge,
} from 'reactflow';
import { NodeData, NodeExecutionState, FlowExecutionState } from '../types/nodes';

interface FlowStore {
  // 노드와 엣지 상태
  nodes: Node<NodeData>[];
  edges: Edge[];
  
  // 실행 상태
  flowExecution: FlowExecutionState;
  
  // 액션
  addNode: (node: Node<NodeData>) => void;
  updateNode: (nodeId: string, data: Partial<NodeData>) => void;
  removeNode: (nodeId: string) => void;
  
  addEdge: (edge: Edge) => void;
  removeEdge: (edgeId: string) => void;
  
  // 노드 실행 관련
  executeNode: (nodeId: string) => Promise<void>;
  updateNodeState: (nodeId: string, state: Partial<NodeExecutionState>) => void;
  
  // 플로우 실행 관련
  executeFlow: (startNodeId: string) => Promise<void>;
  resetFlow: () => void;
}

export const useFlowStore = create<FlowStore>((set, get) => ({
  nodes: [],
  edges: [],
  flowExecution: {
    isExecuting: false,
    executionOrder: [],
    nodeStates: {},
  },

  addNode: (node) => set((state) => ({ 
    nodes: [...state.nodes, node] 
  })),

  updateNode: (nodeId, data) => set((state) => ({
    nodes: state.nodes.map(node =>
      node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node
    )
  })),

  removeNode: (nodeId) => set((state) => ({
    nodes: state.nodes.filter(node => node.id !== nodeId),
    edges: state.edges.filter(edge => 
      edge.source !== nodeId && edge.target !== nodeId
    )
  })),

  addEdge: (edge) => set((state) => ({
    edges: [...state.edges, edge]
  })),

  removeEdge: (edgeId) => set((state) => ({
    edges: state.edges.filter(edge => edge.id !== edgeId)
  })),

  executeNode: async (nodeId) => {
    const { nodes, edges, updateNodeState } = get();
    const node = nodes.find(n => n.id === nodeId);
    
    if (!node) return;

    // 노드 실행 상태 업데이트
    updateNodeState(nodeId, {
      status: 'running',
      timestamp: Date.now()
    });

    try {
      let result;
      
      // 입력 노드들의 결과 수집
      const inputEdges = edges.filter(e => e.target === nodeId);
      const inputs = inputEdges.map(edge => {
        const sourceNode = nodes.find(n => n.id === edge.source);
        return sourceNode?.data.result;
      });

      // 노드 타입별 실행 로직
      switch (node.data.type) {
        case 'llm':
          result = await executeLLMNode(node.data, inputs);
          break;
        case 'api':
          result = await executeAPINode(node.data, inputs);
          break;
        case 'output':
          result = formatOutput(node.data, inputs[0]);
          break;
      }

      // 실행 결과 업데이트
      updateNodeState(nodeId, {
        status: 'completed',
        result,
        timestamp: Date.now()
      });

      // 연결된 다음 노드들 실행
      const outputEdges = edges.filter(e => e.source === nodeId);
      for (const edge of outputEdges) {
        await get().executeNode(edge.target);
      }

    } catch (error) {
      updateNodeState(nodeId, {
        status: 'error',
        error: error.message,
        timestamp: Date.now()
      });
    }
  },

  updateNodeState: (nodeId, state) => set((flowState) => ({
    flowExecution: {
      ...flowState.flowExecution,
      nodeStates: {
        ...flowState.flowExecution.nodeStates,
        [nodeId]: {
          ...flowState.flowExecution.nodeStates[nodeId],
          nodeId,
          ...state
        }
      }
    }
  })),

  executeFlow: async (startNodeId) => {
    const { executeNode } = get();
    
    set((state) => ({
      flowExecution: {
        ...state.flowExecution,
        isExecuting: true,
        currentNodeId: startNodeId,
        executionOrder: []
      }
    }));

    try {
      await executeNode(startNodeId);
    } finally {
      set((state) => ({
        flowExecution: {
          ...state.flowExecution,
          isExecuting: false,
          currentNodeId: undefined
        }
      }));
    }
  },

  resetFlow: () => set((state) => ({
    flowExecution: {
      isExecuting: false,
      executionOrder: [],
      nodeStates: {}
    }
  }))
}));

// 노드 타입별 실행 함수들 (별도 파일로 분리 가능)
async function executeLLMNode(data: NodeData, inputs: any[]) {
  // LLM 노드 실행 로직
}

async function executeAPINode(data: NodeData, inputs: any[]) {
  // API 노드 실행 로직
}

function formatOutput(data: NodeData, input: any) {
  // 출력 노드 포맷팅 로직
} 