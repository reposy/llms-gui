import { create } from 'zustand';
import { shallow } from 'zustand/shallow';
import { useNodes, useEdges } from './useFlowStructureStore';
import { useNodeContentStore } from './useNodeContentStore';
import { useEffect } from 'react';
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
  markClean: () => void;
  setDirty: (isDirty: boolean) => void;
  reset: () => void;
}

// Create Zustand store
export const useDirtyTrackerStore = create<DirtyTrackerState>()((set, get) => ({
  // Initial state
  cleanState: null,
  isDirty: false,

  // Mark current state as clean
  markClean: () => {
    const nodes = useNodes();
    const edges = useEdges();
    const contents = useNodeContentStore.getState().getAllNodeContents();

    // Create deep copies to avoid reference issues
    set({
      cleanState: {
        nodes: JSON.parse(JSON.stringify(nodes)),
        edges: JSON.parse(JSON.stringify(edges)),
        contents: JSON.parse(JSON.stringify(contents))
      },
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

// Export actions for use outside React components
export const {
  markClean,
  setDirty,
  reset: resetDirtyTracker
} = useDirtyTrackerStore.getState();

/**
 * Hook to use dirty tracking in components
 * Automatically compares current state with clean state
 */
export const useDirtyTracker = () => {
  const nodes = useNodes();
  const edges = useEdges();
  const contents = useNodeContentStore(state => state.getAllNodeContents());
  
  const { cleanState, isDirty, markClean } = useDirtyTrackerStore(
    state => ({
      cleanState: state.cleanState,
      isDirty: state.isDirty,
      markClean: state.markClean
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
      setDirty(newIsDirty);
      
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
