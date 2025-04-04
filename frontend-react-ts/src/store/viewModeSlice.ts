import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from './store';

// Define view mode constants
export const VIEW_MODES = {
  COMPACT: 'compact',
  EXPANDED: 'expanded',
  AUTO: 'auto'
} as const;

export type NodeViewMode = typeof VIEW_MODES.COMPACT | typeof VIEW_MODES.EXPANDED;
export type GlobalViewMode = NodeViewMode | typeof VIEW_MODES.AUTO;

// Define the state structure for the view mode slice
export interface ViewModeState {
  globalViewMode: GlobalViewMode;
  nodeViewModes: Record<string, NodeViewMode>;
  lastManualViewMode: NodeViewMode;
}

const initialState: ViewModeState = {
  globalViewMode: VIEW_MODES.EXPANDED,
  nodeViewModes: {},
  lastManualViewMode: VIEW_MODES.EXPANDED
};

const viewModeSlice = createSlice({
  name: 'viewMode',
  initialState,
  reducers: {
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

export const { setGlobalViewMode, setNodeViewMode, resetNodeViewMode } = viewModeSlice.actions;

// Selector to get effective view mode for a node
export const getNodeEffectiveViewMode = (state: RootState, nodeId: string): 'compact' | 'expanded' => {
  const nodeMode = state.viewMode.nodeViewModes[nodeId];
  if (nodeMode && nodeMode !== VIEW_MODES.AUTO) {
    return nodeMode;
  }
  return state.viewMode.globalViewMode === VIEW_MODES.AUTO 
    ? state.viewMode.lastManualViewMode 
    : state.viewMode.globalViewMode;
};

export default viewModeSlice.reducer; 