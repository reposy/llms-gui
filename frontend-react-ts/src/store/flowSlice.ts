import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Node, Edge } from 'reactflow';
import { FlowState, NodeExecutionState, NodeExecutionStateData, NodeData, LLMNodeData, APINodeData, OutputNodeData, NodeType } from '../types/nodes';
import { calculateNodePosition, createDefaultNodeData } from '../utils/flowUtils'; // Import helpers

export const VIEW_MODES = {
  COMPACT: 'compact',
  EXPANDED: 'expanded',
  AUTO: 'auto'
} as const;

export type NodeViewMode = typeof VIEW_MODES.COMPACT | typeof VIEW_MODES.EXPANDED;
export type GlobalViewMode = NodeViewMode | typeof VIEW_MODES.AUTO;

const initialState: FlowState = {
  nodes: [],
  edges: [],
  nodeExecutionStates: {},
  selectedNodeId: null,
  globalViewMode: VIEW_MODES.EXPANDED,
  nodeViewModes: {},
  lastManualViewMode: VIEW_MODES.EXPANDED
};

interface AddNodePayload {
  type: NodeType;
  position?: { x: number; y: number };
  viewport?: { x: number; y: number; zoom: number };
}

// Constants for node positioning
const NODE_WIDTH = 300;
const NODE_HEIGHT = 200;
const NODE_SPACING_X = 50;
const NODE_SPACING_Y = 50;

// Helper function to calculate node position
const calculateNodePosition = (
  nodes: Node<NodeData>[],
  selectedNodeId: string | null,
  viewport?: { x: number; y: number; zoom: number }
) => {
  // If there's a selected node, position relative to it
  if (selectedNodeId) {
    const selectedNode = nodes.find(node => node.id === selectedNodeId);
    if (selectedNode) {
      return {
        x: selectedNode.position.x + NODE_WIDTH + NODE_SPACING_X,
        y: selectedNode.position.y + NODE_SPACING_Y
      };
    }
  }

  // If there are existing nodes but none selected, position near the last node
  if (nodes.length > 0) {
    const lastNode = nodes[nodes.length - 1];
    return {
      x: lastNode.position.x + NODE_WIDTH + NODE_SPACING_X,
      y: lastNode.position.y
    };
  }

  // If viewport is provided, center in viewport
  if (viewport) {
    const viewportCenter = {
      x: -viewport.x / viewport.zoom + window.innerWidth / 2 / viewport.zoom,
      y: -viewport.y / viewport.zoom + window.innerHeight / 2 / viewport.zoom
    };
    return {
      x: viewportCenter.x - NODE_WIDTH / 2,
      y: viewportCenter.y - NODE_HEIGHT / 2
    };
  }

  // Default position if no other conditions are met
  return { x: 100, y: 100 };
};

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
    default:
      throw new Error(`Unknown node type: ${type}`);
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
    setSelectedNodeId: (state, action: PayloadAction<string | null>) => {
      state.selectedNodeId = action.payload;
    },
    addNode: (state, action: PayloadAction<AddNodePayload>) => {
      const { type, viewport } = action.payload;
      const position = calculateNodePosition(state.nodes, state.selectedNodeId, viewport);
      
      const newNode: Node<NodeData> = {
        id: `${type}-${Date.now()}`,
        type,
        position,
        data: createDefaultNodeData(type),
      };
      state.nodes.push(newNode);
    },
    updateNodeData: (state, action: PayloadAction<{ nodeId: string; data: Partial<NodeData> }>) => {
      const node = state.nodes.find(node => node.id === action.payload.nodeId);
      if (!node) return;

      // Using Object.assign is fine, but ensure types are handled
      // This assumes the incoming data matches the node type, which should be ensured by the calling component
      Object.assign(node.data, action.payload.data);
    },
    setNodeExecutionState: (state, action: PayloadAction<{ nodeId: string; state: NodeExecutionStateData }>) => {
      const { nodeId, state: executionState } = action.payload;
      state.nodeExecutionStates[nodeId] = {
        nodeId,
        state: executionState,
      };
    },
    setGlobalViewMode: (state, action: PayloadAction<GlobalViewMode>) => {
      state.globalViewMode = action.payload;
      if (action.payload !== VIEW_MODES.AUTO) {
        state.lastManualViewMode = action.payload;
      }
    },
    setNodeViewMode: (state, action: PayloadAction<{ nodeId: string; mode: NodeViewMode }>) => {
      state.nodeViewModes[action.payload.nodeId] = action.payload.mode;
    },
    resetNodeViewMode: (state, action: PayloadAction<string>) => {
      delete state.nodeViewModes[action.payload];
    }
  },
});

export const { setNodes, setEdges, addNode, updateNodeData, setNodeExecutionState, setSelectedNodeId, setGlobalViewMode, setNodeViewMode, resetNodeViewMode } = flowSlice.actions;

// Selector to get effective view mode for a node
export const getNodeEffectiveViewMode = (state: { flow: FlowState }, nodeId: string): 'compact' | 'expanded' => {
  const nodeMode = state.flow.nodeViewModes[nodeId];
  if (nodeMode && nodeMode !== VIEW_MODES.AUTO) {
    return nodeMode;
  }
  return state.flow.globalViewMode === VIEW_MODES.AUTO 
    ? state.flow.lastManualViewMode 
    : state.flow.globalViewMode;
};

export default flowSlice.reducer; 