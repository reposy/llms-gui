import { create } from 'zustand';
import { Edge, Node } from 'reactflow';
import { APINodeData, LLMNodeData, OutputNodeData, LLMResult, GroupNodeData, NodeData, JSONExtractorNodeData, InputNodeData, ConditionalNodeData, ConditionType } from '../types/nodes';
import axios from 'axios';
import { store } from './store';
import { useSelector } from 'react-redux';
import React from 'react';
import { RootState } from './store';
import { devtools, persist } from 'zustand/middleware';
import { resolveTemplate } from '../utils/flowUtils';
import { getIncomers, getOutgoers } from 'reactflow';
import jsonpath from 'jsonpath';
import { updateNodeData } from './flowSlice';

interface NodeState {
  status: 'idle' | 'running' | 'success' | 'error';
  result: any; // This will hold GroupExecutionItemResult[] for groups
  error: string | undefined;
  _lastUpdate: number;
}

// Export the interface for use in components
export interface GroupExecutionItemResult {
  item: any; // The input item
  nodeResults: Record<string, any>; // Results of each node within the group for this item { nodeId: result }
  finalOutput: any; // Final output(s) of the group for this item (e.g., from leaf node)
  conditionalBranch?: 'true' | 'false'; // Branch taken if a conditional node was present
  status: 'success' | 'error';
  error?: string;
}

interface FlowExecutionState {
  nodeStates: Record<string, NodeState>;
  edges: Edge[];
  nodes: Node<NodeData>[];
  setEdges: (edges: Edge[]) => void;
  setNodes: (nodes: Node<NodeData>[]) => void;
  isExecuting: boolean;
  
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
  getDownstreamNodes: (nodeId: string, subsetNodeIds?: Set<string>) => string[];
  getUpstreamNodes: (nodeId: string, subsetNodeIds?: Set<string>) => string[];
  getNodesInGroup: (groupId: string) => Node<NodeData>[];
  
  // Execution methods
  executeNode: (nodeId: string, executionContext?: { isSubExecution?: boolean }) => Promise<any>;
  executeFlow: (startNodeId: string) => Promise<void>;
  _executeSubgraph: (startNodes: string[], nodesInSubgraph: Node<NodeData>[], edgesInSubgraph: Edge[]) => Promise<Record<string, any>>;
  executeFlowForGroup: (groupId: string) => Promise<void>;
}

const defaultNodeState: NodeState = {
  status: 'idle',
  result: null,
  error: undefined,
  _lastUpdate: 0
};

// Helper to check if a node is a root node
const isNodeRoot = (nodeId: string, edges: Edge[]): boolean => {
  return !edges.some(edge => edge.target === nodeId);
};

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
        return typeof inputValue === 'string' && inputValue.includes(conditionValue);
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

