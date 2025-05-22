import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import { FlowExecutionContext } from '../core/FlowExecutionContext';
import { NodeFactory } from '../core/NodeFactory';
import { registerAllNodeTypes } from '../core/NodeRegistry';
import { v4 as uuidv4 } from 'uuid';
import { useFlowStructureStore } from './useFlowStructureStore';
import { getNodeContent } from './useNodeContentStore';
import { runGroupNodeExecution } from '../core/executionUtils';

// Rename state interface
export interface GroupExecutionControllerState { // Renamed
  isExecuting: boolean;
  currentExecutionId?: string;
  currentIterationItem?: any;
  currentIterationIndex?: number;
  currentGroupTotalItems?: number;

  // Public actions
  executeFlowForGroup: (groupNodeId: string) => Promise<void>;

  // Internal state setters
  _setIsExecuting: (isExecuting: boolean) => void;
  _setCurrentExecutionId: (executionId?: string) => void;
  _setIterationContext: (context: { item?: any; index?: number; total?: number }) => void;
}

// Rename store creator
export const useGroupExecutionController = create<GroupExecutionControllerState>()( // Renamed
  devtools(
    (set, get) => ({
      isExecuting: false,
      currentExecutionId: undefined,
      currentIterationItem: undefined,
      currentIterationIndex: undefined,
      currentGroupTotalItems: undefined,

      // Public actions
      executeFlowForGroup: async (groupNodeId: string) => {
        // Get the state setting function directly
        const setExecuting = get()._setIsExecuting;
        
        // Reset iteration context (and potentially other states) at the start
        get()._setCurrentExecutionId(undefined); // Clear previous execution ID
        get()._setIterationContext({}); // Clear iteration context

        setExecuting(true); // Set executing flag
        console.log(`[GroupExecutionController] Starting execution for group ${groupNodeId}`);

        try {
          // Call the centralized execution utility
          await runGroupNodeExecution(groupNodeId);
          console.log(`[GroupExecutionController] Successfully completed execution for group ${groupNodeId}`);
          // Optionally update other state based on successful completion
        } catch (error) {
          console.error(`[GroupExecutionController] Error executing group ${groupNodeId}:`, error);
          // Optionally update state to reflect the error
        } finally {
          setExecuting(false); // Ensure executing flag is reset regardless of success/failure
          console.log(`[GroupExecutionController] Finished execution attempt for group ${groupNodeId}`);
        }
      },

      // --- Internal State Setters --- 
      _setIsExecuting: (isExecuting) => set({ isExecuting }),
      _setCurrentExecutionId: (executionId) => set({ currentExecutionId: executionId }),
      _setIterationContext: ({ item, index, total }) => set({
        currentIterationItem: item,
        currentIterationIndex: index,
        currentGroupTotalItems: total
      })
    })
  )
);

// Rename selector export
export const useGroupExecutionState = () => useGroupExecutionController(state => ({ // Renamed
  isExecuting: state.isExecuting,
  currentExecutionId: state.currentExecutionId,
  currentIterationItem: state.currentIterationItem,
  currentIterationIndex: state.currentIterationIndex,
  currentGroupTotalItems: state.currentGroupTotalItems
})); 