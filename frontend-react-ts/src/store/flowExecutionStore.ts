import { create } from 'zustand';
import { Edge, Node } from 'reactflow';
import { APINodeData, LLMNodeData, OutputNodeData, LLMResult } from '../types/nodes';
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
  nodes: Node[];
  setEdges: (edges: Edge[]) => void;
  setNodes: (nodes: Node[]) => void;
  isExecuting: boolean;
  
  // Node state management
  getNodeState: (nodeId: string) => NodeState | undefined;
  setNodeState: (nodeId: string, state: Partial<NodeState>) => void;
  resetNodeStates: () => void;
  
  // Node relationship helpers
  isNodeRoot: (nodeId: string) => boolean;
  getRootNodes: () => string[];
  getDownstreamNodes: (nodeId: string) => string[];
  getUpstreamNodes: (nodeId: string) => string[];
  
  // Execution methods
  executeNode: (nodeId: string) => Promise<void>;
  executeFlow: (nodeId: string) => Promise<void>;
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

  resetNodeStates: () => {
    set({ nodeStates: {} });
  },

  isNodeRoot: (nodeId) => {
    const { edges } = get();
    return isNodeRoot(nodeId, edges);
  },

  getRootNodes: () => {
    const { nodes, edges } = get();
    return nodes
      .filter(node => isNodeRoot(node.id, edges))
      .map(node => node.id);
  },

  getDownstreamNodes: (nodeId: string) => {
    const { edges } = get();
    const downstream = new Set<string>();
    const queue = [nodeId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const outgoingEdges = edges.filter(e => e.source === currentId);
      
      for (const edge of outgoingEdges) {
        if (!downstream.has(edge.target)) {
          downstream.add(edge.target);
          queue.push(edge.target);
        }
      }
    }

    return Array.from(downstream);
  },

  getUpstreamNodes: (nodeId: string) => {
    const { edges } = get();
    const upstream = new Set<string>();
    const queue = [nodeId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const incomingEdges = edges.filter(e => e.target === currentId);
      
      for (const edge of incomingEdges) {
        if (!upstream.has(edge.source)) {
          upstream.add(edge.source);
          queue.push(edge.source);
        }
      }
    }

    return Array.from(upstream);
  },

  executeNode: async (nodeId: string): Promise<any> => {
    const { nodes, edges, setNodeState, getNodeState } = get();
    const node = nodes.find(n => n.id === nodeId);
    if (!node) {
      console.error(`Node not found: ${nodeId}`);
      throw new Error(`Node not found: ${nodeId}`);
    }

    // Check current state - only update if needed
    const currentState = getNodeState(nodeId);
    if (currentState?.status === 'success') {
      // Force a state refresh even for cached results
      setNodeState(nodeId, { 
        status: 'success',
        result: currentState.result,
        error: undefined
      });

      // Update connected output nodes immediately (Fix: Pass original cached result)
      const connectedEdges = edges.filter(e => e.source === nodeId);
      connectedEdges.forEach(edge => {
        const targetNode = nodes.find(n => n.id === edge.target);
        if (targetNode?.type === 'output') {
          // REMOVED content extraction logic here
          // Pass the original cached result object directly
          setNodeState(edge.target, {
            status: 'success',
            result: currentState.result, // Pass the original cached result object
            error: undefined
          });
        }
      });
      
      // For LLM nodes, only return the content when passing to downstream nodes
      if (node.type === 'llm' && currentState.result?.content) {
        return currentState.result.content;
      }
      return currentState.result;
    }

    // Set running state only if not already running
    if (currentState?.status !== 'running') {
      setNodeState(nodeId, { 
        status: 'running', 
        result: null, 
        error: undefined 
      });

      // Set connected output nodes to running state
      const connectedEdges = edges.filter(e => e.source === nodeId);
      connectedEdges.forEach(edge => {
        const targetNode = nodes.find(n => n.id === edge.target);
        if (targetNode?.type === 'output') {
          setNodeState(edge.target, {
            status: 'running',
            result: '처리 중...',
            error: undefined
          });
        }
      });
    }

    try {
      // --- Wait for and Get input from parent nodes ---
      const parentEdges = edges.filter(e => e.target === nodeId);
      const parentResults: Record<string, string> = {};

      // Execute parent nodes sequentially and collect results
      for (const edge of parentEdges) {
        const parentNode = nodes.find(n => n.id === edge.source);
        if (!parentNode) {
          throw new Error(`Parent node ${edge.source} not found for edge ${edge.id}`);
        }
        
        try {
          console.log(`Node ${nodeId}: Awaiting parent ${parentNode.id}`);
          const parentResult: any = await get().executeNode(parentNode.id);
          
          // Extract text content from parent result
          let textContent: string;
          
          if (parentResult === null || parentResult === undefined) {
            textContent = '';
          } else if (typeof parentResult === 'string') {
            textContent = parentResult;
          } else if (typeof parentResult === 'object') {
            // For LLM nodes, we already return just the content above
            // This is for other object types
            const resultObj = parentResult as Record<string, unknown>;
            if ('content' in resultObj && resultObj.content) {
              textContent = typeof resultObj.content === 'string' 
                ? resultObj.content 
                : JSON.stringify(resultObj.content);
            } else if ('text' in resultObj && resultObj.text) {
              textContent = String(resultObj.text);
            } else {
              textContent = JSON.stringify(resultObj);
            }
          } else {
            textContent = String(parentResult);
          }

          // Store result based on handle or node ID
          const handleKey = edge.targetHandle || edge.source;
          parentResults[handleKey] = textContent;
          console.log(`Node ${nodeId}: Received result from parent ${parentNode.id}`);

        } catch (error: any) {
          console.error(`Node ${nodeId}: Error executing parent ${parentNode.id}:`, error);
          setNodeState(nodeId, { 
            status: 'error', 
            result: null, 
            error: `Parent node ${parentNode.id} failed: ${error.message}` 
          });
          throw error;
        }
      }

      // --- Execute this node based on type ---
      let result: any;
      console.log(`Node ${nodeId}: Executing self`);
      
      switch (node.type) {
        case 'api': {
          const data = node.data as APINodeData;
          const inputData = parentResults[Object.keys(parentResults)[0]];

          const hasProtocol = /^[a-zA-Z]+:\/\//.test(data.url);
          const url = hasProtocol ? data.url : `http://${data.url}`;
          
          let requestBody = data.method !== 'GET' ? data.body : undefined;
          let requestParams = data.method === 'GET' ? data.queryParams : undefined;

          if (data.useInputAsBody && data.method !== 'GET' && inputData) {
            requestBody = inputData;
          }

          const response = await axios({
            method: data.method.toLowerCase(),
            url,
            headers: data.headers,
            params: requestParams,
            data: requestBody,
          });
          
          result = response.data;
          break;
        }
        
        case 'llm': {
          const data = node.data as LLMNodeData;
          
          // Combine parent results as plain text
          const inputs = Object.values(parentResults).join('\n\n');
          
          let prompt = data.prompt;
          if (inputs) {
            prompt = `${prompt}\n\nInput:\n${inputs}`;
          }

          if (data.provider === 'ollama') {
            const response = await axios.post(`${data.ollamaUrl || 'http://localhost:11434'}/api/generate`, {
              model: data.model,
              prompt: prompt,
              stream: false,
              temperature: data.temperature === undefined ? 0.7 : data.temperature
            });

            const content = response.data.response;
            result = {
              content: content,
              model: data.model,
              provider: data.provider
            };
          } else if (data.provider === 'openai') {
            setNodeState(nodeId, { 
              status: 'error', 
              result: null, 
              error: 'OpenAI implementation pending' 
            });
            throw new Error('OpenAI implementation pending');
          } else {
            setNodeState(nodeId, { 
              status: 'error', 
              result: null, 
              error: `Unknown LLM provider: ${data.provider}` 
            });
            throw new Error(`Unknown LLM provider: ${data.provider}`);
          }
          break;
        }
        
        case 'output': {
          // Output node should display text content from parent immediately
          const parentContent = parentResults[Object.keys(parentResults)[0]];
          result = parentContent;
          break;
        }

        case 'json-extractor': {
          const input = parentResults[Object.keys(parentResults)[0]];
          if (!input) {
            setNodeState(nodeId, { 
              status: 'error', 
              result: null, 
              error: 'No input data received for JSON extraction.' 
            });
            throw new Error('No input data received');
          }
          try {
            result = extractValue(input, node.data.path);
          } catch(extractError: any) {
            setNodeState(nodeId, { 
              status: 'error', 
              result: null, 
              error: `JSON Extraction failed: ${extractError.message}` 
            });
            throw extractError;
          }
          break;
        }

        // Add case for Input Node
        case 'input': {
          result = node.data.text;
          break;
        }

        default:
          setNodeState(nodeId, { 
            status: 'error',
            result: null,
            error: `Unsupported node type for execution: ${node.type}` 
          });
          throw new Error(`Unsupported node type: ${node.type}`);
      }

      // --- Execution successful --- 
      console.log(`Node ${nodeId}: Execution successful`);
      setNodeState(nodeId, { 
        status: 'success', 
        result: result, 
        error: undefined 
      });

      // --- Update connected Output Nodes on Success ---
      const connectedEdgesSuccess = edges.filter(e => e.source === nodeId);
      connectedEdgesSuccess.forEach(edge => {
        const targetNode = nodes.find(n => n.id === edge.target);
        if (targetNode?.type === 'output') {
          // Pass the *entire* result object from the parent node
          // The Output node component itself will handle formatting based on its toggle state
          setNodeState(edge.target, {
            status: 'success',
            result: result, // Pass the original result object
            error: undefined
          });
        }
      });

      // For LLM nodes, only return the content when passing to downstream nodes
      if (node.type === 'llm' && result?.content) {
        return result.content;
      }
      return result;

    } catch (error: any) {
      console.error(`Node ${nodeId}: Execution failed`, error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setNodeState(nodeId, { 
        status: 'error', 
        result: null, 
        error: errorMessage 
      });

      // --- Update connected Output Nodes on Error ---
      const connectedEdgesError = edges.filter(e => e.source === nodeId);
      connectedEdgesError.forEach(edge => {
        const targetNode = nodes.find(n => n.id === edge.target);
        if (targetNode?.type === 'output') {
          // Keep error state update as is
          setNodeState(edge.target, {
            status: 'error',
            result: `Error from ${node.data.label || node.id}`, 
            error: errorMessage
          });
        }
      });

      // Rethrow the error to stop the flow execution down this path
      throw error;
    }
  },

  executeFlow: async (startNodeId: string) => {
    const { resetNodeStates, nodes, edges, setNodes, setEdges } = get();
    
    // Update nodes/edges from store
    const currentNodes = store.getState().flow.nodes;
    const currentEdges = store.getState().flow.edges;
    setNodes(currentNodes);
    setEdges(currentEdges);

    console.log(`Executing flow starting from node: ${startNodeId}`);
    
    // Only reset states for nodes in the execution path
    const downstreamNodes = get().getDownstreamNodes(startNodeId);
    const nodesToReset = [startNodeId, ...downstreamNodes];
    
    // Reset only affected nodes
    const { nodeStates } = get();
    const newNodeStates = { ...nodeStates };
    nodesToReset.forEach(nodeId => {
      delete newNodeStates[nodeId];
    });
    set({ nodeStates: newNodeStates });
    
    set({ isExecuting: true });

    try {
      // Execute the start node and wait for completion
      await get().executeNode(startNodeId);
      
      // Execute downstream nodes in sequence
      for (const nodeId of downstreamNodes) {
        try {
          await get().executeNode(nodeId);
        } catch (error) {
          console.error(`Error executing downstream node ${nodeId}:`, error);
          // Continue with other nodes
        }
      }
      
      console.log(`Flow execution completed from ${startNodeId}`);
    } catch (error: any) {
      console.error(`Flow execution failed starting from ${startNodeId}:`, error);
    } finally {
      set({ isExecuting: false });
    }
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