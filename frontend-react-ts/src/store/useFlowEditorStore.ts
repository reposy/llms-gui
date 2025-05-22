import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { Edge, Node } from '@xyflow/react';
import { deepClone } from '../utils/helpers';
import { type FlowData } from '../utils/data/importExportUtils';
import { NodeData } from '../types/nodes';

// 스토어 상태 타입 정의
interface FlowEditorState {
  // 노드 및 에지 데이터
  nodes: Node<NodeData>[];
  edges: Edge[];
  
  // 현재 Flow 메타데이터
  currentFlow: {
    id: string;
    name: string;
    lastModified: Date;
  } | null;
  
  // 선택 상태
  selectedNodes: string[];
  selectedEdges: string[];
  
  // 기록 관리
  history: {
    past: { nodes: Node<NodeData>[], edges: Edge[] }[];
    future: { nodes: Node<NodeData>[], edges: Edge[] }[];
  };
  
  // 액션
  // 노드 관련
  addNode: (node: Node<NodeData>) => void;
  updateNode: (id: string, updates: Partial<Node<NodeData>>) => void;
  removeNode: (id: string) => void;
  setNodes: (nodes: Node<NodeData>[]) => void;
  
  // 에지 관련
  addEdge: (edge: Edge) => void;
  updateEdge: (id: string, updates: Partial<Edge>) => void;
  removeEdge: (id: string) => void;
  setEdges: (edges: Edge[]) => void;
  
  // 선택 관련
  selectNode: (id: string, isMultiSelect?: boolean) => void;
  selectEdge: (id: string, isMultiSelect?: boolean) => void;
  clearSelection: () => void;
  
  // Flow 관련
  createNewFlow: (name?: string) => string;
  loadFlow: (flow: FlowData) => void;
  saveCurrentFlow: () => FlowData | null;
  setFlowName: (name: string) => void;
  
  // 기록 관련
  undo: () => void;
  redo: () => void;
  recordHistory: () => void;
  
  // 상태 초기화
  resetState: () => void;
}

// 초기 상태
const initialState = {
  nodes: [] as Node<NodeData>[],
  edges: [] as Edge[],
  currentFlow: null,
  selectedNodes: [],
  selectedEdges: [],
  history: {
    past: [],
    future: []
  }
};