// Correct middleware nesting: create(devtools(persist(creator, persistOptions), devtoolsOptions))
export const useFlowExecutionStore = create<FlowExecutionState>()(
  devtools(
    persist(
      (set, get) => ({
        nodeStates: {},
        edges: [],
        nodes: [],
        isExecuting: false,
        currentIterationItem: undefined,
        currentIterationIndex: undefined,
        currentGroupTotalItems: undefined,
        
        setEdges: (edges) => {
          set({ edges });
        },

        setNodes: (nodes) => {
          set({ nodes });
        },

        getNodeState: (nodeId) => {
          return get().nodeStates[nodeId] || { ...defaultNodeState };
        },

        setNodeState: (nodeId, state) => {
          set(prev => {
            const currentState = prev.nodeStates[nodeId] || defaultNodeState;
            // Ensure we don't overwrite result with null if only updating status
            const newResult = state.result === undefined ? currentState.result : state.result;
            const newState = {
              ...prev.nodeStates,
              [nodeId]: {
                ...currentState,
                ...state,
                result: newResult, // Preserve result if not explicitly updated
                _lastUpdate: Date.now()
              }
            };
            return { nodeStates: newState };
          });
        },

        resetNodeStates: (nodeIds?: string[]) => {
          if (nodeIds && nodeIds.length > 0) {
            set(prev => {
              const newNodeStates = { ...prev.nodeStates };
              nodeIds.forEach(id => {
                delete newNodeStates[id]; 
              });
              return { nodeStates: newNodeStates };
            });
          } else {
            set({ nodeStates: {} }); 
          }
        },

        isNodeRoot: (nodeId) => {
          const { edges } = get();
          return isNodeRoot(nodeId, edges);
        },

        getRootNodes: (subsetNodeIds) => {
          const { nodes, edges } = get();
          const targetNodes = subsetNodeIds ? nodes.filter(n => subsetNodeIds.has(n.id)) : nodes;
          const targetEdges = subsetNodeIds 
            ? edges.filter(e => subsetNodeIds.has(e.source) && subsetNodeIds.has(e.target)) 
            : edges;
          
          return targetNodes
            .filter(node => !targetEdges.some(edge => edge.target === node.id))
            .map(node => node.id);
        },

        getDownstreamNodes: (nodeId, subsetNodeIds) => {
          const { nodes, edges } = get();
          const relevantEdges = subsetNodeIds
            ? edges.filter(e => subsetNodeIds.has(e.source) && subsetNodeIds.has(e.target))
            : edges;
          const directSuccessors = relevantEdges.filter(edge => edge.source === nodeId).map(edge => edge.target);
          
          // If subsetNodeIds is provided, ensure successors are within the subset
          return subsetNodeIds 
            ? directSuccessors.filter(id => subsetNodeIds.has(id)) 
            : directSuccessors;
        },

        getUpstreamNodes: (nodeId, subsetNodeIds) => {
          const { nodes, edges } = get();
          const relevantEdges = subsetNodeIds
            ? edges.filter(e => subsetNodeIds.has(e.source) && subsetNodeIds.has(e.target))
            : edges;
           
          const directPredecessors = relevantEdges.filter(edge => edge.target === nodeId).map(edge => edge.source);
          
          // If subsetNodeIds is provided, ensure predecessors are within the subset
          return subsetNodeIds 
            ? directPredecessors.filter(id => subsetNodeIds.has(id)) 
            : directPredecessors;
        },
        
        getNodesInGroup: (groupId) => {
            const { nodes } = get();
            return nodes.filter(n => n.parentNode === groupId);
        },

        executeNode: async (nodeId: string, executionContext = { isSubExecution: false }): Promise<any> => {
          const { 
            nodes, edges, setNodeState, getNodeState, 
            currentIterationItem, currentIterationIndex, _executeSubgraph
          } = get();
          const node = nodes.find(n => n.id === nodeId);
          if (!node) {
            console.error(`Node not found: ${nodeId}`);
            throw new Error(`Node not found: ${nodeId}`);
          }

          // --- Check Cache --- 
          const currentState = getNodeState(nodeId);
          // If not a sub-execution (like inside a group) and already succeeded, return cache
          if (!executionContext.isSubExecution && currentState?.status === 'success') {
            console.log(`Node ${nodeId}: Already successfully executed, returning cached result.`);
            return currentState.result;
          }
          // If currently running (could be recursive call or parallel execution attempt)
          if (currentState?.status === 'running') {
             console.warn(`Node ${nodeId}: Already running.`);
             // TODO: Implement more robust handling for concurrency/recursion if needed
             // For now, wait a short period and re-check, or return null/error
             await new Promise(resolve => setTimeout(resolve, 100)); // Simple wait
             const stateAfterWait = getNodeState(nodeId);
             if(stateAfterWait?.status === 'success') return stateAfterWait.result;
             else throw new Error(`Node ${nodeId} is still running after wait.`);
          }

          // Set running state
          setNodeState(nodeId, { status: 'running', result: null, error: undefined });

          // --- Get Input Data --- 
          let inputData: Record<string, any> = {};
          // If inside an iterating group, the primary input is the item
          if (node.parentNode && currentIterationItem !== undefined) {
            // Check if this node is directly connected to the group's implicit input
            // For simplicity, assume nodes inside a group primarily use the 'item' 
            // or results from other nodes *within the same iteration*
            inputData['item'] = currentIterationItem; 
            
            // Additionally, gather results from *internal* parent nodes within the group
            const groupNodes = get().getNodesInGroup(node.parentNode);
            const groupNodeIds = new Set(groupNodes.map(n => n.id));
            const internalParentEdges = edges.filter(e => e.target === nodeId && groupNodeIds.has(e.source));

            for (const edge of internalParentEdges) {
                const parentState = getNodeState(edge.source);
                if (parentState?.status === 'success') {
                    inputData[edge.targetHandle || edge.source] = parentState.result;
                } else {
                    // This case should ideally be handled by sequential execution within the group
                    console.warn(`Node ${nodeId}: Internal parent ${edge.source} hasn't succeeded yet.`);
                    // We might need to await parent execution here if the order isn't guaranteed
                    // For now, assume sequential execution handles this.
                }
            }
            
          } else {
            // Standard execution: Get results from all connected parent nodes
            const parentEdges = edges.filter(e => e.target === nodeId);
            for (const edge of parentEdges) {
              try {
                const parentState = getNodeState(edge.source);
                let parentResult = parentState?.result;
                if (parentState?.status !== 'success') {
                    console.log(`Node ${nodeId}: Triggering parent ${edge.source}`);
                    parentResult = await get().executeNode(edge.source);
                }
                const inputKey = edge.targetHandle || edge.source;
                inputData[inputKey] = parentResult;
                console.log(`Node ${nodeId}: Received input on handle '${inputKey}' from ${edge.source}`, parentResult);
              } catch (error: any) {
                console.error(`Node ${nodeId}: Error executing parent ${edge.source}:`, error);
                const errorMessage = `Parent ${edge.source} failed: ${error.message}`;
                setNodeState(nodeId, { status: 'error', result: null, error: errorMessage });
                throw new Error(errorMessage);
              }
            }
          }
          
          // --- Execute Node Logic --- 
          let result: any = null;
          try {
            switch (node.type) {
              case 'input':
                const inputNodeData = node.data as InputNodeData;
                result = inputNodeData.inputType === 'list' || inputNodeData.inputType === 'file' 
                         ? inputNodeData.items 
                         : inputNodeData.text;
                break;
              
              case 'llm':
                const llmData = node.data as LLMNodeData;
                // Input data is not directly used in the Ollama request body itself,
                // but it might have been used to construct the prompt via templating.
                
                // *** TEMPLATING LOGIC ***
                let finalPrompt = llmData.prompt;
                if (currentIterationItem !== undefined) {
                    finalPrompt = resolveTemplate(llmData.prompt, { item: currentIterationItem });
                }
                // TODO: Extend templating to use other inputs if needed

                // *** INPUT VALIDATION ***
                if (!finalPrompt || typeof finalPrompt !== 'string' || finalPrompt.trim() === '') {
                  throw new Error('LLM prompt is empty or invalid after templating.');
                }

                // Log the final prompt being used
                console.log(`[LLM Node ${nodeId}] Final Prompt:`, JSON.stringify(finalPrompt));

                console.log(`Node ${nodeId} (LLM): Executing with prompt: "${finalPrompt.substring(0, 100)}..."`);
                
                let requestBody: any;
                let apiUrl: string; // Declare apiUrl type

                if (llmData.provider === 'ollama') {
                   // *** BYPASS PROXY FOR OLLAMA ***
                   // Use direct URL since proxy seems to cause issues (500 error, content-type mismatch)
                   apiUrl = 'http://localhost:11434/api/generate'; 
                   requestBody = {
                     model: llmData.model,
                     prompt: finalPrompt,
                     stream: false, 
                     options: { 
                        temperature: llmData.temperature
                     }
                   };
                   // Log the request body being sent
                   console.log(`[LLM Node ${nodeId}] Request Body to ${apiUrl}:`, JSON.stringify(requestBody, null, 2));
                   // Note: ollamaUrl from node data is not used when using the proxy
                } else if (llmData.provider === 'openai') {
                   // TODO: Implement request body for OpenAI provider if needed
                   // apiUrl = '/api/openai'; // Example: different proxy/endpoint
                   requestBody = { 
                      model: llmData.model, 
                      prompt: finalPrompt, 
                      temperature: llmData.temperature,
                      // ... other OpenAI specific params
                   };
                   throw new Error ('OpenAI provider not yet implemented in execution store');
                } else {
                   throw new Error(`Unsupported LLM provider: ${llmData.provider}`);
                }
                
                try {
                  const response = await axios.post(apiUrl, requestBody, {
                    headers: { 'Content-Type': 'application/json' }
                  }); 
                  //const response = await axios.post(apiUrl, requestBody); 
                  // Log the raw successful response data
                  console.log(`[LLM Node ${nodeId}] Raw Success Response:`, response.data);

                  // Ollama generate response structure: { response: \"...\", context: [...] ... }
                  // Extract the actual text response
                  if (llmData.provider === 'ollama') {
                    // Add check for response field existence
                    if (response.data && typeof response.data.response === 'string') {
                        result = response.data.response; // Get the generated text
                    } else {
                        console.error(`[LLM Node ${nodeId}] Ollama response missing 'response' field. Raw data:`, response.data);
                        throw new Error('Invalid response structure received from Ollama.');
                    }
                  } else {
                     // Adjust based on actual OpenAI response structure
                     result = response.data; 
                  }
                } catch (axiosError: any) {
                  // Log the raw error response
                  console.error(`[LLM Node ${nodeId}] Axios Error:`, axiosError);
                  if (axiosError.response) {
                    console.error(`[LLM Node ${nodeId}] Raw Error Response Data:`, axiosError.response.data);
                    console.error(`[LLM Node ${nodeId}] Raw Error Response Status:`, axiosError.response.status);
                    console.error(`[LLM Node ${nodeId}] Raw Error Response Headers:`, axiosError.response.headers);
                  } else if (axiosError.request) {
                    console.error(`[LLM Node ${nodeId}] No response received:`, axiosError.request);
                  } else {
                    console.error(`[LLM Node ${nodeId}] Error setting up request:`, axiosError.message);
                  }
                  // Re-throw a more specific error or the original one
                  throw new Error(`LLM API request failed: ${axiosError.message}`);
                }
                break;

              case 'api':
                const apiData = node.data as APINodeData;
                // TODO: Implement API node execution using inputData
                console.log(`Node ${nodeId} (API): Executing ${apiData.method} ${apiData.url} with inputs:`, inputData);
                // Placeholder result
                result = { message: "API Call Placeholder", input: inputData }; 
                break;

              case 'json-extractor':
                 const extractorData = node.data as JSONExtractorNodeData;
                 const jsonInput = inputData['input'] || inputData[Object.keys(inputData)[0]]; // Use first input
                 console.log(`Node ${nodeId} (JSON Extractor): Extracting "${extractorData.path}" from`, jsonInput);
                 try {
                     result = extractValue(jsonInput, extractorData.path);
                     if (result === undefined) {
                         console.warn(`Node ${nodeId} (JSON Extractor): Path "${extractorData.path}" returned undefined.`);
                     }
                 } catch (e: any) {
                     throw new Error(`JSON Path Extraction Failed: ${e.message}`);
                 }
                 break;

              case 'output':
                const outputData = node.data as OutputNodeData;
                const outputInput = inputData['input'] || inputData[Object.keys(inputData)[0]];
                console.log(`Node ${nodeId} (Output): Received`, outputInput);
                // Output node primarily displays input, so result is the input
                result = outputInput; 
                // Update the node's data.content for display in the UI (using Redux store directly)
                store.dispatch(updateNodeData({ 
                  nodeId: nodeId, // Use the correct nodeId variable
                  data: { 
                    ...outputData, 
                    content: typeof result === 'string' ? result : JSON.stringify(result, null, 2) 
                  }
                }));
                break;

              case 'conditional':
                const conditionalData = node.data as ConditionalNodeData;
                // Get the primary input (assuming it connects to the single target handle)
                const conditionInput = inputData[Object.keys(inputData)[0]]; // Use first/only input value
                console.log(`Node ${nodeId} (Conditional): Evaluating condition "${conditionalData.conditionType}" with value/path "${conditionalData.conditionValue}" on input:`, conditionInput);
                
                let valueToEvaluate = conditionInput;
                // If type is json_path, extract the value using the conditionValue as the path
                if (conditionalData.conditionType === 'json_path') {
                    // Note: conditionValue holds the JSON path itself in this case
                    valueToEvaluate = extractValue(conditionInput, conditionalData.conditionValue);
                    console.log(`Node ${nodeId} (Conditional): Extracted value for JSON Path evaluation:`, valueToEvaluate);
                } // For other types, valueToEvaluate remains the direct input

                // Perform the evaluation using the helper function
                const evaluationResult = evaluateCondition(
                    conditionalData.conditionType,
                    valueToEvaluate,
                    conditionalData.conditionValue // Pass conditionValue for comparison types
                );
                console.log(`Node ${nodeId} (Conditional): Evaluation result: ${evaluationResult}`);
                
                // Store the boolean result AND the evaluation outcome in the node state
                setNodeState(nodeId, { 
                  status: 'success', 
                  result: evaluationResult, // Store the boolean for branching
                  // Optional: add lastEvaluationResult to data if we want it persisted?
                  // data: { ...conditionalData, lastEvaluationResult: evaluationResult }
                  error: undefined 
                });

                // Conditional node execution itself is done, return the boolean result 
                // for executeFlow/_executeSubgraph to handle branching.
                return evaluationResult; 

              case 'group':
                const groupData = node.data as GroupNodeData;
                console.log(`Node ${nodeId} (Group): Starting group execution.`);
                const iterationSourceId = groupData.iterationConfig?.sourceNodeId;
                if (!iterationSourceId) {
                  throw new Error(`Group node ${nodeId} has no iteration source configured.`);
                }

                const sourceNodeState = getNodeState(iterationSourceId);
                let itemsToIterate: any[] = [];
                // Ensure source has run and has items
                if (sourceNodeState?.status !== 'success') {
                  console.log(`Node ${nodeId} (Group): Executing iteration source ${iterationSourceId}`);
                  try {
                    itemsToIterate = await get().executeNode(iterationSourceId);
                  } catch (e: any) {
                     throw new Error(`Iteration source node ${iterationSourceId} failed: ${e.message}`);
                  }
                } else {
                  itemsToIterate = sourceNodeState.result;
                }

                if (!Array.isArray(itemsToIterate)) {
                  throw new Error(`Iteration source node ${iterationSourceId} did not produce an array.`);
                }

                console.log(`Node ${nodeId} (Group): Iterating over ${itemsToIterate.length} items.`);
                const groupExecutionResults: GroupExecutionItemResult[] = []; // Use the new interface
                const nodesInGroup = get().getNodesInGroup(nodeId);
                const nodeIdsInGroup = new Set(nodesInGroup.map(n => n.id));
                const edgesInGroup = edges.filter(e => nodeIdsInGroup.has(e.source) && nodeIdsInGroup.has(e.target));
                
                set({ currentGroupTotalItems: itemsToIterate.length });

                for (let i = 0; i < itemsToIterate.length; i++) {
                  const item = itemsToIterate[i];
                  console.log(`Node ${nodeId} (Group): --- Iteration ${i + 1}/${itemsToIterate.length}, Item:`, item);
                  
                  set({ currentIterationItem: item, currentIterationIndex: i }); 
                  get().resetNodeStates(Array.from(nodeIdsInGroup));

                  const groupRootIds = nodesInGroup
                      .filter(n => !edgesInGroup.some(e => e.target === n.id))
                      .map(n => n.id);
                  
                  let finalNodeResults: Record<string, any> = {}; // Store results for this iteration
                  let iterationFinalOutput: any = null;
                  let iterationStatus: 'success' | 'error' = 'success';
                  let iterationError: string | undefined = undefined;
                  let iterationConditionalBranch: 'true' | 'false' | undefined = undefined;

                  try {
                      finalNodeResults = await _executeSubgraph(groupRootIds, nodesInGroup, edgesInGroup);
                      
                      // Determine the final output (e.g., from leaf node)
                      const groupLeafNodes = nodesInGroup.filter(n => 
                          !edgesInGroup.some(e => e.source === n.id)
                      );
                      if (groupLeafNodes.length > 0) {
                        iterationFinalOutput = finalNodeResults[groupLeafNodes[0].id];
                      } else {
                        iterationFinalOutput = { message: "No leaf node found in group" };
                      }

                      // Check for conditional node result within this iteration's results
                      for (const nodeInGroup of nodesInGroup) {
                        if (nodeInGroup.type === 'conditional' && finalNodeResults.hasOwnProperty(nodeInGroup.id)) {
                          const conditionResult = finalNodeResults[nodeInGroup.id];
                          if (typeof conditionResult === 'boolean') {
                            iterationConditionalBranch = conditionResult ? 'true' : 'false';
                            break; // Assume only one conditional node result matters per iteration for branching info
                          }
                        }
                      }
                      
                      console.log(`Node ${nodeId} (Group): Iteration ${i+1} finished. Output:`, iterationFinalOutput, `Branch: ${iterationConditionalBranch || 'N/A'}`);
                 
                  } catch (error: any) {
                      console.error(`Node ${nodeId} (Group): Error during iteration ${i + 1}:`, error);
                      iterationStatus = 'error';
                      iterationError = error.message || String(error);
                      iterationFinalOutput = null;
                      // finalNodeResults might be incomplete, but store what we have
                  }

                  // Push detailed result for the item
                  groupExecutionResults.push({
                    item: item,
                    nodeResults: finalNodeResults, // Store all node results for this item
                    finalOutput: iterationFinalOutput,
                    conditionalBranch: iterationConditionalBranch,
                    status: iterationStatus,
                    error: iterationError
                  });
                  
                  // Update group node state progressively (with the detailed results)
                  setNodeState(nodeId, { status: 'running', result: [...groupExecutionResults], error: undefined });
                  await new Promise(resolve => setTimeout(resolve, 50)); 
                }

                set({ currentIterationItem: undefined, currentIterationIndex: undefined, currentGroupTotalItems: undefined }); 
                result = groupExecutionResults; // Final result for the group node
                break;

              default:
                console.warn(`Node ${nodeId}: Unknown node type "${node.type}"`);
                result = inputData; // Pass input through for unknown types
            }

            // --- Update State and Return --- 
            setNodeState(nodeId, { status: 'success', result: result, error: undefined });
            console.log(`Node ${nodeId} (${node.type}): Execution successful, Result:`, result);
            return result;

          } catch (error: any) {
            console.error(`Node ${nodeId} (${node.type}): Execution failed:`, error);
            setNodeState(nodeId, { status: 'error', result: null, error: error.message || String(error) });
            throw error; // Re-throw to allow upstream nodes/executeFlow to catch it
          }
        },

        _executeSubgraph: async (startNodes: string[], nodesInSubgraph: Node<NodeData>[], edgesInSubgraph: Edge[]) => {
            // Executes a defined subgraph sequentially/topologically
            // Returns map of { nodeId: result }
            console.log('Executing subgraph starting with nodes:', startNodes);
            const executionQueue = [...startNodes];
            const executedInSubgraph = new Set<string>();
            const results: Record<string, any> = {};
            const nodesMap = new Map(nodesInSubgraph.map(n => [n.id, n]));

            while (executionQueue.length > 0) {
                const currentNodeId = executionQueue.shift()!;

                if (executedInSubgraph.has(currentNodeId)) continue;

                const node = nodesMap.get(currentNodeId);
                if (!node) {
                    console.error(`Subgraph execution: Node ${currentNodeId} not found in subgraph map.`);
                    continue; 
                }

                // Check if all direct parents *within the subgraph* have been executed
                const parentEdges = edgesInSubgraph.filter(e => e.target === currentNodeId);
                const parentIds = parentEdges.map(e => e.source);
                const parentsReady = parentIds.every(parentId => executedInSubgraph.has(parentId));

                if (!parentsReady) {
                    // Re-queue node and try later (simple approach, might need cycle detection)
                    executionQueue.push(currentNodeId);
                    // Add a safety break or better scheduling mechanism for complex graphs
                    console.warn(`Node ${currentNodeId} parents not ready, re-queueing.`);
                    await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
                    continue; 
                }

                try {
                    // Execute the node - crucially passing isSubExecution: true
                    const nodeResult = await get().executeNode(currentNodeId, { isSubExecution: true });
                    results[currentNodeId] = nodeResult;
                    executedInSubgraph.add(currentNodeId);

                    // --- REVISED QUEUEING LOGIC --- 
                    if (node.type === 'conditional' && typeof nodeResult === 'boolean') {
                      // Conditional Node: Queue ONLY the target of the correct branch handle
                      const branchHandleId = nodeResult ? 'true' : 'false';
                      console.log(`[Subgraph] Conditional Node ${currentNodeId} evaluated to ${nodeResult}. Looking for edges with handle: ${branchHandleId}`);
                      const conditionalChildrenEdges = edgesInSubgraph.filter(e => e.source === currentNodeId && e.sourceHandle === branchHandleId);
                      
                       conditionalChildrenEdges.forEach(edge => {
                           if (!executedInSubgraph.has(edge.target)) {
                               console.log(`[Subgraph] Queuing target ${edge.target} from conditional ${currentNodeId} via handle ${branchHandleId}`);
                               executionQueue.push(edge.target);
                           } else {
                               console.log(`[Subgraph] Target ${edge.target} from conditional ${currentNodeId} already executed.`);
                           }
                       });
                       // Log if no edges were found for the taken branch
                       if (conditionalChildrenEdges.length === 0) {
                          console.log(`[Subgraph] No outgoing edges found for handle ${branchHandleId} from conditional node ${currentNodeId}`);
                       }
                    } else {
                      // Non-Conditional Node: Queue targets of ALL outgoing edges within the subgraph
                      const childrenEdges = edgesInSubgraph.filter(e => e.source === currentNodeId);
                      console.log(`[Subgraph] Found ${childrenEdges.length} outgoing edges for non-conditional node ${currentNodeId}`);
                       childrenEdges.forEach(edge => { 
                           if (!executedInSubgraph.has(edge.target)) {
                              console.log(`[Subgraph] Queuing target ${edge.target} from non-conditional ${currentNodeId} (Edge ID: ${edge.id})`);
                              executionQueue.push(edge.target);
                           } else {
                              console.log(`[Subgraph] Target ${edge.target} from non-conditional ${currentNodeId} already executed.`);
                           }
                       });
                    }
                    // --- END REVISED QUEUEING LOGIC --- 
                    
                } catch (error: any) {
                    console.error(`Subgraph execution failed at node ${currentNodeId}:`, error);
                    // Propagate error, stopping this subgraph execution path
                    throw new Error(`Subgraph node ${currentNodeId} failed: ${error.message}`);
                }
            }
            console.log('Subgraph execution finished. Results:', results);
            return results;
        },

        executeFlow: async (startNodeId: string) => {
          const { nodes, edges, setNodeState, resetNodeStates, executeNode, _executeSubgraph } = get();
          console.log(`--- Executing Flow starting from ${startNodeId} ---`);
          set({ isExecuting: true });
          resetNodeStates(); // Reset all states before a full flow execution

          const executionQueue: string[] = [startNodeId];
          const executed = new Set<string>();

          try {
            while (executionQueue.length > 0) {
              const currentNodeId = executionQueue.shift()!;

              if (executed.has(currentNodeId)) continue;

              const node = nodes.find(n => n.id === currentNodeId);
              if (!node) continue;

              // Check if parents are done (only direct parents needed for basic flow)
              const parentEdges = edges.filter(e => e.target === currentNodeId);
              const parentIds = parentEdges.map(e => e.source);
              const parentsReady = parentIds.every(parentId => executed.has(parentId));

              if (!parentsReady) {
                  // This shouldn't happen with the queue logic if starting from a root
                  // But good for safety / potential parallel starts
                  console.warn(`Node ${currentNodeId} parents not ready, skipping for now.`);
                  // Re-queue? Depends on desired execution model.
                  continue; 
              }

              // Execute the node (passing no special context for top-level execution)
              const result = await executeNode(currentNodeId); 
              executed.add(currentNodeId);

              // Handle Conditional Branching
              if (node.type === 'conditional') {
                  const conditionResult = result; // result from executeNode is the boolean
                  if (typeof conditionResult === 'boolean') {
                      const handleId = conditionResult ? 'true' : 'false';
                      const outgoingEdges = edges.filter(e => e.source === currentNodeId && e.sourceHandle === handleId);
                      outgoingEdges.forEach(edge => {
                          if (!executed.has(edge.target)) {
                              executionQueue.push(edge.target);
                          }
                      });
                  } else {
                       console.error(`Conditional node ${currentNodeId} did not return a boolean result.`);
                       // Stop this path or mark error?
                  }
              } else {
                  // Add direct children to the queue for non-conditional nodes
                  const outgoingEdges = edges.filter(e => e.source === currentNodeId);
                  outgoingEdges.forEach(edge => {
                      if (!executed.has(edge.target)) {
                          executionQueue.push(edge.target);
                      }
                  });
              }
            }
            console.log('--- Flow Execution Complete ---');
          } catch (error) {
            console.error('--- Flow Execution Failed ---', error);
          } finally {
            set({ isExecuting: false, currentIterationItem: undefined, currentIterationIndex: undefined, currentGroupTotalItems: undefined });
          }
        },

        // --- New function for Group Execution ---
        executeFlowForGroup: async (groupId: string) => {
          const { nodes, edges, setNodeState, resetNodeStates, executeNode, getNodesInGroup, _executeSubgraph } = get();
          const groupNode = nodes.find(n => n.id === groupId && n.type === 'group');
          if (!groupNode) {
            console.error(`executeFlowForGroup: Group node ${groupId} not found.`);
            return;
          }

          console.log(`--- Executing Flow for Group ${groupId} ---`);
          set({ isExecuting: true });

          const nodesInGroup = getNodesInGroup(groupId);
          const nodeIdsInGroup = new Set(nodesInGroup.map(n => n.id));
          const edgesInGroup = edges.filter(e => nodeIdsInGroup.has(e.source) && nodeIdsInGroup.has(e.target));

          // 1. Reset states ONLY for nodes within the group
          resetNodeStates(Array.from(nodeIdsInGroup));

          // 2. Find root nodes WITHIN the group
          const groupRootIds = nodesInGroup
            .filter(n => !edgesInGroup.some(e => e.target === n.id))
            .map(n => n.id);

          if (groupRootIds.length === 0) {
            console.warn(`Group ${groupId} has no root nodes inside.`);
            set({ isExecuting: false });
            return;
          }

          console.log(`Group ${groupId}: Found internal root nodes:`, groupRootIds);

          // 3. Execute the entire group subgraph starting from ALL its roots
          try {
            // Call _executeSubgraph ONCE with all roots and the group's context
            const groupInternalResults = await _executeSubgraph(groupRootIds, nodesInGroup, edgesInGroup);
            console.log('--- Group Subgraph Execution Complete. Results:', groupInternalResults);
            // Note: The overall group result (for iteration) is handled in the executeNode case 'group'. 
            // This function just runs the internal flow.
            // We might want to update the Group Node's state here *if* it's NOT an iterating group.
            // For now, assume group execution is primarily for iteration.
          } catch (error) {
            console.error('--- Group Subgraph Execution Failed ---', error);
            // Handle error state if needed (e.g., set group node status)
          } finally {
            set({ isExecuting: false }); // Ensure isExecuting is reset
          }
        }
      }), 
      // Persist options
      { 
        name: "flow-execution-storage",
        // Optionally, specify storage type (localStorage is default)
        // getStorage: () => sessionStorage, // E.g., use sessionStorage
        // Optionally, specify which parts of the state to persist
        partialize: (state) => ({ 
            // Only persist things that make sense, e.g., maybe not isExecuting or currentIterationItem
            // nodeStates: state.nodeStates 
            // For now, don't persist execution state by default
        }), 
      }
    ),
    // Devtools options
    { name: "FlowExecutionStore" }
  )
);

