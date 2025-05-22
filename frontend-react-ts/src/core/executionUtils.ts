import { v4 as uuidv4 } from 'uuid';
import { FlowExecutionContext } from './FlowExecutionContext';
import { NodeFactory } from './NodeFactory';
import { registerAllNodeTypes } from './NodeRegistry';
import { useFlowStructureStore } from '../store/useFlowStructureStore';
import { getNodeContent } from '../store/useNodeContentStore';
import { Node } from './Node'; // Import Node base class for type hinting
import { LLMNodeContent } from '../types/nodes'; // For specific node data handling

/**
 * Prepares the FlowExecutionContext for a new execution run.
 * Fetches necessary data and creates the context instance.
 * 
 * @returns The prepared FlowExecutionContext instance.
 * @throws Error if required stores are not available.
 */
const prepareExecutionContext = (): FlowExecutionContext => {
  const executionId = `exec-${uuidv4()}`;
  
  // Fetch necessary data using Zustand's getState
  const flowStructureStore = useFlowStructureStore.getState();
  if (!flowStructureStore) {
    throw new Error("FlowStructureStore is not available.");
  }
  const { nodes, edges } = flowStructureStore;

  if (!getNodeContent) {
     throw new Error("getNodeContent function is not available.");
  }

  // Create and configure NodeFactory
  const nodeFactory = new NodeFactory();
  registerAllNodeTypes();

  // Create the context
  const context = new FlowExecutionContext(
    executionId, 
    getNodeContent, 
    nodes, 
    edges, 
    nodeFactory
  );

  console.log(`[ExecutionUtils] Prepared Execution Context (ID: ${executionId})`);
  return context;
};

/**
 * Internal function to start the process for a given set of nodes within a context.
 * Handles node instantiation, property setting, and process invocation.
 * 
 * @param startNodeIds Array of node IDs to start execution from.
 * @param triggerNodeId The ID of the node that initially triggered this execution flow.
 * @param context The FlowExecutionContext for this run.
 * @throws Error if node data or instance cannot be created.
 */
const _startExecutionProcess = async (
  startNodeIds: string[],
  triggerNodeId: string,
  context: FlowExecutionContext
): Promise<void> => {
  
  context.log(`Starting execution process for nodes: ${startNodeIds.join(', ')} (Trigger: ${triggerNodeId})`);
  context.setTriggerNode(triggerNodeId); // Set trigger node in context

  // Build execution graph (might be redundant if context creation implies this)
  // Consider if this needs to be done here or within context prep
  // Consider if this needs to be done here or within context prep
  
  for (const nodeId of startNodeIds) {
     // Skip if node has already been executed in this context 
    if (context.hasExecutedNode(nodeId)) {
      context.log(`Skipping already executed node: ${nodeId}`);
      continue;
    }

    const nodeStructure = context.nodes.find(n => n.id === nodeId);
    if (!nodeStructure || !nodeStructure.type) {
      context.log(`Node structure or type for ${nodeId} not found. Skipping.`);
      continue;
    }

    context.log(`Processing node: ${nodeId} (type: ${nodeStructure.type})`);

    try {
      // --- Special Data Preparation (Example for LLM) ---
      // TODO: Generalize this if other nodes need special data merging
      let combinedNodeData = { ...nodeStructure.data };
      if (nodeStructure.type === 'llm') {
         const nodeContent = context.getNodeContentFunc(nodeId, 'llm') as LLMNodeContent;
         if (nodeContent) {
            combinedNodeData = { ...combinedNodeData, ...nodeContent };
            context.log(`Combined data for LLM node ${nodeId}`);
         } else {
             context.log(`LLM node content for ${nodeId} not found, using structure data only.`);
         }
      }
      // --- End Special Data Preparation ---

      const nodeInstance: Node = context.nodeFactory.create(
        nodeId,
        nodeStructure.type,
        combinedNodeData, // Use potentially combined data
        context
      );

      // Attach additional properties (Consider if still needed as context holds them)
      // This might be useful for nodes needing direct access without context drilling
      nodeInstance.property = {
        ...nodeInstance.property,
        nodes: context.nodes,
        edges: context.edges,
        nodeFactory: context.nodeFactory,
        executionGraph 
      };

      // Mark running BEFORE process call
      context.markNodeRunning(nodeId);

      // Execute the node's process method
      await nodeInstance.process({}, context);

      // Mark executed AFTER successful process call
      context.markNodeExecuted(nodeId);
      context.log(`Completed execution for node: ${nodeId}`);

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        context.log(`Error executing node ${nodeId}: ${errorMessage}`);
        context.markNodeError(nodeId, errorMessage);
        // Decide if we should re-throw, stop execution, or continue with other start nodes
        // For now, log and continue.
    }
  }
   context.log(`Finished execution process for trigger: ${triggerNodeId}`);
};


