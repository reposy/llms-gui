import { create } from 'zustand';
import { Node, Edge } from '@xyflow/react';
import { NodeProperty } from '../types/nodes';
import { setNodeProperty, loadFromImportedContents, getAllNodePropertys } from './useNodePropertyStore';
import { isEqual, cloneDeep } from 'lodash';
import { setNodes, setEdges } from './useFlowStructureStore';
import { resetNodeStates } from './useNodeStateStore';

// Define snapshot interface
export interface FlowSnapshot {
  nodes: Node<NodeProperty>[];
  edges: Edge[];
  contents: Record<string, NodeProperty>;
}

interface HistoryState {
  // State
  past: FlowSnapshot[];
  future: FlowSnapshot[];
  maxHistorySize: number;
  
  // Status flags
  canUndo: boolean;
  canRedo: boolean;
  isCapturing: boolean;
  
  // Actions
  pushSnapshot: (snapshot: FlowSnapshot) => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
  setMaxHistorySize: (size: number) => void;
  startCapturing: () => void;
  stopCapturing: () => void;
}

// Create the Zustand store
export const useHistoryStore = create<HistoryState>((set, get) => ({
  // Initial state
  past: [],
  future: [],
  maxHistorySize: 30,
  canUndo: false,
  canRedo: false,
  isCapturing: true,

  // Push a new snapshot to history
  pushSnapshot: (snapshot: FlowSnapshot) => {
    if (!get().isCapturing) return;
    set(state => {
      const snapshotWithDeepCopy = {
        ...snapshot,
        contents: cloneDeep(snapshot.contents)
      };
      const latestSnapshot = state.past[state.past.length - 1];
      if (latestSnapshot && 
          isEqual(latestSnapshot.nodes, snapshotWithDeepCopy.nodes) && 
          isEqual(latestSnapshot.edges, snapshotWithDeepCopy.edges) && 
          isEqual(latestSnapshot.contents, snapshotWithDeepCopy.contents)) {
        return state;
      }
      const newPast = [...state.past, snapshotWithDeepCopy];
      if (newPast.length > state.maxHistorySize) {
        newPast.shift();
      }
      return {
        past: newPast,
        future: [],
        canUndo: true,
        canRedo: false
      };
    });
  },

  // Undo the last action
  undo: () => {
    const state = get();
    if (state.past.length <= 1) return;
    const newPast = [...state.past];
    const current = newPast.pop()!;
    const previous = newPast[newPast.length - 1];
    resetNodeStates([...previous.nodes.map(n => n.id), ...current.nodes.map(n => n.id)]);
    loadFromImportedContents(cloneDeep(previous.contents));
    setNodes(previous.nodes);
    setEdges(previous.edges);
    set({
      past: newPast,
      future: [current, ...state.future],
      canUndo: newPast.length > 1,
      canRedo: true
    });
    return previous;
  },

  // Redo a previously undone action
  redo: () => {
    const state = get();
    if (state.future.length === 0) return;
    const newFuture = [...state.future];
    const next = newFuture.shift()!;
    resetNodeStates([...(state.past[state.past.length - 1]?.nodes.map(n => n.id) || []), ...next.nodes.map(n => n.id)]);
    loadFromImportedContents(cloneDeep(next.contents));
    setNodes(next.nodes);
    setEdges(next.edges);
    set({
      past: [...state.past, next],
      future: newFuture,
      canUndo: true,
      canRedo: newFuture.length > 0
    });
    return next;
  },

  // Clear history
  clear: () => set({
    past: [],
    future: [],
    canUndo: false,
    canRedo: false
  }),

  // Set max history size
  setMaxHistorySize: (size: number) => set({ maxHistorySize: size }),

  // Control capturing
  startCapturing: () => set({ isCapturing: true }),
  stopCapturing: () => set({ isCapturing: false })
}));

// Export individual selectors
export const useCanUndo = () => useHistoryStore(state => state.canUndo);
export const useCanRedo = () => useHistoryStore(state => state.canRedo);

// Export actions directly for use outside of React components
export const {
  pushSnapshot,
  undo,
  redo,
  clear: clearHistory,
  setMaxHistorySize,
  startCapturing,
  stopCapturing
} = useHistoryStore.getState(); 