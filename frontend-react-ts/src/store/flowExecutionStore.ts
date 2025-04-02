import { createWithEqualityFn } from 'zustand/traditional';
import { Edge, Node } from 'reactflow';
import { APINodeData, LLMNodeData, OutputNodeData, LLMResult, GroupNodeData, NodeData, JSONExtractorNodeData, InputNodeData, ConditionalNodeData, ConditionType, MergerNodeData } from '../types/nodes';
import axios from 'axios';
import { store } from './store';
import { RootState } from './store';
import { devtools, persist } from 'zustand/middleware';
import { resolveTemplate } from '../utils/flowUtils';
import { getIncomers, getOutgoers } from 'reactflow';
import jsonpath from 'jsonpath';
import { isEqual, debounce } from 'lodash';

import { NodeState, defaultNodeState } from '../types/execution'; // Correct import path
import { isNodeRoot as isNodeRootUtil } from '../utils/executionUtils'; // Correct import path & alias for one util
import { executeFlow as executeFlowController, FlowControllerDependencies } from '../controller/flowController'; // Correct import path & added type import
import { executeGroupNode } from '../controller/groupNodeController'; // Correct import path

// Export the interface
export interface GroupExecutionItemResult {
  item: any; // The input item
  nodeResults: Record<string, any>; // Results of each node within the group for this item { nodeId: result }
  finalOutput: any; // Final output(s) of the group for this item (e.g., from leaf node)
  conditionalBranch?: 'true' | 'false'; // Branch taken if a conditional node was present
  status: 'success' | 'error';
  error?: string;
}

// Export the interface
export interface FlowExecutionState {
  nodeStates: Record<string, NodeState>;
  edges: Edge[];
  nodes: Node<NodeData>[];
  setEdges: (edges: Edge[]) => void;
  setNodes: (nodes: Node<NodeData>[]) => void;
  isExecuting: boolean;
  currentExecutionId?: string; // Track current execution context
  
  // Iteration context (optional)
  currentIterationItem?: any;
  currentIterationIndex?: number;
  currentGroupTotalItems?: number;
  
  // Node state management
  getNodeState: (nodeId: string) => NodeState | undefined;
  setNodeState: (nodeId: string, state: Partial<NodeState>) => void;
  resetNodeStates: (nodeIds?: string[]) => void;
  
  // Node relationship helpers
  isNodeRoot: (nodeId: string) => boolean;
  getRootNodes: (subsetNodeIds?: Set<string>) => string[];
  getDownstreamNodes: (nodeId: string, includeStartNode?: boolean, subsetNodeIds?: Set<string>) => string[];
  getUpstreamNodes: (nodeId: string, subsetNodeIds?: Set<string>) => string[];
  getNodesInGroup: (groupId: string) => Node<NodeData>[];
  
  // Execution methods
  executeNode: (nodeId: string, executionContext: ExecutionContext) => Promise<any>;
  executeFlow: (startNodeId: string) => Promise<void>;
  _executeSubgraph: (startNodes: string[], nodesInSubgraph: Node<NodeData>[], edgesInSubgraph: Edge[], executionContext: ExecutionContext) => Promise<Record<string, any>>;
  executeFlowForGroup: (groupId: string) => Promise<void>;
}

const extractValue = (obj: any, path: string): any => {
  try {
    if (!path) return obj;
    // Basic safety check for stringified JSON
    let dataToParse = obj;
    if (typeof obj === 'string') {
      try {
        dataToParse = JSON.parse(obj);
      } catch (e) {
        // If it's not valid JSON string, treat it as a plain string
        // Path extraction on plain strings might not be meaningful beyond the root
        return path === '.' ? obj : undefined;
      }
    }
    // Use jsonpath for more robust path extraction
    const results = jsonpath.query(dataToParse, path);
    // Return the first result, or undefined if no match
    return results.length > 0 ? results[0] : undefined;

  } catch (error) {
    console.error('Error extracting value:', error);
    // Return undefined instead of throwing, let conditional node handle it
    return undefined;
  }
};

// Evaluate condition based on type
const evaluateCondition = (inputType: ConditionType, inputValue: any, conditionValue: string): boolean => {
  try {
    switch (inputType) {
      case 'contains':
        // Allow checking numbers converted to strings
        return String(inputValue).includes(conditionValue);
      case 'greater_than': {
        const numInput = parseFloat(inputValue);
        const numCondition = parseFloat(conditionValue);
        return !isNaN(numInput) && !isNaN(numCondition) && numInput > numCondition;
      }
      case 'less_than': {
        const numInput = parseFloat(inputValue);
        const numCondition = parseFloat(conditionValue);
        return !isNaN(numInput) && !isNaN(numCondition) && numInput < numCondition;
      }
      case 'equal_to': {
         // Attempt numeric comparison first, fallback to string comparison
        const numInput = parseFloat(inputValue);
        const numCondition = parseFloat(conditionValue);
        if (!isNaN(numInput) && !isNaN(numCondition)) {
          return numInput === numCondition;
        } else {
          return String(inputValue) === conditionValue;
        }
      }
      case 'json_path':
        // For json_path, the conditionValue IS the path, and we just check existence/truthiness
        // Extraction happens before this function call
        // We check if the extracted value is truthy
        return !!inputValue; // Check if the extracted value is truthy
      default:
        return false;
    }
  } catch (e) {
    console.error("Condition evaluation error:", e);
    return false;
  }
};