/**
 * Runs the execution process for a single specified node.
 * Useful for "Run" buttons on individual nodes.
 * 
 * @param nodeId The ID of the node to execute.
 */
export const runSingleNodeExecution = async (nodeId: string): Promise<void> => {
  console.log(`[ExecutionUtils] Received request to run single node: ${nodeId}`);
  try {
    const context = prepareExecutionContext();
    await _startExecutionProcess([nodeId], nodeId, context);
  } catch (error) {
    console.error(`[ExecutionUtils] Failed to run single node execution for ${nodeId}:`, error);
    // Handle or surface the error appropriately, e.g., show a notification
    // For now, just log the error.
  }
};

/**
 * Runs the execution process for a specified group node.
 * The GroupNode's internal logic handles its sub-flow execution.
 * 
 * @param groupNodeId The ID of the group node to execute.
 * @throws Error if execution preparation or process fails.
 */
export const runGroupNodeExecution = async (groupNodeId: string): Promise<void> => {
  console.log(`[ExecutionUtils] Received request to run group node: ${groupNodeId}`);
  // No special callbacks needed here, caller (controller) will handle state via try/finally
  const context = prepareExecutionContext(); // Prepare context as usual
  // Start the process for the group node itself. Its execute method handles the internal flow.
  await _startExecutionProcess([groupNodeId], groupNodeId, context);
  console.log(`[ExecutionUtils] Completed group node execution process for: ${groupNodeId}`);
  // Note: Errors within _startExecutionProcess are logged but not re-thrown by default,
  // allowing the controller's finally block to run. 
  // If errors need to propagate, _startExecutionProcess should re-throw them.
};

/**
 * Runs the execution process for the entire flow.
 * Determines starting nodes (root nodes or a specific one) and initiates the process.
 * 
 * @param startNodeId Optional ID of a specific node to start execution from. If not provided, execution starts from all root nodes.
 * @param inputData Optional input data to pass to the start nodes' process method.
 * @throws Error if execution preparation or process fails.
 */
export const runFullFlowExecution = async (startNodeId?: string, inputData?: any): Promise<void> => {
  console.log(`[ExecutionUtils] Received request to run full flow ${startNodeId ? `from node ${startNodeId}`: 'from root nodes'}`);
  try {
    const context = prepareExecutionContext();
    
    // Determine the actual starting nodes
    let nodesToExecuteIds: string[] = [];
    let triggerId = 'root'; // Default trigger ID for full flow

    if (startNodeId) {
      // Ensure the start node exists
      if (context.nodes.some(node => node.id === startNodeId)) {
        nodesToExecuteIds = [startNodeId];
        triggerId = startNodeId; // Use the specific node as the trigger ID
      } else {
        context.log(`Start node ${startNodeId} not found in the flow. Aborting execution.`);
        // Throw error or return early? Throwing might be better for caller.
        throw new Error(`Start node ${startNodeId} not found.`);
      }
    } else {
      // Find root nodes if no specific start node is given
      // Need getRootNodeIds utility - should be moved or imported if defined elsewhere
      // Assuming getRootNodeIds exists and works with context.nodes/edges
      try {
        // Temporarily define or import getRootNodeIds here if not globally available
        const getRootNodeIds = (nodes: any[], edges: any[]): string[] => { 
            const nodeIds = new Set(nodes.map(n => n.id));
            const targetNodeIds = new Set(edges.map(e => e.target));
            return Array.from(nodeIds).filter(id => !targetNodeIds.has(id));
        };
        nodesToExecuteIds = getRootNodeIds(context.nodes, context.edges);
        if (nodesToExecuteIds.length === 0) {
          context.log('No root nodes found in the flow. Nothing to execute.');
          return; // Nothing to do
        }
      } catch (e) {
         console.error("[ExecutionUtils] Failed to get root nodes:", e);
         throw new Error("Failed to determine root nodes for execution.");
      }
    }
    
    context.log(`Determined starting nodes: ${nodesToExecuteIds.join(', ')}`);
    
    // Flow Editor 전용 실행 함수 사용
    const flowStructureStore = useFlowStructureStore.getState();
    const { nodes, edges } = flowStructureStore;
    
    // Flow Editor 전용 실행
    try {
      // 임시 flowId 생성 (Flow Editor에서는 flowId가 없음)
      const tempFlowId = `editor-flow-${uuidv4()}`;
      
      // Flow Data 구성
      const flowData = {
        id: tempFlowId,
        name: "Editor Flow",
        nodes: nodes,
        edges: edges,
        contents: {} as Record<string, any>
      };
      
      // 모든 노드의 컨텐츠 정보 수집
      nodes.forEach(node => {
        const content = getNodeContent(node.id);
        if (content) {
          flowData.contents[node.id] = content;
        }
      });
      
      // Flow Editor 전용 실행 함수 호출
      const { executeFlowEditor } = await import('../services/flowExecutionService');
      
      await executeFlowEditor({
        flowId: tempFlowId,
        flowJson: flowData,
        inputs: inputData || [],
        onComplete: (result) => {
          console.log(`[ExecutionUtils] Flow Editor execution completed with result:`, result);
        }
      });
      
      console.log(`[ExecutionUtils] Completed Editor flow execution process.`);
    } catch (error) {
      console.error(`[ExecutionUtils] Error during Flow Editor execution:`, error);
      throw error;
    }
  } catch (error) {
    console.error(`[ExecutionUtils] Failed to run full flow execution:`, error);
    // Re-throw the error so the caller (e.g., UI) can handle it
    throw error; 
  }
};

