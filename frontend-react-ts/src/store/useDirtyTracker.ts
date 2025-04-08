import { create } from 'zustand';
import { shallow } from 'zustand/shallow';
import { useNodes, useEdges } from './useFlowStructureStore';
import { useNodeContentStore } from './useNodeContentStore';
import { useEffect, useCallback } from 'react';
import { isEqual } from 'lodash';

interface DirtyTrackerState {
  // Snapshot of clean state
  cleanState: {
    nodes: any[];
    edges: any[];
    contents: Record<string, any>;
  } | null;

  // Status
  isDirty: boolean;

  // Actions
  setCleanState: (state: NonNullable<DirtyTrackerState['cleanState']>) => void;
  setDirty: (isDirty: boolean) => void;
  reset: () => void;
}

// Create Zustand store
export const useDirtyTrackerStore = create<DirtyTrackerState>()((set) => ({
  // Initial state
  cleanState: null,
  isDirty: false,

  // Set clean state with current values
  setCleanState: (state) => {
    set({
      cleanState: JSON.parse(JSON.stringify(state)), // Deep copy to avoid reference issues
      isDirty: false
    });
  },

  // Manually set dirty status
  setDirty: (isDirty: boolean) => set({ isDirty }),

  // Reset tracking
  reset: () => set({ cleanState: null, isDirty: false })
}));

// Export individual selectors
export const useIsDirty = () => useDirtyTrackerStore(state => state.isDirty);

/**
 * Custom hook to mark the current state as clean
 */
export const useMarkClean = () => {
  const nodes = useNodes();
  const edges = useEdges();
  const contents = useNodeContentStore(state => state.getAllNodeContents());
  const setCleanState = useDirtyTrackerStore(state => state.setCleanState);

  return useCallback(() => {
    setCleanState({
      nodes,
      edges,
      contents
    });
  }, [nodes, edges, contents, setCleanState]);
};

/**
 * Hook to use dirty tracking in components
 * Automatically compares current state with clean state
 */
export const useDirtyTracker = () => {
  const nodes = useNodes();
  const edges = useEdges();
  const contents = useNodeContentStore(state => state.getAllNodeContents());
  const markClean = useMarkClean();
  
  const { cleanState, isDirty } = useDirtyTrackerStore(
    state => ({
      cleanState: state.cleanState,
      isDirty: state.isDirty
    }),
    shallow
  );

  // Set initial clean state if not set
  useEffect(() => {
    if (!cleanState && nodes.length > 0) {
      markClean();
    }
  }, [cleanState, nodes.length, markClean]);

  // Check for changes from clean state
  useEffect(() => {
    if (!cleanState) return;

    const isNodesDirty = !isEqual(nodes, cleanState.nodes);
    const isEdgesDirty = !isEqual(edges, cleanState.edges);
    const isContentsDirty = !isEqual(contents, cleanState.contents);
    
    const newIsDirty = isNodesDirty || isEdgesDirty || isContentsDirty;
    
    if (newIsDirty !== isDirty) {
      useDirtyTrackerStore.getState().setDirty(newIsDirty);
      
      // For debug purposes
      if (newIsDirty) {
        console.log('[DirtyTracker] Flow is now dirty', { 
          isNodesDirty, 
          isEdgesDirty, 
          isContentsDirty 
        });
      }
    }
  }, [nodes, edges, contents, cleanState, isDirty]);

  return { 
    isDirty,
    markClean
  };
};
