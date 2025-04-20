import { create } from 'zustand';
import { devtools, persist, createJSONStorage } from 'zustand/middleware';
import { createIDBStorage } from '../utils/storage/idbStorage';

// Define the view mode types directly in this file (moved from viewModeSlice.ts)
export type NodeViewMode = 'expanded' | 'compact' | 'auto';
export type GlobalViewMode = 'expanded' | 'compact' | 'auto';

// Define VIEW_MODES constants
export const VIEW_MODES = {
  EXPANDED: 'expanded' as GlobalViewMode,
  COMPACT: 'compact' as GlobalViewMode,
  AUTO: 'auto' as GlobalViewMode,
};

// Define the state structure for the view mode store
interface ViewModeState {
  globalViewMode: GlobalViewMode;
  nodeViewModes: Record<string, NodeViewMode>;
  lastManualViewMode: NodeViewMode;
  
  // Actions
  setGlobalViewMode: (mode: GlobalViewMode) => void;
  setNodeViewMode: (params: { nodeId: string; mode: NodeViewMode }) => void;
  resetNodeViewMode: (nodeId: string) => void;
  
  // Selectors
  getNodeEffectiveViewMode: (nodeId: string) => NodeViewMode;
}

// Create the store
export const useStore = create<ViewModeState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        globalViewMode: VIEW_MODES.EXPANDED,
        nodeViewModes: {},
        lastManualViewMode: VIEW_MODES.EXPANDED,
        
        // Actions
        setGlobalViewMode: (mode) => set((state) => ({
          globalViewMode: mode,
          lastManualViewMode: mode !== VIEW_MODES.AUTO ? mode : state.lastManualViewMode
        })),
        
        setNodeViewMode: ({ nodeId, mode }) => set((state) => ({
          nodeViewModes: {
            ...state.nodeViewModes,
            [nodeId]: mode
          }
        })),
        
        resetNodeViewMode: (nodeId) => set((state) => {
          const newNodeViewModes = { ...state.nodeViewModes };
          delete newNodeViewModes[nodeId];
          return { nodeViewModes: newNodeViewModes };
        }),
        
        // Selectors
        getNodeEffectiveViewMode: (nodeId) => {
          const state = get();
          const nodeMode = state.nodeViewModes[nodeId];
          if (nodeMode && nodeMode !== VIEW_MODES.AUTO) {
            return nodeMode;
          }
          return state.globalViewMode === VIEW_MODES.AUTO 
            ? state.lastManualViewMode 
            : state.globalViewMode;
        }
      }),
      {
        name: 'view-mode-storage',
        storage: createJSONStorage(() => createIDBStorage<ViewModeState>()),
      }
    )
  )
);

// Export convenience hooks for specific parts of state
export const useGlobalViewMode = () => useStore(state => state.globalViewMode);
export const useNodeViewMode = (nodeId: string) => useStore(state => state.getNodeEffectiveViewMode(nodeId)); 