/**
 * 입력 데이터를 사용하여 노드 실행을 시작하는 함수
 * Flow Executor의 입력 데이터를 루트 노드에 전달하기 위해 사용
 */
const _executeWithInput = async (
  startNodeIds: string[],
  triggerNodeId: string,
  context: FlowExecutionContext,
  inputData: any
): Promise<void> => {
  context.log(`Starting execution with input data for nodes: ${startNodeIds.join(', ')} (Trigger: ${triggerNodeId})`);
  context.setTriggerNode(triggerNodeId);

  // Build execution graph
  // Consider if this needs to be done here or within context prep
  
  for (const nodeId of startNodeIds) {
    if (context.hasExecutedNode(nodeId)) {
      context.log(`Skipping already executed node: ${nodeId}`);
      continue;
    }

    const nodeStructure = context.nodes.find(n => n.id === nodeId);
    if (!nodeStructure || !nodeStructure.type) {
      context.log(`Node structure or type for ${nodeId} not found. Skipping.`);
      continue;
    }

    context.log(`Processing node: ${nodeId} (type: ${nodeStructure.type}) with input data`);

    try {
      // Special Data Preparation (similar to _startExecutionProcess)
      let combinedNodeData = { ...nodeStructure.data };
      if (nodeStructure.type === 'llm') {
         const nodeContent = context.getNodeContentFunc(nodeId, 'llm') as any;
         if (nodeContent) {
            combinedNodeData = { ...combinedNodeData, ...nodeContent };
            context.log(`Combined data for LLM node ${nodeId}`);
         } else {
             context.log(`LLM node content for ${nodeId} not found, using structure data only.`);
         }
      }

      const nodeInstance = context.nodeFactory.create(
        nodeId,
        nodeStructure.type,
        combinedNodeData,
        context
      );

      // Attach properties
      nodeInstance.property = {
        ...nodeInstance.property,
        nodes: context.nodes,
        edges: context.edges,
        nodeFactory: context.nodeFactory,
        executionGraph 
      };

      // Mark running BEFORE process call
      context.markNodeRunning(nodeId);

      // 중요한 차이점: 입력 데이터를 process 메소드에 전달
      await nodeInstance.process(inputData, context);

      // Mark executed AFTER successful process call
      context.markNodeExecuted(nodeId);
      context.log(`Completed execution for node: ${nodeId}`);

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        context.log(`Error executing node ${nodeId}: ${errorMessage}`);
        context.markNodeError(nodeId, errorMessage);
    }
  }
  context.log(`Finished execution process with input data for trigger: ${triggerNodeId}`);
}; 