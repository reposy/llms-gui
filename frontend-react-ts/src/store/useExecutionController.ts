import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { Edge, Node } from 'reactflow';
import { NodeData } from '../types/nodes';
import { NodeState } from '../types/execution';

import { executeFlow as executeFlowController, FlowControllerDependencies } from '../controller/flowController';
import { executeGroupNode } from '../controller/groupNodeController';

// Import from our refactored modules
import { getNodeState, setNodeState, resetNodeStates } from './useNodeStateStore';
import { getDownstreamNodes, getNodesInGroup } from './useNodeGraphUtils';
import { getNodeContent } from './useNodeContentStore';
import { useFlowStructureStore } from './useFlowStructureStore';

// Define the state structure for execution controller
export interface ExecutionControllerState {
  isExecuting: boolean;
  executingGroupIds: Set<string>;
  currentExecutionId?: string;
  currentIterationItem?: any;
  currentIterationIndex?: number;
  currentGroupTotalItems?: number;

  // Internal state setters
  _setIsExecuting: (isExecuting: boolean) => void;
  _setCurrentExecutionId: (executionId?: string) => void;
  _setIterationContext: (context: { item?: any; index?: number; total?: number }) => void;

  // Execution methods
  executeFlow: (startNodeId: string) => Promise<void>;
  executeFlowForGroup: (groupId: string) => Promise<void>;
}