// Flow Editor 스토어 생성
export const useFlowEditorStore = create<FlowEditorState>()(
  persist(
    (set, get) => ({
      ...initialState,
      
      // 노드 관련 액션
      addNode: (node) => {
        set((state) => {
          const newNodes = [...state.nodes, node];
          return { nodes: newNodes };
        });
        get().recordHistory();
      },
      
      updateNode: (id, updates) => {
        set((state) => {
          const newNodes = state.nodes.map((node) => 
            node.id === id ? { ...node, ...updates } : node
          );
          return { nodes: newNodes };
        });
        get().recordHistory();
      },
      
      removeNode: (id) => {
        set((state) => {
          const newNodes = state.nodes.filter((node) => node.id !== id);
          // 해당 노드에 연결된 엣지도 제거
          const newEdges = state.edges.filter(
            (edge) => edge.source !== id && edge.target !== id
          );
          return { 
            nodes: newNodes,
            edges: newEdges,
            selectedNodes: state.selectedNodes.filter((nodeId) => nodeId !== id)
          };
        });
        get().recordHistory();
      },
      
      setNodes: (nodes: Node<NodeData>[]) => {
        set({ nodes });
        get().recordHistory();
      },
      
      // 에지 관련 액션
      addEdge: (edge) => {
        set((state) => {
          // 중복 엣지 방지
          const isDuplicate = state.edges.some(
            (e) => e.source === edge.source && e.target === edge.target
          );
          
          if (isDuplicate) {
            return state;
          }
          
          const newEdges = [...state.edges, { ...edge, id: edge.id || `edge-${uuidv4()}` }];
          return { edges: newEdges };
        });
        get().recordHistory();
      },
      
      updateEdge: (id, updates) => {
        set((state) => {
          const newEdges = state.edges.map((edge) => 
            edge.id === id ? { ...edge, ...updates } : edge
          );
          return { edges: newEdges };
        });
        get().recordHistory();
      },
      
      removeEdge: (id) => {
        set((state) => {
          const newEdges = state.edges.filter((edge) => edge.id !== id);
          return { 
            edges: newEdges,
            selectedEdges: state.selectedEdges.filter((edgeId) => edgeId !== id)
          };
        });
        get().recordHistory();
      },
      
      setEdges: (edges: Edge[]) => {
        set({ edges });
        get().recordHistory();
      },
      
      // 선택 관련 액션
      selectNode: (id, isMultiSelect = false) => {
        set((state) => {
          if (isMultiSelect) {
            const isSelected = state.selectedNodes.includes(id);
            const newSelectedNodes = isSelected
              ? state.selectedNodes.filter((nodeId) => nodeId !== id)
              : [...state.selectedNodes, id];
            return { selectedNodes: newSelectedNodes };
          } else {
            return { selectedNodes: [id], selectedEdges: [] };
          }
        });
      },
      
      selectEdge: (id, isMultiSelect = false) => {
        set((state) => {
          if (isMultiSelect) {
            const isSelected = state.selectedEdges.includes(id);
            const newSelectedEdges = isSelected
              ? state.selectedEdges.filter((edgeId) => edgeId !== id)
              : [...state.selectedEdges, id];
            return { selectedEdges: newSelectedEdges };
          } else {
            return { selectedNodes: [], selectedEdges: [id] };
          }
        });
      },
      
      clearSelection: () => {
        set({ selectedNodes: [], selectedEdges: [] });
      },
      
      // Flow 관련 액션
      createNewFlow: (name = 'New Flow') => {
        const flowId = `flow-${uuidv4()}`;
        set({
          nodes: [],
          edges: [],
          currentFlow: {
            id: flowId,
            name,
            lastModified: new Date()
          },
          selectedNodes: [],
          selectedEdges: [],
          history: {
            past: [],
            future: []
          }
        });
        return flowId;
      },
      
      loadFlow: (flow: FlowData) => {
        set({
          nodes: deepClone(flow.nodes) as Node<NodeData>[],
          edges: deepClone(flow.edges) as Edge[],
          currentFlow: {
            id: `flow-${uuidv4()}`,
            name: flow.name || 'Imported Flow',
            lastModified: new Date()
          },
          selectedNodes: [],
          selectedEdges: [],
          history: {
            past: [],
            future: []
          }
        });
      },
      
      saveCurrentFlow: () => {
        const { nodes, edges, currentFlow } = get();
        if (!currentFlow) {
          return null;
        }
        const flowData: FlowData = {
          name: currentFlow.name,
          nodes: deepClone(nodes) as Node<NodeData>[],
          edges: deepClone(edges) as Edge[]
        };
        set(state => ({
          currentFlow: state.currentFlow 
            ? { ...state.currentFlow, lastModified: new Date() }
            : null
        }));
        return flowData;
      },
      
      setFlowName: (name) => {
        set(state => ({
          currentFlow: state.currentFlow 
            ? { ...state.currentFlow, name, lastModified: new Date() }
            : null
        }));
      },
      
      // 기록 관련 액션
      recordHistory: () => {
        const { nodes, edges, history } = get();
        
        set({
          history: {
            past: [
              ...history.past,
              { nodes: deepClone(nodes), edges: deepClone(edges) }
            ].slice(-30), // 최대 30개 기록 유지
            future: []
          }
        });
      },
      
      undo: () => {
        const { history } = get();
        
        if (history.past.length === 0) {
          return;
        }
        
        const newPast = [...history.past];
        const lastState = newPast.pop();
        
        if (!lastState) {
          return;
        }
        
        set(state => ({
          nodes: deepClone(lastState.nodes),
          edges: deepClone(lastState.edges),
          history: {
            past: newPast,
            future: [
              { nodes: deepClone(state.nodes), edges: deepClone(state.edges) },
              ...history.future
            ].slice(0, 30) // 최대 30개 기록 유지
          }
        }));
      },
      
      redo: () => {
        const { history } = get();
        
        if (history.future.length === 0) {
          return;
        }
        
        const newFuture = [...history.future];
        const nextState = newFuture.shift();
        
        if (!nextState) {
          return;
        }
        
        set(state => ({
          nodes: deepClone(nextState.nodes),
          edges: deepClone(nextState.edges),
          history: {
            past: [
              ...history.past,
              { nodes: deepClone(state.nodes), edges: deepClone(state.edges) }
            ].slice(-30),
            future: newFuture
          }
        }));
      },
      
      // 상태 초기화
      resetState: () => {
        set(initialState);
      }
    }),
    {
      name: 'flow-editor-store',
      // 민감한 필드나 큰 상태 일부는 영구 저장에서 제외
      partialize: (state) => ({
        nodes: state.nodes,
        edges: state.edges,
        currentFlow: state.currentFlow,
        // history는 크기가 클 수 있어 제외
      })
    }
  )
); 