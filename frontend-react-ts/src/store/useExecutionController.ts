import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { Edge, Node } from 'reactflow';
import { NodeData } from '../types/nodes';
import { NodeState, ExecutionContext } from '../types/execution';
import { FlowExecutionContext } from '../core/FlowExecutionContext';
import { NodeFactory } from '../core/NodeFactory';
import { registerAllNodeTypes } from '../core/NodeRegistry';
import { buildExecutionGraphFromFlow, getExecutionGraph } from './useExecutionGraphStore';
import { v4 as uuidv4 } from 'uuid';
import { useFlowStructureStore } from './useFlowStructureStore';

// Define the state structure for execution controller (simplified)
export interface ExecutionControllerState {
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

// Create the Zustand store for execution controller
export const useExecutionController = create<ExecutionControllerState>()(
  devtools(
    (set, get) => ({
      isExecuting: false,
      currentExecutionId: undefined,
      currentIterationItem: undefined,
      currentIterationIndex: undefined,
      currentGroupTotalItems: undefined,

      // Public actions
      executeFlowForGroup: async (groupNodeId: string) => {
        try {
          const executionId = `exec-${uuidv4()}`;
          set({ 
            isExecuting: true,
            currentExecutionId: executionId,
            currentIterationIndex: undefined,
            currentIterationItem: undefined,
            currentGroupTotalItems: undefined
          });

          // Create execution context
          const executionContext = new FlowExecutionContext(executionId);
          
          // Set trigger node
          executionContext.setTriggerNode(groupNodeId);
          
          console.log(`[ExecutionController] Starting execution for group node ${groupNodeId}`);
          
          // Get flow structure
          const { nodes, edges } = useFlowStructureStore.getState();
          
          // Build execution graph
          buildExecutionGraphFromFlow(nodes, edges);
          const executionGraph = getExecutionGraph();
          
          // Create node factory
          const nodeFactory = new NodeFactory();
          registerAllNodeTypes(nodeFactory);
          
          // Find the node data
          const node = nodes.find(n => n.id === groupNodeId);
          if (!node) {
            console.error(`[ExecutionController] Group node ${groupNodeId} not found.`);
            set({ isExecuting: false });
            return;
          }
          
          // Create the node instance
          const nodeInstance = nodeFactory.create(
            groupNodeId,
            node.type as string,
            node.data,
            executionContext
          );
          
          // Attach graph structure reference to the node property
          nodeInstance.property = {
            ...nodeInstance.property,
            nodes,
            edges,
            nodeFactory,
            executionGraph
          };
          
          // Execute the node
          await nodeInstance.process({});
          
          set({ isExecuting: false });
        } catch (error) {
          console.error(`[ExecutionController] Error executing group ${groupNodeId}:`, error);
          set({ isExecuting: false });
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

// Export a selector to access the execution state
export const useExecutionState = () => useExecutionController(state => ({
  isExecuting: state.isExecuting,
  currentExecutionId: state.currentExecutionId,
  currentIterationItem: state.currentIterationItem,
  currentIterationIndex: state.currentIterationIndex,
  currentGroupTotalItems: state.currentGroupTotalItems
}));