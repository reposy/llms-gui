import { create } from 'zustand';
import { Edge, Node } from 'reactflow';
import { APINodeData, LLMNodeData, OutputNodeData, LLMResult, GroupNodeData, NodeData, JSONExtractorNodeData, InputNodeData } from '../types/nodes';
import axios from 'axios';
import { store } from './store';
import { useSelector } from 'react-redux';
import React from 'react';
import { RootState } from './store';

interface NodeState {
  status: 'idle' | 'running' | 'success' | 'error';
  result: any;
  error: string | undefined;
  _lastUpdate: number;
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
  executeNode: (nodeId: string) => Promise<any>;
  executeFlow: (startNodeId: string) => Promise<void>;
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
    const jsonObj = typeof obj === 'string' ? JSON.parse(obj) : obj;
    return path.split('.').reduce((acc, part) => {
      if (part.includes('[') && part.includes(']')) {
        const [arrayName, indexStr] = part.split('[');
        const index = parseInt(indexStr.replace(']', ''));
        return acc[arrayName][index];
      }
      if (acc === null || acc === undefined) return undefined;
      return acc[part];
    }, jsonObj);
  } catch (error) {
    console.error('Error extracting value:', error);
    throw new Error(`Failed to extract value at path "${path}": ${error instanceof Error ? error.message : String(error)}`);
  }
};

