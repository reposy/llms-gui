import { createWithEqualityFn } from 'zustand/traditional';
import { devtools, persist } from 'zustand/middleware';
import { isEqual } from 'lodash';
import { NodeState, defaultNodeState } from '../types/execution';

// Define the state structure for node state management
export interface NodeStateStoreState {
  nodeStates: Record<string, NodeState>;
  
  // Node state management
  getNodeState: (nodeId: string) => NodeState;
  setNodeState: (nodeId: string, state: Partial<NodeState>) => void;
  resetNodeStates: (nodeIds?: string[]) => void;
}

// Create the Zustand store for node state management
export const useNodeStateStore = createWithEqualityFn<NodeStateStoreState>()(
  devtools(
    persist(
      (set, get) => ({
        nodeStates: {},

        // --- State Management Methods --- 
        getNodeState: (nodeId) => {
          return get().nodeStates[nodeId] || { ...defaultNodeState };
        },

        setNodeState: (nodeId, stateUpdate) => {
          set(prev => {
            const currentState = prev.nodeStates[nodeId] || defaultNodeState;
            const updatedNodeState = {
              ...currentState,
              ...stateUpdate,
              _lastUpdate: Date.now()
            };

            // Auto-clear results/errors based on status changes if not explicitly provided
            if (stateUpdate.status && stateUpdate.status !== 'success' && stateUpdate.result === undefined) {
                updatedNodeState.result = null;
            }
            if (stateUpdate.status && stateUpdate.status !== 'error' && stateUpdate.error === undefined) {
                updatedNodeState.error = undefined;
            }
            // Always keep execution ID if provided
            if (stateUpdate.executionId) {
                updatedNodeState.executionId = stateUpdate.executionId;
            }
             // Always keep trigger node ID if provided
            if (stateUpdate.lastTriggerNodeId) {
                updatedNodeState.lastTriggerNodeId = stateUpdate.lastTriggerNodeId;
            }

            const newState = {
              ...prev.nodeStates,
              [nodeId]: updatedNodeState
            };
            return { nodeStates: newState };
          });
        },

        resetNodeStates: (nodeIds?: string[]) => {
          if (nodeIds && nodeIds.length > 0) {
            set(prev => {
              const newNodeStates = { ...prev.nodeStates };
              nodeIds.forEach(id => {
                newNodeStates[id] = { ...defaultNodeState }; // Reset to default, don't delete
              });
              return { nodeStates: newNodeStates };
            });
          } else {
            set({ nodeStates: {} }); // Reset all if no specific IDs provided
          }
        },
      }),
      {
        name: 'node-state-storage',
        partialize: (state) => ({
          nodeStates: state.nodeStates,
        }),
      }
    )
  )
);

// --- Hooks for Component Usage --- 

// Hook to get the state of a specific node
export const useNodeState = (nodeId: string): NodeState => {
  return useNodeStateStore(
    state => state.nodeStates[nodeId] || defaultNodeState,
    // Use lodash isEqual for deep comparison to prevent unnecessary re-renders
    isEqual 
  );
};

// Export actions directly for use outside components
export const { setNodeState, resetNodeStates, getNodeState } = useNodeStateStore.getState(); 