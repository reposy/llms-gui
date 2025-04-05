import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Node, Edge } from 'reactflow';
import { FlowState, NodeData, NodeType } from '../types/nodes';
import { calculateNodePosition, createNewNode } from '../utils/flowUtils';

const initialState: FlowState = {
  nodes: [],
  edges: [],
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
      const { nodeId, data: dataUpdate } = action.payload;
      const node = state.nodes.find(node => node.id === nodeId);
      if (node) {
        console.log(`[flowSlice] updateNodeData START - Node: ${nodeId}`, { 
          currentData: node.data, 
          update: dataUpdate 
        }); // Log start and update data
        
        const beforeAssign = { ...node.data }; // Copy data before update
        Object.assign(node.data, dataUpdate); // Update data
        
        console.log(`[flowSlice] updateNodeData END - Node: ${nodeId}`, { 
          before: beforeAssign, 
          after: node.data 
        }); // Log before and after data
      } else {
        console.warn(`[flowSlice] updateNodeData: Node ${nodeId} not found.`);
      }
    },
  },
});

export const { 
  setNodes, 
  setEdges, 
  addNode, 
  updateNodeData, 
  setSelectedNodeId 
} = flowSlice.actions;

export default flowSlice.reducer; 