// Create the Zustand store for execution controller
export const useExecutionController = create<ExecutionControllerState>()(
  devtools(
    (set, get) => ({
      isExecuting: false,
      executingGroupIds: new Set<string>(),
      currentExecutionId: undefined,
      currentIterationItem: undefined,
      currentIterationIndex: undefined,
      currentGroupTotalItems: undefined,

      // --- Internal State Setters --- 
      _setIsExecuting: (isExecuting) => set({ isExecuting }),
      _setCurrentExecutionId: (executionId) => set({ currentExecutionId: executionId }),
      _setIterationContext: ({ item, index, total }) => set({
        currentIterationItem: item,
        currentIterationIndex: index,
        currentGroupTotalItems: total
      }),

      // --- Flow Execution Actions ---
      executeFlow: async (startNodeId) => {
        const state = get(); // Get current state once
        console.log(`[ExecuteFlow Action] Triggered for node ${startNodeId}. Current isExecuting: ${state.isExecuting}, Executing Groups: ${[...state.executingGroupIds]}`);

        if (state.isExecuting) {
          console.warn(`[ExecuteFlow Action] Execution already in progress (ID: ${state.currentExecutionId}). Blocking request for node ${startNodeId}.`);
          return;
        }

        // Get nodes and edges from Zustand stores directly
        const getNodes = () => useFlowStructureStore.getState().nodes;
        const getEdges = () => useFlowStructureStore.getState().edges;

        // Construct dependencies directly 
        const dependencies: FlowControllerDependencies = {
          getNodes,
          getEdges,
          getNodeState,
          setNodeState,
          resetNodeStates,
          getDownstreamNodes,
          getNodesInGroup,
          setIsExecuting: state._setIsExecuting, // Pass internal setter
          setCurrentExecutionId: state._setCurrentExecutionId,
          setIterationContext: state._setIterationContext,
        };

        const executionId = `flow-run-${crypto.randomUUID()}`; // Generate specific ID here
        dependencies.setCurrentExecutionId(executionId); // Set ID via dependency setter
        dependencies.setIsExecuting(true); // Set true *before* await
        // Clear iteration context for non-group flows
        dependencies.setIterationContext({ item: undefined, index: undefined, total: undefined });

        console.log(`[ExecuteFlow Action] Starting flow from ${startNodeId} with execution ID: ${executionId}`);

        try {
          // Note: executeFlow controller function handles its own try/catch/finally including setIsExecuting(false)
          // Pass only startNodeId and dependencies
          await executeFlowController(startNodeId, dependencies); 
          console.log(`[ExecuteFlow Action] executeFlowController for ${startNodeId} (ID: ${executionId}) returned.`);
        } catch (error) {
          // Errors should ideally be caught within executeFlowController, but catch here as a backup
          console.error(`[ExecuteFlow Action] Uncaught error during executeFlowController for ${startNodeId} (ID: ${executionId}):`, error);
          // Ensure the flag is reset even if the controller's finally fails somehow
          dependencies.setIsExecuting(false);
          dependencies.setCurrentExecutionId(undefined); // Use undefined instead of null
        } finally {
          // Although executeFlowController has its own finally, we ensure reset here too in case of unexpected errors *calling* it.
          // However, avoid double-setting if the controller's finally already ran.
          // Check state directly using get() for the latest values in finally block
          const currentState = get(); 
          if (currentState.isExecuting && currentState.currentExecutionId === executionId) {
            console.log(`[ExecuteFlow Action] Backup finally for ${startNodeId} (ID: ${executionId}). Resetting state.`);
            // Use internal setters directly via get() in finally if needed
            currentState._setIsExecuting(false);
            currentState._setCurrentExecutionId(undefined); // Use undefined instead of null
          }
        }
      },

      executeFlowForGroup: async (groupId) => {
        const state = get(); // Get current state
        
        // Check if THIS specific group is already running
        if (state.executingGroupIds.has(groupId)) {
          console.warn(`[ExecuteFlowForGroup Action] Group ${groupId} execution already in progress. Blocking request.`);
          return;
        }

        // Add this group to the executing set
        set(prev => ({ executingGroupIds: new Set(prev.executingGroupIds).add(groupId) }));
        console.log(`[ExecuteFlowForGroup Action] Added ${groupId} to executing groups. Current: ${[...get().executingGroupIds]}`);

        // Get nodes and edges directly from Zustand store
        const getNodes = () => useFlowStructureStore.getState().nodes;
        const getEdges = () => useFlowStructureStore.getState().edges;

        // Dependencies for the group controller
        const dependencies = {
          getNodes,
          getEdges,
          getNodeState,
          setNodeState,
          resetNodeStates,
          getDownstreamNodes,
          getNodesInGroup,
          setCurrentExecutionId: state._setCurrentExecutionId, 
          setIterationContext: state._setIterationContext,
        };

        try {
          console.log(`[ExecuteFlowForGroup Action] Calling executeGroupNode for ${groupId}`);
          // Pass dependencies (casting might be needed if types don't perfectly align)
          await executeGroupNode(groupId, dependencies as FlowControllerDependencies);
          console.log(`[ExecuteFlowForGroup Action] executeGroupNode for ${groupId} returned.`);
        } catch (error) {
          console.error(`[ExecuteFlowForGroup Action] Uncaught error during executeGroupNode for ${groupId}:`, error);
        } finally {
          // Always remove the group from the executing set
          console.log(`[ExecuteFlowForGroup Action] Removing ${groupId} from executing groups.`);
          set(prev => {
            const newSet = new Set(prev.executingGroupIds);
            newSet.delete(groupId);
            console.log(`[ExecuteFlowForGroup Action] Updated executing groups: ${[...newSet]}`);
            return { executingGroupIds: newSet };
          });
          // Clear iteration context after group execution finishes or fails
          state._setIterationContext({ item: undefined, index: undefined, total: undefined });
        }
      },
    })
  )
);

// Hook to get overall execution state
export const useExecutionState = () => {
  return useExecutionController(state => ({
    isExecuting: state.isExecuting,
    executingGroupIds: state.executingGroupIds,
    currentIterationItem: state.currentIterationItem,
    currentIterationIndex: state.currentIterationIndex,
    currentGroupTotalItems: state.currentGroupTotalItems,
    currentExecutionId: state.currentExecutionId,
  }));
};

// Export actions directly for use outside components
export const { executeFlow, executeFlowForGroup } = useExecutionController.getState(); 