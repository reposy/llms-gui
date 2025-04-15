import { createWithEqualityFn } from 'zustand/traditional';
import { devtools, persist } from 'zustand/middleware';
import { isEqual } from 'lodash';
import { NodeState, defaultNodeState } from '../types/execution';
import { createIDBStorage } from '../utils/idbStorage';

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
        storage: createIDBStorage<NodeStateStoreState>(),
        partialize: (state) => {
          // Create a copy of nodeStates with large results filtered out
          const filteredNodeStates: Record<string, NodeState> = {};
          
          Object.entries(state.nodeStates).forEach(([nodeId, nodeState]) => {
            // Copy the nodeState but exclude potentially large results
            const { result, ...restOfNodeState } = nodeState;
            
            // Store a simplified version of the result if it exists
            // This prevents localStorage quota issues
            let simplifiedResult = null;
            
            if (result !== null && result !== undefined) {
              // For arrays, store just the length and type information
              if (Array.isArray(result)) {
                simplifiedResult = { 
                  type: 'array',
                  length: result.length,
                  hasResults: true
                };
              } else if (typeof result === 'object' && result !== null) {
                // For objects, store just the keys
                simplifiedResult = {
                  type: 'object',
                  keys: Object.keys(result),
                  hasResults: true
                };
              } else if (typeof result === 'string' && result.length > 1000) {
                // For large strings, truncate
                simplifiedResult = {
                  type: 'string',
                  length: result.length,
                  preview: result.substring(0, 100) + '...',
                  hasResults: true
                };
              } else {
                // For small primitives, keep as is
                simplifiedResult = result;
              }
            }
            
            filteredNodeStates[nodeId] = {
              ...restOfNodeState,
              result: simplifiedResult
            };
          });
          
          return {
            nodeStates: filteredNodeStates
          };
        },
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