export const useFlowExecution = create<FlowExecutionState>((set, get) => ({
  nodeStates: {},
  edges: [],
  nodes: [],
  isExecuting: false,
  currentIterationItem: undefined,
  currentIterationIndex: undefined,
  
  setEdges: (edges) => {
    set({ edges });
  },

  setNodes: (nodes) => {
    set({ nodes });
  },

  getNodeState: (nodeId) => {
    return get().nodeStates[nodeId] || defaultNodeState;
  },

  setNodeState: (nodeId, state) => {
    set(prev => {
      const newState = {
        ...prev.nodeStates,
        [nodeId]: {
          ...defaultNodeState,
          ...prev.nodeStates[nodeId],
          ...state,
          _lastUpdate: Date.now()
        }
      };
      return { nodeStates: newState };
    });
  },

  resetNodeStates: (nodeIds?: string[]) => {
    // Treat undefined OR an empty array as a request to reset all
    if (!nodeIds || nodeIds.length === 0) {
      // Reset all node states
      set({ nodeStates: {} });
    } else {
       // Reset only specified nodes
       set(prev => {
         const newNodeStates = { ...prev.nodeStates };
         nodeIds.forEach(id => {
           newNodeStates[id] = { ...defaultNodeState }; 
         });
         return { nodeStates: newNodeStates };
       });
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
    // ... modify to respect subsetNodeIds if provided ...
    // (Implementation needs adjustment, return [] for now)
    return [];
  },

  getUpstreamNodes: (nodeId, subsetNodeIds) => {
    // ... modify to respect subsetNodeIds if provided ...
    // (Implementation needs adjustment, return [] for now)
     return [];
  },
  
  getNodesInGroup: (groupId) => {
      const { nodes } = get();
      // React Flow parent extent includes the group node itself, filter based on parentNode property
      return nodes.filter(n => n.parentNode === groupId);
  },

  executeNode: async (nodeId: string): Promise<any> => {
    const { 
      nodes, edges, setNodeState, getNodeState, 
      currentIterationItem, currentIterationIndex // Get iteration context
    } = get();
    const node = nodes.find(n => n.id === nodeId);
    if (!node) {
      console.error(`Node not found: ${nodeId}`);
      throw new Error(`Node not found: ${nodeId}`);
    }

    // --- Handle Input Source for Iteration --- 
    let parentResults: Record<string, any> = {};
    const parentEdges = edges.filter(e => e.target === nodeId);
    
    // Check if this node is the *entry node* in an iteration
    const isIterationEntry = parentEdges.length === 0 && currentIterationItem !== undefined;

    if (isIterationEntry) {
      console.log(`Node ${nodeId}: Using iteration item (Index ${currentIterationIndex}) as input.`);
      // Inject the current iteration item as the sole input
      // Use a default key like 'input' or derive from node type if needed
      parentResults['input'] = currentIterationItem; 
    } else {
      // --- Original Parent Node Execution Logic --- 
      for (const edge of parentEdges) {
        const parentNode = nodes.find(n => n.id === edge.source);
        if (!parentNode) {
          throw new Error(`Parent node ${edge.source} not found for edge ${edge.id}`);
        }
        
        try {
          // Don't re-execute parent if it's part of the same potential iteration group (handled by executeFlow)
          // Await result from already executed or currently executing parent
          let parentResult = getNodeState(parentNode.id)?.result;
          if (getNodeState(parentNode.id)?.status !== 'success') {
              console.log(`Node ${nodeId}: Awaiting parent ${parentNode.id}`);
              parentResult = await get().executeNode(parentNode.id); 
          }
          
          // Extract text content (or use raw object if needed by target)
          // Keep existing logic for text extraction for now
          let textContent: string;
          if (parentResult === null || parentResult === undefined) textContent = '';
          else if (typeof parentResult === 'string') textContent = parentResult;
          else if (typeof parentResult === 'object') {
             // ... (existing object to text logic) ...
             textContent = JSON.stringify(parentResult); // Simplified fallback
          }
          else textContent = String(parentResult);

          const handleKey = edge.targetHandle || `input-${edge.source}`; // Use a more specific key
          parentResults[handleKey] = textContent; // Store extracted text for now

        } catch (error: any) {
          console.error(`Node ${nodeId}: Error executing parent ${parentNode.id}:`, error);
          setNodeState(nodeId, { status: 'error', result: null, error: `Parent ${parentNode.id} failed: ${error.message}` });
          throw error;
        }
      }
    }

    // Check current state (after potentially waiting for parents)
    const currentState = getNodeState(nodeId);
    if (currentState?.status === 'success') {
      console.log(`Node ${nodeId}: Already successfully executed, returning cached result.`);
      // Don't re-update downstream outputs if just fetching cache
      if (node.type === 'llm' && currentState.result?.content) return currentState.result.content;
      return currentState.result;
    }
    if (currentState?.status === 'running') {
       console.warn(`Node ${nodeId}: Already running, potential circular dependency?`);
       // Optionally wait or return null/error
       return null; 
    }

    // Set running state
    setNodeState(nodeId, { status: 'running', result: null, error: undefined });
    // Update connected output nodes (only those *outside* the current iteration group if applicable)
    // This needs refinement if groups contain outputs.
    const connectedOutputs = edges
      .filter(e => e.source === nodeId)
      .map(e => nodes.find(n => n.id === e.target))
      .filter(n => n?.type === 'output');
    connectedOutputs.forEach(outNode => {
       if(outNode) setNodeState(outNode.id, { status: 'running', result: '처리 중...', error: undefined });
    });

    try {
      // --- Execute this node based on type ---
      let result: any;
      console.log(`Node ${nodeId}: Executing self`);
      const singleInput = parentResults[Object.keys(parentResults)[0]]; // Use first input for nodes expecting one

      switch (node.type) {
         // --- Keep existing cases with type assertions --- 
         case 'api': { const data = node.data as APINodeData; /* ... API logic ... */ result = await axios(/*...*/); break; }
         case 'llm': { const data = node.data as LLMNodeData; /* ... LLM logic ... */ result = {/*...*/}; break; }
         case 'output': { /* ... Output logic (receives full parent result) ... */ result = singleInput; break; }
         case 'json-extractor': { const data = node.data as JSONExtractorNodeData; /* ... Extractor logic ... */ result = extractValue(singleInput, data.path); break; }
         case 'input': { const data = node.data as InputNodeData; result = data.text; break; }
         // --- Group Node Execution (Placeholder/No Action Itself) ---
         case 'group': {
            // Group node itself doesn't execute, its children are handled by executeFlow loop
            console.log(`Node ${nodeId}: Group node encountered, execution handled by parent loop.`);
            result = null; // Or maybe aggregated results later?
            break;
         }
         default: { /* ... error for unsupported type ... */ }
      }

      // --- Execution successful --- 
      console.log(`Node ${nodeId}: Execution successful`);
      setNodeState(nodeId, { status: 'success', result: result, error: undefined });

      // --- Update connected Output Nodes (outside group) on Success ---
      connectedOutputs.forEach(outNode => {
         if (outNode) setNodeState(outNode.id, { status: 'success', result: result, error: undefined });
      });
      
      // --- Return Result --- 
      // Special handling for LLM content remains
      if (node.type === 'llm' && result?.content) return result.content;
      return result;

    } catch (error: any) { 
      // --- Error Handling --- 
      console.error(`Node ${nodeId}: Execution failed`, error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setNodeState(nodeId, { status: 'error', result: null, error: errorMessage });

      // --- Update connected Output Nodes (outside group) on Error ---
      connectedOutputs.forEach(outNode => {
         if (outNode) setNodeState(outNode.id, { status: 'error', result: `Error from ${node.data.label || node.id}`, error: errorMessage });
      });

      throw error; // Rethrow to stop flow
    }
  },

  executeFlow: async (startNodeId: string): Promise<void> => {
    const { 
      nodes, edges, setNodeState, getNodeState, getNodesInGroup, 
      getRootNodes, resetNodeStates, executeNode 
    } = get();
    const startNode = nodes.find(n => n.id === startNodeId);

    if (!startNode) {
      console.error("Start node not found:", startNodeId);
      return;
    }

    console.log(`--- Starting Flow Execution from ${startNodeId} ---`);
    set({ isExecuting: true });
    // Pass an empty array to reset all states
    resetNodeStates([]); 

    const executionQueue: string[] = [startNodeId];
    const executedNodes = new Set<string>();
    let finalError: Error | null = null;

    while (executionQueue.length > 0) {
      const currentNodeId = executionQueue.shift()!;
      if (executedNodes.has(currentNodeId)) continue; // Avoid re-processing in this run

      const node = nodes.find(n => n.id === currentNodeId);
      if (!node) continue;

      console.log(`Processing node: ${currentNodeId} (Type: ${node.type})`);
      
      try {
        // --- Iteration Handling --- 
        const groupData = node.data as GroupNodeData;
        // Check for group and valid iteration config together
        if (node.type === 'group' && groupData.iterationConfig?.sourceNodeId) {
          const iterationConfig = groupData.iterationConfig; // Now non-null within this block
          const sourceNodeId = iterationConfig.sourceNodeId;
          
          // ... rest of iteration logic using sourceNodeId ...
          // (Ensure source node execution check)
           if (getNodeState(sourceNodeId)?.status !== 'success') {
             console.log(`Group ${node.id}: Waiting for source node ${sourceNodeId}...`);
              try {
                 await executeNode(sourceNodeId); 
                 const updatedSourceState = getNodeState(sourceNodeId);
                 if(updatedSourceState?.status !== 'success') {
                    throw new Error(`Iteration source node ${sourceNodeId} did not execute successfully.`);
                 }
              } catch(sourceError) {
                  throw new Error(`Failed to execute iteration source node ${sourceNodeId}: ${sourceError}`);
              }
          }
          
          const iterableData = getNodeState(sourceNodeId)?.result;
          if (!Array.isArray(iterableData)) { /* ... error ... */ }

          console.log(`Group ${node.id}: Starting iteration over ${iterableData.length} items from ${sourceNodeId}`);
          setNodeState(node.id, { status: 'running', result: [], error: undefined });
          
          const groupNodes = getNodesInGroup(node.id);
          const groupNodeIds = new Set(groupNodes.map(n => n.id));
          const groupEntryNodeIds = getRootNodes(groupNodeIds); 
          const iterationResults: any[] = []; // Explicitly type as any[]

          for (let i = 0; i < iterableData.length; i++) {
             // ... set iteration context ...
             set({ currentIterationItem: iterableData[i], currentIterationIndex: i }); 
             resetNodeStates(Array.from(groupNodeIds));
             try {
               let lastResultInIteration: any;
               // ... execute nodes within group ...
               for (const entryNodeId of groupEntryNodeIds) { 
                  // ... execute entry node ... 
                  // ... execute downstream within group ...
               }
               iterationResults.push(lastResultInIteration); 
             } catch (iterationError: any) { // Catch iteration error
                // ... handle iteration error, set group state, break ...
                finalError = iterationError instanceof Error ? iterationError : new Error(String(iterationError));
                break;
             }
          } 

          set({ currentIterationItem: undefined, currentIterationIndex: undefined });
          if (!finalError) { setNodeState(node.id, { status: 'success', result: iterationResults, error: undefined }); }
          executedNodes.add(currentNodeId); 

        } else { 
          // --- Standard Node Execution --- 
          await executeNode(currentNodeId);
          executedNodes.add(currentNodeId);
          // ... add downstream nodes ...
        }
      } catch (error: any) { // Catch general flow error
        // ... handle general flow error, break ...
        finalError = error instanceof Error ? error : new Error(String(error));
        break; 
      }
    } 

    set({ isExecuting: false });
    console.log("--- Flow Execution Finished ---", finalError ? `Error: ${finalError.message}` : "Success");
  }
}));

// Custom hook to get node state with safety and force updates
export const useNodeState = (nodeId: string): NodeState => {
  const getNodeState = useFlowExecution(state => state.getNodeState);
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
  const setEdges = useFlowExecution(state => state.setEdges);
  const setNodes = useFlowExecution(state => state.setNodes);
  const nodes = useSelector((state: RootState) => state.flow.nodes);
  
  // Keep flow execution store in sync with Redux
  React.useEffect(() => {
    setEdges(edges);
    setNodes(nodes);
  }, [edges, nodes, setEdges, setNodes]);

  return useFlowExecution(state => state.isNodeRoot(nodeId));
};

// Non-hook version for direct execution
export const executeFlow = (nodeId: string) => {
  return useFlowExecution.getState().executeFlow(nodeId);
}; 