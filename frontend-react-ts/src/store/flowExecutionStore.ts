import { create } from 'zustand';
import { Edge, Node } from 'reactflow';
import { APINodeData, LLMNodeData, OutputNodeData, LLMResult, GroupNodeData, NodeData, JSONExtractorNodeData, InputNodeData, ConditionalNodeData, ConditionType, MergerNodeData } from '../types/nodes';
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

// Export the interface
export interface NodeState {
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

// Export the interface
export interface FlowExecutionState {
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

// Export default state object
export const defaultNodeState: NodeState = {
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
          let inputData: Record<string, any[]> = {}; // Values will be arrays to handle multiple inputs per handle
          // If inside an iterating group, the primary input is the item
          if (node.parentNode && currentIterationItem !== undefined) {
            // Check if this node is directly connected to the group's implicit input
            // For simplicity, assume nodes inside a group primarily use the 'item' 
            // or results from other nodes *within the same iteration*
            inputData['item'] = [currentIterationItem]; // Store item as an array too for consistency
            
            // Additionally, gather results from *internal* parent nodes within the group
            const groupNodes = get().getNodesInGroup(node.parentNode);
            const groupNodeIds = new Set(groupNodes.map(n => n.id));
            const internalParentEdges = edges.filter(e => e.target === nodeId && groupNodeIds.has(e.source));

            for (const edge of internalParentEdges) {
                const parentState = getNodeState(edge.source);
                if (parentState?.status === 'success') {
                    const inputKey = edge.targetHandle || 'default_input'; // Consistent key for default handle
                    if (!inputData[inputKey]) {
                        inputData[inputKey] = [];
                    }
                    inputData[inputKey].push(parentState.result); // Add result to the handle's array
                } else {
                    console.warn(`Node ${nodeId}: Internal parent ${edge.source} hasn't succeeded yet.`);
                }
            }
            
          } else {
            // Standard execution: Get results ONLY from successfully completed parent nodes
            const parentEdges = edges.filter(e => e.target === nodeId);
            console.log(`Node ${nodeId}: Gathering inputs. Found ${parentEdges.length} parent edges.`); // Log edge count
            for (const edge of parentEdges) {
              const parentState = getNodeState(edge.source);

              // ** ADDED DETAILED LOGGING for input gathering **
              console.log(`[InputGathering for ${nodeId} (${node?.type})] Checking parent ${edge.source}: Status=${parentState?.status}, Result=${JSON.stringify(parentState?.result)}`);

              // ** ONLY COLLECT IF PARENT SUCCEEDED **
              if (parentState?.status === 'success') {
                 const parentResult = parentState.result;
                 const inputKey = edge.targetHandle || 'default_input';
                 if (!inputData[inputKey]) {
                    inputData[inputKey] = [];
                 }
                 inputData[inputKey].push(parentResult);
                 console.log(`Node ${nodeId}: Received input on handle '${inputKey}' from SUCCESSFUL parent ${edge.source}`, parentResult);
              } else {
                // Log skipped parents for debugging
                console.log(`[InputGathering for ${nodeId} (${node?.type})] Skipping input from parent ${edge.source} (Status: ${parentState?.status || 'unknown'})`);
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

              case 'merger':
                const mergerData = node.data as MergerNodeData;
                // inputData is gathered from *all currently successful* parents by the logic above
                const newInputsArray: any[] = [];
                console.log(`[Merger Node ${nodeId}] EXECUTION START. Raw inputData gathered:`, JSON.stringify(inputData, null, 2));

                for (const handleKey in inputData) {
                    const resultsForHandle = inputData[handleKey]; // This is an array of results for this handle
                    newInputsArray.push(...resultsForHandle); // Flatten into the final array
                }

                // Get previous results from state
                const currentState = getNodeState(nodeId);
                // Ensure prevResult is always an array, even if it was null/undefined before
                const prevResult = Array.isArray(currentState?.result) ? currentState.result : [];

                // Combine previous and new results
                // Note: This simple append might add duplicates if the same parent triggers the merger multiple times
                // without an intermediate reset. This matches the collector behavior described.
                const nextResult = [...prevResult, ...newInputsArray];
                console.log(`[Merger Node ${nodeId}] Appending ${newInputsArray.length} new items to previous ${prevResult.length} items. New total: ${nextResult.length}`);

                // Update state with the appended results
                setNodeState(nodeId, { status: 'success', result: nextResult, error: undefined });
                console.log(`Node ${nodeId} (Merger): Append successful. Current Result (${nextResult.length} items):`, nextResult);
                // The result returned by executeNode should be the *newly appended total array*
                // so subsequent nodes connected to the merger get the full picture.
                result = nextResult;
                break;

              default:
                console.warn(`Node ${nodeId}: Unknown node type "${node.type}"`);
                result = inputData; // Pass input through for unknown types
            }

            // --- Update State and Return ---
            // Note: For merger, status was already set to success inside the case.
            // For other nodes, we set it here.
            if (node.type !== 'merger') {
               setNodeState(nodeId, { status: 'success', result: result, error: undefined });
            }
            console.log(`Node ${nodeId} (${node.type}): Execution successful, Result:`, result);
            return result;

          } catch (error: any) {
            console.error(`Node ${nodeId} (${node.type}): Execution failed:`, error);
            setNodeState(nodeId, { status: 'error', result: null, error: error.message || String(error) });
            throw error; // Re-throw
          }
        },

        _executeSubgraph: async (startNodes: string[], nodesInSubgraph: Node<NodeData>[], edgesInSubgraph: Edge[]) => {
            console.log('[Subgraph] Starting execution from nodes:', startNodes);
            const results: Record<string, any> = {};
            const nodesMap = new Map(nodesInSubgraph.map(n => [n.id, n]));
            const executedNodes = new Set<string>();
            const activePromises = new Map<string, Promise<any>>();

            // Helper to get direct parent edges for a node
            const getDirectParentEdges = (nodeId: string) => {
                return edgesInSubgraph.filter(e => e.target === nodeId);
            };

            // Helper to check if a node's direct parents are ready
            const areDirectParentsReady = (nodeId: string, node: Node<NodeData>) => {
                const parentEdges = getDirectParentEdges(nodeId);
                if (parentEdges.length === 0) return true; // Root nodes are always ready

                // For merger nodes, ANY completed parent is enough
                if (node.type === 'merger') {
                    return parentEdges.some(edge => executedNodes.has(edge.source));
                }

                // For other nodes, ALL direct parents must be complete
                return parentEdges.every(edge => executedNodes.has(edge.source));
            };

            // Helper to get and queue direct downstream nodes
            const queueDownstreamNodes = async (nodeId: string, result?: any) => {
                const node = nodesMap.get(nodeId);
                if (!node) return;

                // For conditional nodes, only queue the matching branch
                if (node.type === 'conditional' && typeof result === 'boolean') {
                    const branchHandleId = result ? 'true' : 'false';
                    console.log(`[Subgraph] Conditional ${nodeId} evaluated to ${result}, queueing ${branchHandleId} branch`);
                    
                    const branchEdges = edgesInSubgraph.filter(e => 
                        e.source === nodeId && e.sourceHandle === branchHandleId
                    );
                    
                    for (const edge of branchEdges) {
                        await tryExecuteNode(edge.target);
                    }
                } else {
                    // For all other nodes, queue all direct downstream nodes
                    const downstreamEdges = edgesInSubgraph.filter(e => e.source === nodeId);
                    for (const edge of downstreamEdges) {
                        await tryExecuteNode(edge.target);
                    }
                }
            };

            // Helper to try executing a node if ready
            const tryExecuteNode = async (nodeId: string) => {
                // Skip if already executed or currently executing
                if (executedNodes.has(nodeId) || activePromises.has(nodeId)) {
                    return;
                }

                const node = nodesMap.get(nodeId);
                if (!node) {
                    console.error(`[Subgraph] Node ${nodeId} not found in map`);
                    return;
                }

                // Check if node can execute based on its direct parents
                if (!areDirectParentsReady(nodeId, node)) {
                    console.log(`[Subgraph] Node ${nodeId} (${node.type}) waiting for direct parents`);
                    return;
                }

                console.log(`[Subgraph] Executing node ${nodeId} (${node.type})`);
                const executionPromise = get().executeNode(nodeId, { isSubExecution: true })
                    .then(async nodeResult => {
                        results[nodeId] = nodeResult;
                        executedNodes.add(nodeId);
                        activePromises.delete(nodeId);
                        console.log(`[Subgraph] Node ${nodeId} completed successfully`);
                        
                        // Queue downstream nodes immediately after success
                        await queueDownstreamNodes(nodeId, nodeResult);
                    })
                    .catch(async error => {
                        console.error(`[Subgraph] Node ${nodeId} execution failed:`, error);
                        executedNodes.add(nodeId); // Mark as executed even on failure
                        activePromises.delete(nodeId);
                        // Still try to queue downstream nodes on failure
                        await queueDownstreamNodes(nodeId);
                    });

                activePromises.set(nodeId, executionPromise);
            };

            // Start execution from all start nodes
            await Promise.all(startNodes.map(nodeId => tryExecuteNode(nodeId)));

            // Wait for all active executions to complete
            if (activePromises.size > 0) {
                await Promise.all(activePromises.values());
            }

            console.log('[Subgraph] Execution complete. Results:', results);
            return results;
        },

        executeFlow: async (startNodeId: string) => {
          const { nodes, edges, setNodeState, resetNodeStates, executeNode, _executeSubgraph, getNodesInGroup } = get();
          const startNode = nodes.find(n => n.id === startNodeId);

          if (!startNode) {
            console.error(`executeFlow: Start node ${startNodeId} not found.`);
            return;
          }

          console.log(`--- Executing Flow starting from ${startNodeId} (Type: ${startNode.type}, Parent: ${startNode.parentNode || 'None'}) ---`);
          set({ isExecuting: true });

          // *** MODIFIED LOGIC: Check if starting inside a group ***
          if (startNode.parentNode) {
            const groupId = startNode.parentNode;
            console.log(`Start node ${startNodeId} is inside group ${groupId}. Executing group subgraph downstream.`);
            const nodesInGroup = getNodesInGroup(groupId);
            const nodeIdsInGroup = new Set(nodesInGroup.map(n => n.id));
            const edgesInGroup = edges.filter(e => nodeIdsInGroup.has(e.source) && nodeIdsInGroup.has(e.target));

            // Find all nodes downstream from startNodeId within the group
            const downstreamNodes = new Set<string>();
            const queue = [startNodeId];
            downstreamNodes.add(startNodeId);

            while (queue.length > 0) {
              const currentId = queue.shift()!;
              const childrenEdges = edgesInGroup.filter(e => e.source === currentId);
              childrenEdges.forEach(edge => {
                if (!downstreamNodes.has(edge.target)) {
                  downstreamNodes.add(edge.target);
                  queue.push(edge.target);
                }
              });
            }
            const downstreamNodeIds = Array.from(downstreamNodes);
            console.log(`Resetting states for downstream nodes in group ${groupId}:`, downstreamNodeIds);
            resetNodeStates(downstreamNodeIds); // Reset only downstream nodes

            try {
               // Execute subgraph starting ONLY from the clicked node
               await _executeSubgraph([startNodeId], nodesInGroup, edgesInGroup);
               console.log(`--- Group Subgraph execution (from ${startNodeId}) Complete ---`);
            } catch (error) {
               console.error(`--- Group Subgraph execution (from ${startNodeId}) Failed ---`, error);
               // Update start node status to error maybe?
               setNodeState(startNodeId, { status: 'error', error: String(error) });
            }

          } else {
            // *** Original Logic: Starting from a top-level node ***
            console.log(`Start node ${startNodeId} is top-level. Executing global flow.`);
            resetNodeStates(); // Reset all states before a full global flow execution

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

                if (!parentsReady && parentIds.length > 0) { // Check length > 0 to allow root node
                    console.warn(`Node ${currentNodeId} parents not ready, re-queueing.`);
                    executionQueue.push(currentNodeId); // Re-queue
                    await new Promise(resolve => setTimeout(resolve, 10)); // Prevent infinite loop potential
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
              console.log('--- Global Flow Execution Complete ---');
            } catch (error) {
              console.error('--- Global Flow Execution Failed ---', error);
            }
          } // End of if/else for group vs global start

          // --- Finalization ---
          set({ isExecuting: false, currentIterationItem: undefined, currentIterationIndex: undefined, currentGroupTotalItems: undefined });
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
  // Just read the state from the execution store directly
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

// Function to initialize the store with nodes/edges from Redux (call this once)
export const initializeExecutionStore = () => {
  // Get initial state from Redux
  const initialNodes = store.getState().flow.nodes;
  const initialEdges = store.getState().flow.edges;
  useFlowExecutionStore.setState({ nodes: initialNodes, edges: initialEdges });
  console.log('Zustand store initialized with Redux data.'); // Added log

  // Subscribe to Redux store changes
  let previousNodes = initialNodes;
  let previousEdges = initialEdges;
  store.subscribe(() => {
    const { nodes, edges } = store.getState().flow;
    // Check if nodes or edges have actually changed to avoid unnecessary Zustand updates
    if (nodes !== previousNodes || edges !== previousEdges) {
        console.log('Redux store changed, updating Zustand store...'); // Added log
        useFlowExecutionStore.setState({ nodes, edges });
        previousNodes = nodes;
        previousEdges = edges;
    }
  });
  console.log('Subscribed to Redux store changes.'); // Added log
};

// Initialize on module load (consider moving to app setup)
initializeExecutionStore(); // <-- Uncommented this line 