// Custom hook to get node state with safety and force updates
export const useNodeState = (nodeId: string): NodeState => {
  const getNodeState = useFlowExecutionStore(state => state.getNodeState);
  const nodeState = getNodeState(nodeId) || defaultNodeState;
  
  // Force component update when node state changes
  const [, forceUpdate] = React.useState({});
  React.useEffect(() => {
    const interval = setInterval(() => {
      const currentState = getNodeState(nodeId);
      if (currentState?._lastUpdate !== nodeState._lastUpdate) {
        forceUpdate({});
      }
    }, 100);
    return () => clearInterval(interval);
  }, [nodeId, nodeState._lastUpdate]);

  return nodeState;
};

// Custom hook to check if a node is a root node
export const useIsRootNode = (nodeId: string): boolean => {
  const edges = useSelector((state: RootState) => state.flow.edges);
  const setEdges = useFlowExecutionStore(state => state.setEdges);
  const setNodes = useFlowExecutionStore(state => state.setNodes);
  const nodes = useSelector((state: RootState) => state.flow.nodes);
  
  // Keep flow execution store in sync with Redux
  React.useEffect(() => {
    setEdges(edges);
    setNodes(nodes);
  }, [edges, nodes, setEdges, setNodes]);

  return useFlowExecutionStore(state => state.isNodeRoot(nodeId));
};

// Expose execution triggers
export const executeFlow = useFlowExecutionStore.getState().executeFlow;
export const executeFlowForGroup = useFlowExecutionStore.getState().executeFlowForGroup; // Export the new function

// Hook to get the full execution state for debugging or overview
// Export the hook
export const useExecutionState = () => {
  return useFlowExecutionStore(state => ({ 
      nodeStates: state.nodeStates, 
      isExecuting: state.isExecuting, 
      currentIterationIndex: state.currentIterationIndex,
      currentGroupTotalItems: state.currentGroupTotalItems 
    }));
}; 