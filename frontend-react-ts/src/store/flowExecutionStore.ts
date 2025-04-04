import { Edge, Node } from 'reactflow';
import { NodeData } from '../types/nodes';
import { NodeState, GroupExecutionItemResult, defaultNodeState } from '../types/execution';

// Import from our refactored modules
import { 
  useNodeStateStore, 
  useNodeState as useNodeStateInternal, 
  setNodeState, 
  resetNodeStates 
} from './useNodeStateStore';

import {
  useNodeGraphUtils,
  useIsRootNode as useIsRootNodeInternal,
  getRootNodes,
  getDownstreamNodes,
  getUpstreamNodes,
  getNodesInGroup,
  isNodeRoot
} from './useNodeGraphUtils';

import {
  useExecutionController,
  useExecutionState as useExecutionStateInternal,
  executeFlow,
  executeFlowForGroup
} from './useExecutionController';

// Re-export the interfaces for backwards compatibility
export interface ExecutionContext {
  isSubExecution?: boolean;
  triggerNodeId: string;
  executionId: string;
  iterationItem?: any;
}

// Re-export the GroupExecutionItemResult
export { GroupExecutionItemResult };

// Define the combined state interface for backwards compatibility
export interface FlowExecutionState {
  nodeStates: Record<string, NodeState>;
  edges: Edge[];
  nodes: Node<NodeData>[];
  setEdges: (edges: Edge[]) => void;
  setNodes: (nodes: Node<NodeData>[]) => void;
  isExecuting: boolean;
  currentExecutionId?: string;
  
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

// Define the minimum required state to maintain compatibility with existing code
export interface FlowExecutionStoreState {
  nodeStates: Record<string, NodeState>;
  isExecuting: boolean;
  executingGroupIds: Set<string>;
  currentExecutionId?: string; 
  currentIterationItem?: any;
  currentIterationIndex?: number;
  currentGroupTotalItems?: number;

  // State Management Actions
  getNodeState: (nodeId: string) => NodeState;
  setNodeState: (nodeId: string, state: Partial<NodeState>) => void;
  resetNodeStates: (nodeIds?: string[]) => void;

  // Helper functions related to node graph structure
  isNodeRoot: (nodeId: string) => boolean;
  getRootNodes: (subsetNodeIds?: Set<string>) => string[];
  getDownstreamNodes: (nodeId: string, includeStartNode?: boolean, subsetNodeIds?: Set<string>) => string[];
  getUpstreamNodes: (nodeId: string, subsetNodeIds?: Set<string>) => string[];
  getNodesInGroup: (groupId: string) => Node<NodeData>[];

  // Flow Execution Actions
  executeFlow: (startNodeId: string) => Promise<void>;
  executeFlowForGroup: (groupId: string) => Promise<void>;

  // Internal state setters used by the controller
  _setIsExecuting: (isExecuting: boolean) => void;
  _setCurrentExecutionId: (executionId?: string) => void;
  _setIterationContext: (context: { item?: any; index?: number; total?: number }) => void;
}

// Re-export the useFlowExecutionStore as a combination of the individual stores
export const useFlowExecutionStore = {
  getState: () => {
    const nodeStateStore = useNodeStateStore.getState();
    const nodeGraphUtils = useNodeGraphUtils.getState();
    const executionController = useExecutionController.getState();
    
    return {
      // Node state management
      nodeStates: nodeStateStore.nodeStates,
      getNodeState: nodeStateStore.getNodeState,
      setNodeState: nodeStateStore.setNodeState,
      resetNodeStates: nodeStateStore.resetNodeStates,
      
      // Node graph utilities
      isNodeRoot: nodeGraphUtils.isNodeRoot,
      getRootNodes: nodeGraphUtils.getRootNodes,
      getDownstreamNodes: nodeGraphUtils.getDownstreamNodes,
      getUpstreamNodes: nodeGraphUtils.getUpstreamNodes,
      getNodesInGroup: nodeGraphUtils.getNodesInGroup,
      
      // Execution controller
      isExecuting: executionController.isExecuting,
      executingGroupIds: executionController.executingGroupIds,
      currentExecutionId: executionController.currentExecutionId,
      currentIterationItem: executionController.currentIterationItem,
      currentIterationIndex: executionController.currentIterationIndex,
      currentGroupTotalItems: executionController.currentGroupTotalItems,
      executeFlow: executionController.executeFlow,
      executeFlowForGroup: executionController.executeFlowForGroup,
      _setIsExecuting: executionController._setIsExecuting,
      _setCurrentExecutionId: executionController._setCurrentExecutionId,
      _setIterationContext: executionController._setIterationContext,
    };
  }
};

// Re-export hooks with the same interface as before
export const useNodeState = useNodeStateInternal;
export const useIsRootNode = useIsRootNodeInternal;
export const useExecutionState = useExecutionStateInternal;

// Re-export actions for backwards compatibility
export { executeFlow, executeFlowForGroup, setNodeState, resetNodeStates };

// Initialize store for backwards compatibility
export const initializeExecutionStore = () => {
  console.log("Flow Execution Store Initialized (refactored version with modular stores).");
};