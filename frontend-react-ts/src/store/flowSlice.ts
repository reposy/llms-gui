import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Node, Edge } from 'reactflow';
import { FlowState, NodeExecutionState, NodeExecutionStateData, NodeData, LLMNodeData, APINodeData, OutputNodeData, NodeType } from '../types/nodes';

const initialState: FlowState = {
  nodes: [],
  edges: [],
  nodeExecutionStates: {},
};

interface AddNodePayload {
  type: NodeType;
  position?: { x: number; y: number };
}

// 새로운 노드 생성을 위한 기본 데이터
const createDefaultNodeData = (type: NodeType): NodeData => {
  const baseData = {
    type,
    label: type.toUpperCase(),
    isExecuting: false,
  };

  switch (type) {
    case 'llm':
      return {
        ...baseData,
        type: 'llm',
        provider: 'ollama',
        model: 'llama2',
        prompt: '',
        temperature: 0.7,
      } as LLMNodeData;
    case 'api':
      return {
        ...baseData,
        type: 'api',
        method: 'GET',
        url: '',
        headers: {},
        useInputAsBody: false,
      } as APINodeData;
    case 'output':
      return {
        ...baseData,
        type: 'output',
        format: 'text',
      } as OutputNodeData;
  }
};

const flowSlice = createSlice({
  name: 'flow',
  initialState,
  reducers: {
    setNodes: (state, action: PayloadAction<Node<NodeData>[]>) => {
      state.nodes = action.payload;
    },
    setEdges: (state, action: PayloadAction<Edge[]>) => {
      state.edges = action.payload;
    },
    addNode: (state, action: PayloadAction<AddNodePayload>) => {
      const { type, position = { x: 100, y: 100 } } = action.payload;
      const newNode: Node<NodeData> = {
        id: `${type}-${Date.now()}`,
        type,
        position,
        data: createDefaultNodeData(type),
      };
      state.nodes.push(newNode);
    },
    updateNodeData: (state, action: PayloadAction<{ nodeId: string; data: Partial<NodeData> }>) => {
      const node = state.nodes.find((n) => n.id === action.payload.nodeId);
      if (!node) return;

      // OUTPUT 노드의 경우 content 필드는 무시
      if (node.data.type === 'output') {
        const { content: _, ...otherData } = action.payload.data as Partial<OutputNodeData>;
        node.data = {
          ...node.data,
          ...otherData,
        } as OutputNodeData;
        return;
      }

      node.data = {
        ...node.data,
        ...action.payload.data,
      } as NodeData;
    },
    setNodeExecutionState: (state, action: PayloadAction<{ nodeId: string; state: NodeExecutionStateData }>) => {
      const { nodeId, state: executionState } = action.payload;
      
      // NodeExecutionState 타입에 맞게 저장
      state.nodeExecutionStates[nodeId] = {
        nodeId,
        state: executionState,
      };

      // 실행이 완료되고 결과가 있는 경우에만 OUTPUT 노드 업데이트
      if (executionState.status === 'completed' && executionState.result) {
        // 현재 노드에 연결된 모든 OUTPUT 노드 찾기
        const connectedEdges = state.edges.filter(edge => edge.source === nodeId);
        
        connectedEdges.forEach(edge => {
          const targetNode = state.nodes.find(node => node.id === edge.target);
          if (targetNode?.data.type === 'output') {
            let content = '';
            const result = executionState.result;
            
            if (typeof result === 'string') {
              content = result;
            } else if (result && typeof result === 'object') {
              if ('text' in result) {
                content = result.text as string;
              } else if ('content' in result) {
                content = result.content as string;
              } else {
                content = JSON.stringify(result, null, 2);
              }
            }

            // OUTPUT 노드의 content만 업데이트
            targetNode.data = {
              ...targetNode.data,
              content,
            } as OutputNodeData;
          }
        });
      }
    },
  },
});

export const { setNodes, setEdges, addNode, updateNodeData, setNodeExecutionState } = flowSlice.actions;
export default flowSlice.reducer; 