import { create } from 'zustand';
import { Node, Edge } from '@xyflow/react';
import { NodeContent, NodeData } from '../types/nodes';
import { setNodeContent, loadFromImportedContents, getAllNodeContents } from './useNodeContentStore';
import { isEqual, cloneDeep } from 'lodash';
import { setNodes, setEdges } from './useFlowStructureStore';
import { resetNodeStates } from './useNodeStateStore';

// Define snapshot interface
export interface FlowSnapshot {
  nodes: Node<NodeData>[];
  edges: Edge[];
  contents: Record<string, NodeContent>;
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
      // Ensure we're storing a deep copy of the contents to prevent reference issues
      const snapshotWithDeepCopy = {
        ...snapshot,
        contents: cloneDeep(snapshot.contents)
      };

      // Check if this snapshot is identical to the most recent one
      const latestSnapshot = state.past[state.past.length - 1];
      if (latestSnapshot && 
          isEqual(latestSnapshot.nodes, snapshotWithDeepCopy.nodes) && 
          isEqual(latestSnapshot.edges, snapshotWithDeepCopy.edges) && 
          isEqual(latestSnapshot.contents, snapshotWithDeepCopy.contents)) {
        return state; // No change, return the current state
      }

      // Limit history size
      const newPast = [...state.past, snapshotWithDeepCopy];
      if (newPast.length > state.maxHistorySize) {
        newPast.shift(); // Remove oldest item
      }

      console.log(`[HistoryStore] Pushed snapshot with ${snapshotWithDeepCopy.nodes.length} nodes, ${snapshotWithDeepCopy.edges.length} edges, and ${Object.keys(snapshotWithDeepCopy.contents).length} content entries`);

      return {
        past: newPast,
        future: [], // Clear future when a new snapshot is added
        canUndo: true,
        canRedo: false
      };
    });
  },

  // Undo the last action
  undo: () => {
    const state = get();
    if (state.past.length <= 1) return; // Keep at least one snapshot

    const newPast = [...state.past];
    const current = newPast.pop()!; // Get current state
    const previous = newPast[newPast.length - 1]; // Get previous state

    console.log(`[HistoryStore] Undoing to snapshot with ${previous.nodes.length} nodes, ${previous.edges.length} edges, and ${Object.keys(previous.contents).length} content entries`);

    // 1. Reset execution state for all affected nodes
    const allNodeIds = [...previous.nodes.map(n => n.id), ...current.nodes.map(n => n.id)];
    resetNodeStates(allNodeIds);

    // 2. Restore node contents using loadFromImportedContents
    loadFromImportedContents(cloneDeep(previous.contents));

    // 3. Restore flow structure
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

    console.log(`[HistoryStore] Redoing to snapshot with ${next.nodes.length} nodes, ${next.edges.length} edges, and ${Object.keys(next.contents).length} content entries`);

    // 1. Reset execution state for all affected nodes
    const currentNodeIds = state.past[state.past.length - 1]?.nodes.map(n => n.id) || [];
    const nextNodeIds = next.nodes.map(n => n.id);
    const allNodeIds = [...currentNodeIds, ...nextNodeIds];
    resetNodeStates(allNodeIds);

    // 2. Restore node contents using loadFromImportedContents
    loadFromImportedContents(cloneDeep(next.contents));

    // 3. Restore flow structure
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