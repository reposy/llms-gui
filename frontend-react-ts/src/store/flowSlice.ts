import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Node, Edge } from 'reactflow';
import { FlowState, NodeData, NodeType } from '../types/nodes';
import { NodeState } from '../types/execution';
import { calculateNodePosition, createNewNode } from '../utils/flowUtils';

const initialState: FlowState = {
  nodes: [],
  edges: [],
  nodeStates: {},
  selectedNodeId: null
};

interface AddNodePayload {
  type: NodeType;
  position?: { x: number; y: number };
  viewport?: { x: number; y: number; zoom: number };
}

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
      const { type, position, viewport } = action.payload;
      
      // Calculate the position for the new node
      const calculatedPosition = position || calculateNodePosition(state.nodes, state.selectedNodeId, viewport);
      
      // Create the new node using the helper function
      const newNode = createNewNode(type, calculatedPosition);
      
      // Log for debugging
      console.log(`[flowSlice] Adding new node of type ${type} with ID: ${newNode.id}`);
      
      // Add the node to the state
      state.nodes.push(newNode);
    },
    updateNodeData: (state, action: PayloadAction<{ nodeId: string; data: Partial<NodeData> }>) => {
      const node = state.nodes.find(node => node.id === action.payload.nodeId);
      if (!node) return;

      // Using Object.assign is fine, but ensure types are handled
      // This assumes the incoming data matches the node type, which should be ensured by the calling component
      Object.assign(node.data, action.payload.data);
    },
    setNodeState: (state, action: PayloadAction<{ nodeId: string; state: Partial<NodeState> }>) => {
      const { nodeId, state: nodeState } = action.payload;
      
      // Get existing state or initialize empty
      const existingState = state.nodeStates[nodeId] || {};
      
      // Update state with new values
      state.nodeStates[nodeId] = {
        ...existingState,
        ...nodeState
      };
    }
  },
});

export const { 
  setNodes, 
  setEdges, 
  addNode, 
  updateNodeData, 
  setNodeState,
  setSelectedNodeId 
} = flowSlice.actions;

export default flowSlice.reducer; 