interface ExecutionContext {
  isSubExecution?: boolean;
  triggerNodeId: string;
  executionId: string;
  iterationItem?: any;
}

// Define the state structure for the Zustand store
export interface FlowExecutionStoreState {
  nodeStates: Record<string, NodeState>;
  isExecuting: boolean;
  executingGroupIds: Set<string>;
  currentExecutionId?: string; // Track current execution context
  currentIterationItem?: any;
  currentIterationIndex?: number;
  currentGroupTotalItems?: number;

  // State Management Actions
  getNodeState: (nodeId: string) => NodeState;
  setNodeState: (nodeId: string, state: Partial<NodeState>) => void;
  resetNodeStates: (nodeIds?: string[]) => void;

  // Helper functions related to node graph structure (can potentially move to utils too)
  isNodeRoot: (nodeId: string) => boolean;
  getRootNodes: (subsetNodeIds?: Set<string>) => string[];
  getDownstreamNodes: (nodeId: string, includeStartNode?: boolean, subsetNodeIds?: Set<string>) => string[];
  getUpstreamNodes: (nodeId: string, subsetNodeIds?: Set<string>) => string[];
  getNodesInGroup: (groupId: string) => Node<NodeData>[];

  // --- Flow Execution Actions (will call controller functions) ---
  executeFlow: (startNodeId: string) => Promise<void>;
  executeFlowForGroup: (groupId: string) => Promise<void>;

  // Internal state setters used by the controller
  _setIsExecuting: (isExecuting: boolean) => void;
  _setCurrentExecutionId: (executionId?: string) => void;
  _setIterationContext: (context: { item?: any; index?: number; total?: number }) => void;
}

