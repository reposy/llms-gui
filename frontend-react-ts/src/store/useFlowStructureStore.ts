import { create } from 'zustand';
import { persist, createJSONStorage, StorageValue } from 'zustand/middleware';
import { Node, Edge } from 'reactflow';
import { createIDBStorage } from '../utils/idbStorage';
import { NodeData } from '../types/nodes';
import { subscribeWithSelector } from 'zustand/middleware';

// Define the state structure
export interface FlowStructureState {
  nodes: Node<NodeData>[];
  edges: Edge[];
  selectedNodeId: string | null;
  setNodes: (nodes: Node<NodeData>[]) => void;
  setEdges: (edges: Edge[]) => void;
  setSelectedNodeId: (nodeId: string | null) => void;
}

// Custom storage wrapper for IndexedDB
const idbStorage = createIDBStorage();

// Create the Zustand store with persistence
export const useFlowStructureStore = create<FlowStructureState>()(
  subscribeWithSelector( // Wrap with subscribeWithSelector for granular subscriptions
    persist(
      (set, get) => ({ 
        nodes: [],
        edges: [],
        selectedNodeId: null, // Initialize selectedNodeId
        
        setNodes: (nodes) => set((state) => {
          console.log('[Zustand] Setting nodes:', nodes.length);
          // Ensure immutability
          return { nodes: [...nodes] }; 
        }),
        
        setEdges: (edges) => set((state) => {
          console.log('[Zustand] Setting edges:', edges.length);
          // Ensure immutability
          return { edges: [...edges] }; 
        }),
        
        setSelectedNodeId: (nodeId) => set((state) => {
          if (state.selectedNodeId !== nodeId) {
            console.log(`[Zustand] Setting selectedNodeId: ${nodeId}`);
            // Return new state object
            return { 
              selectedNodeId: nodeId,
              // Update node selection immutably
              nodes: state.nodes.map(n => ({ 
                ...n, 
                selected: n.id === nodeId 
              }))
            };
          }
          return {}; // No change if ID is the same
        }),
      }),
      {
        name: 'flow-structure-storage', // Unique name for the storage
        storage: createJSONStorage(() => idbStorage), // Use wrapped IndexedDB storage
        partialize: (state) => ({ 
            nodes: state.nodes, 
            edges: state.edges, 
            selectedNodeId: state.selectedNodeId // Persist selectedNodeId too
        }), 
        onRehydrateStorage: (state) => {
          console.log('[Zustand] Hydration process starting...');
          // Return value is not used according to docs, just for side-effects
          return (_state, error) => {
            if (error) {
              console.error('[Zustand] Hydration failed:', error);
            } else {
              console.log('[Zustand] Hydration finished successfully.');
              // Ensure nodes have correct selection state after hydration
              // Use timeout to ensure this runs after initial state is set
              setTimeout(() => {
                 useFlowStructureStore.setState(s => ({ 
                    nodes: s.nodes.map(n => ({ ...n, selected: n.id === s.selectedNodeId }))
                 }));
              }, 0);
            }
          };
        },
      }
    )
  )
);

// Export hooks for easy access
export const useNodes = () => useFlowStructureStore((state) => state.nodes);
export const useEdges = () => useFlowStructureStore((state) => state.edges);
export const useSelectedNodeId = () => useFlowStructureStore((state) => state.selectedNodeId);

// Export actions for direct use (using getState)
export const setNodes = (nodes: Node<NodeData>[]) => useFlowStructureStore.getState().setNodes(nodes);
export const setEdges = (edges: Edge[]) => useFlowStructureStore.getState().setEdges(edges);
export const setSelectedNodeId = (nodeId: string | null) => useFlowStructureStore.getState().setSelectedNodeId(nodeId);