// Create the Zustand store
export const useFlowExecutionStore = createWithEqualityFn<FlowExecutionStoreState>()(
  devtools(
    persist(
      (set, get) => ({
        nodeStates: {},
        isExecuting: false,
        executingGroupIds: new Set<string>(),
        currentExecutionId: undefined,
        currentIterationItem: undefined,
        currentIterationIndex: undefined,
        currentGroupTotalItems: undefined,

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

        // --- Graph Structure Helpers --- (Using Redux state directly)
        isNodeRoot: (nodeId) => {
          const { nodes, edges } = store.getState().flow;
          // Use the imported utility function
          return isNodeRootUtil(nodeId, nodes, edges);
        },

  getRootNodes: (subsetNodeIds?: Set<string>) => {
          // Removed usage of getRootNodesFromSubsetUtil per refactoring instructions.
          return [];
        },

        getDownstreamNodes: (nodeId, includeStartNode = false, subsetNodeIds?: Set<string>) => {
          const { nodes, edges } = store.getState().flow;
          const downstream = new Set<string>();
          const queue: string[] = [nodeId];
          const visited = new Set<string>();

          const relevantNodes = subsetNodeIds
            ? nodes.filter(n => subsetNodeIds.has(n.id))
            : nodes;
          const relevantEdges = subsetNodeIds
            ? edges.filter(e => subsetNodeIds.has(e.source) && subsetNodeIds.has(e.target))
            : edges;
          
          const relevantNodeIds = new Set(relevantNodes.map(n => n.id));

          while (queue.length > 0) {
            const current = queue.shift()!;
            if (visited.has(current) || !relevantNodeIds.has(current)) continue; // Ensure node is relevant
            visited.add(current);

            if (current !== nodeId || includeStartNode) {
              downstream.add(current);
            }

            const children = relevantEdges
              .filter(edge => edge.source === current)
              .map(edge => edge.target);

            children.forEach(childId => {
              if (!visited.has(childId) && relevantNodeIds.has(childId)) {
                queue.push(childId);
              }
            });
          }
          return Array.from(downstream);
        },

        getUpstreamNodes: (nodeId, subsetNodeIds?: Set<string>) => {
          const { nodes, edges } = store.getState().flow;
          const upstream = new Set<string>();
          const queue: string[] = [nodeId];
          const visited = new Set<string>();

          const relevantNodes = subsetNodeIds
            ? nodes.filter(n => subsetNodeIds.has(n.id))
            : nodes;
          const relevantEdges = subsetNodeIds
            ? edges.filter(e => subsetNodeIds.has(e.source) && subsetNodeIds.has(e.target))
            : edges;
            
          const relevantNodeIds = new Set(relevantNodes.map(n => n.id));

          while (queue.length > 0) {
            const current = queue.shift()!;
            if (visited.has(current) || !relevantNodeIds.has(current)) continue; // Ensure node is relevant
            visited.add(current);

            if (current !== nodeId) {
              upstream.add(current);
            }

            const parents = relevantEdges
              .filter(edge => edge.target === current)
              .map(edge => edge.source);

            parents.forEach(parentId => {
              if (!visited.has(parentId) && relevantNodeIds.has(parentId)) {
                queue.push(parentId);
              }
            });
          }
          return Array.from(upstream);
        },

        getNodesInGroup: (groupId) => {
          const { nodes } = store.getState().flow;
          return nodes.filter(node => node.parentNode === groupId);
        },

        // --- Flow Execution Actions (Call Controller / Executor) ---
        executeFlow: async (startNodeId) => {
           const state = get(); // Get current state once
           // Log the current state *before* the check
           console.log(`[ExecuteFlow Action] Triggered for node ${startNodeId}. Current isExecuting: ${state.isExecuting}, Executing Groups: ${[...state.executingGroupIds]}`);

           if (state.isExecuting) {
              // ✅ Enhanced Logging: Include the blocking execution ID
              console.warn(`[ExecuteFlow Action] Execution already in progress (ID: ${state.currentExecutionId}). Blocking request for node ${startNodeId}.`);
               return;
            }

           // Construct dependencies directly 
           const dependencies: FlowControllerDependencies = {
              getNodes: () => store.getState().flow.nodes,
              getEdges: () => store.getState().flow.edges,
              getNodeState: state.getNodeState,
              setNodeState: state.setNodeState,
              resetNodeStates: state.resetNodeStates,
              getDownstreamNodes: state.getDownstreamNodes,
              getNodesInGroup: state.getNodesInGroup,
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

            // Optional: Check if a non-group flow is running (uncomment to block group if main flow runs)
            // if (state.isExecuting) {
            //    console.warn(`[ExecuteFlowForGroup Action] Non-group execution in progress (ID: ${state.currentExecutionId}). Blocking group ${groupId}.`);
            //    return;
            // }

            // Add this group to the executing set
            set(prev => ({ executingGroupIds: new Set(prev.executingGroupIds).add(groupId) }));
            console.log(`[ExecuteFlowForGroup Action] Added ${groupId} to executing groups. Current: ${[...get().executingGroupIds]}`);

            // Dependencies for the group controller (setIsExecuting is removed)
            // Assuming FlowControllerDependencies has setIsExecuting as optional
            const dependencies = {
                 getNodes: () => store.getState().flow.nodes,
                 getEdges: () => store.getState().flow.edges,
                 getNodeState: state.getNodeState,
                 setNodeState: state.setNodeState,
                 resetNodeStates: state.resetNodeStates,
                 getDownstreamNodes: state.getDownstreamNodes,
                 getNodesInGroup: state.getNodesInGroup,
                 // setIsExecuting removed
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

        // --- Internal State Setters --- (Used by Controller via dependencies)
        _setIsExecuting: (isExecuting) => set({ isExecuting }),
        _setCurrentExecutionId: (executionId) => set({ currentExecutionId: executionId }),
        _setIterationContext: (context) => set({
            currentIterationItem: context.item,
            currentIterationIndex: context.index,
            currentGroupTotalItems: context.total,
        }),

      }),
      {
        name: 'flow-execution-storage',
        // Specify properties to persist, potentially excluding volatile state like isExecuting
        partialize: (state) => ({
          nodeStates: state.nodeStates, // Only persist node states?
          // Maybe persist execution ID if needed across reloads?
          // currentExecutionId: state.currentExecutionId
        }),
      }
    )
  )
);

// --- Hooks for Component Usage --- 

// Hook to get the state of a specific node
export const useNodeState = (nodeId: string): NodeState => {
  return useFlowExecutionStore(
    state => state.nodeStates[nodeId] || defaultNodeState,
    // Use lodash isEqual for deep comparison to prevent unnecessary re-renders
    // unless the state object identity or its contents actually change.
    isEqual 
  );
};

// Hook to check if a node is a root node (consider moving this to a component-level selector if not used widely)
export const useIsRootNode = (nodeId: string): boolean => {
  // Directly call the helper from the store state which accesses Redux state internally
  return useFlowExecutionStore.getState().isNodeRoot(nodeId);
};

// Hook to get overall execution state (isExecuting, iteration progress)
export const useExecutionState = () => {
  return useFlowExecutionStore(state => ({
    isExecuting: state.isExecuting,
    executingGroupIds: state.executingGroupIds,
    currentIterationItem: state.currentIterationItem,
    currentIterationIndex: state.currentIterationIndex,
    currentGroupTotalItems: state.currentGroupTotalItems,
    currentExecutionId: state.currentExecutionId,
  }));
};

// Export actions directly for use outside components (e.g., triggering execution from buttons)
export const { executeFlow, executeFlowForGroup, setNodeState, resetNodeStates } = useFlowExecutionStore.getState();

// Initialize store (optional - e.g., subscribe to Redux changes if needed, but direct access via store.getState() is often simpler)
export const initializeExecutionStore = () => {
  console.log("Flow Execution Store Initialized (with group execution tracking).");
  // Example: Subscribe to Redux state changes if necessary
  // store.subscribe(() => {
  //   const { nodes, edges } = store.getState().flow;
  //   // Potentially update Zustand store if needed based on Redux changes,
  //   // though accessing directly in helpers might be sufficient.
  // });
}; 