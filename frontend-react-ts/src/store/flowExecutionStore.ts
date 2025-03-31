import { create } from 'zustand';
import { Edge, Node } from 'reactflow';
import { LLMNodeData, NodeData, NodeExecutionStateData, OutputNodeData, APINodeData } from '../types/nodes';

interface FlowExecutionState {
  nodeStates: Record<string, NodeExecutionStateData>;
  executingNodes: Set<string>;
  completedNodes: Set<string>;
  parentCompletionCount: Record<string, number>;
}

interface FlowExecutionStore extends FlowExecutionState {
  // Node state management
  getNodeState: (nodeId: string) => NodeExecutionStateData;
  setNodeState: (nodeId: string, state: NodeExecutionStateData) => void;
  resetExecution: () => void;
  
  // Flow execution
  executeFlow: (nodes: Node<NodeData>[], edges: Edge[]) => Promise<void>;
  executeNode: (node: Node<NodeData>, edges: Edge[], nodes: Node<NodeData>[]) => Promise<void>;
  
  // Helper functions
  isRootNode: (nodeId: string, edges: Edge[]) => boolean;
  getChildNodes: (nodeId: string, edges: Edge[], nodes: Node<NodeData>[]) => Node<NodeData>[];
  getConnectedOutputs: (nodeId: string, edges: Edge[], nodes: Node<NodeData>[]) => Node<OutputNodeData>[];
  getParentNodes: (nodeId: string, edges: Edge[], nodes: Node<NodeData>[]) => Node<NodeData>[];
  areAllParentsCompleted: (nodeId: string, edges: Edge[]) => boolean;
  buildChainedPrompt: (node: Node<LLMNodeData>, parentNodes: Node<NodeData>[], nodeStates: Record<string, NodeExecutionStateData>) => string;
}

const initialState: FlowExecutionState = {
  nodeStates: {},
  executingNodes: new Set(),
  completedNodes: new Set(),
  parentCompletionCount: {},
};

export const useFlowExecution = create<FlowExecutionStore>((set, get) => ({
  ...initialState,

  getNodeState: (nodeId) => {
    return get().nodeStates[nodeId] || { status: 'idle' };
  },

  setNodeState: (nodeId, state) => {
    set((prev) => ({
      nodeStates: { ...prev.nodeStates, [nodeId]: state },
    }));
  },

  resetExecution: () => {
    set(initialState);
  },

  isRootNode: (nodeId, edges) => {
    return !edges.some(edge => edge.target === nodeId);
  },

  getChildNodes: (nodeId, edges, nodes) => {
    const childEdges = edges.filter(edge => edge.source === nodeId);
    return childEdges
      .map(edge => nodes.find(node => node.id === edge.target))
      .filter((node): node is Node<NodeData> => node !== undefined && node.data.type !== 'output');
  },

  getConnectedOutputs: (nodeId, edges, nodes) => {
    const outputEdges = edges.filter(edge => edge.source === nodeId);
    return outputEdges
      .map(edge => nodes.find(node => node.id === edge.target))
      .filter((node): node is Node<OutputNodeData> => 
        node !== undefined && node.data.type === 'output'
      );
  },

  getParentNodes: (nodeId, edges, nodes) => {
    const parentEdges = edges.filter(edge => edge.target === nodeId);
    return parentEdges
      .map(edge => nodes.find(node => node.id === edge.source))
      .filter((node): node is Node<NodeData> => node !== undefined);
  },

  areAllParentsCompleted: (nodeId, edges) => {
    const parentEdges = edges.filter(edge => edge.target === nodeId);
    const { completedNodes } = get();
    return parentEdges.every(edge => completedNodes.has(edge.source));
  },

  buildChainedPrompt: (node: Node<LLMNodeData>, parentNodes: Node<NodeData>[], nodeStates: Record<string, NodeExecutionStateData>) => {
    const parts: string[] = [];

    // Add parent results in order of edges
    parentNodes.forEach((parentNode, index) => {
      const parentState = nodeStates[parentNode.id];
      if (!parentState?.result) return;

      const result = parentState.result;
      const content = typeof result === 'string' 
        ? result 
        : result.content || result.text || JSON.stringify(result);

      parts.push(`[Input ${String.fromCharCode(65 + index)}]\n${content.trim()}\n`);
    });

    // Add original prompt at the end
    if (parts.length > 0) {
      parts.push(`\nPrompt: ${node.data.prompt.trim()}`);
    } else {
      parts.push(node.data.prompt.trim());
    }

    return parts.join('\n\n');
  },

  executeNode: async (node, edges, nodes) => {
    const {
      setNodeState,
      getChildNodes,
      getConnectedOutputs,
      getParentNodes,
      areAllParentsCompleted,
      buildChainedPrompt,
      executingNodes,
      completedNodes,
      nodeStates
    } = get();

    // Skip if already executing or completed
    if (executingNodes.has(node.id) || completedNodes.has(node.id)) {
      return;
    }

    // For non-root nodes, check if all parents are completed
    if (!get().isRootNode(node.id, edges) && !areAllParentsCompleted(node.id, edges)) {
      return;
    }

    // Mark node as executing
    set(state => ({
      executingNodes: new Set([...state.executingNodes, node.id])
    }));

    // Set node and connected outputs to running state
    setNodeState(node.id, {
      status: 'running',
      timestamp: Date.now()
    });

    // Set all connected output nodes to running state
    const outputNodes = getConnectedOutputs(node.id, edges, nodes);
    outputNodes.forEach(outputNode => {
      setNodeState(outputNode.id, {
        status: 'running',
        timestamp: Date.now()
      });
    });

    try {
      // Execute based on node type
      if (node.data.type === 'llm') {
        const llmData = node.data as LLMNodeData;
        
        // Get parent nodes and build chained prompt
        const parentNodes = getParentNodes(node.id, edges, nodes);
        const chainedPrompt = buildChainedPrompt(node as Node<LLMNodeData>, parentNodes, nodeStates);
        
        // Execute LLM with chained prompt
        const result = await (llmData.provider === 'ollama' 
          ? executeOllamaNode({ ...llmData, prompt: chainedPrompt })
          : executeOpenAINode({ ...llmData, prompt: chainedPrompt }));

        // Update LLM node state
        setNodeState(node.id, {
          status: 'completed',
          result,
          timestamp: Date.now()
        });

        // Update all connected output nodes with the result
        outputNodes.forEach(outputNode => {
          setNodeState(outputNode.id, {
            status: 'completed',
            result,
            timestamp: Date.now()
          });
        });

        // Mark as completed
        set(state => ({
          completedNodes: new Set([...state.completedNodes, node.id])
        }));

        // Get non-output child nodes and execute them if all their parents are completed
        const childNodes = getChildNodes(node.id, edges, nodes);
        await Promise.all(
          childNodes.map(async childNode => {
            if (areAllParentsCompleted(childNode.id, edges)) {
              await get().executeNode(childNode, edges, nodes);
            }
          })
        );
      } else if (node.data.type === 'api') {
        const apiData = node.data as APINodeData;
        const parentResults = getParentNodes(node.id, edges, nodes).reduce((acc, parentNode) => {
          const parentState = get().nodeStates[parentNode.id];
          if (parentState?.result !== undefined) {
            acc[parentNode.id] = parentState.result;
          }
          return acc;
        }, {} as Record<string, any>);
        
        const result = await executeAPINode(node as Node<APINodeData>, parentResults);

        setNodeState(node.id, {
          status: 'completed',
          result,
          timestamp: Date.now()
        });

        // Find connected output nodes
        const outputEdges = edges.filter(edge => edge.source === node.id);
        const outputNodes = nodes.filter(n => 
          outputEdges.some(e => e.target === n.id) && 
          n.data.type === 'output'
        );

        // Update output nodes with the result
        outputNodes.forEach(outputNode => {
          setNodeState(outputNode.id, {
            status: 'completed',
            result,
            timestamp: Date.now()
          });
        });

        // Execute child nodes
        const childEdges = edges.filter(edge => edge.source === node.id);
        const childNodes = nodes.filter(n => 
          childEdges.some(e => e.target === n.id) && 
          n.data.type !== 'output'
        );

        await Promise.all(childNodes.map(child => get().executeNode(child, edges, nodes)));
      }
    } catch (error) {
      const errorState = {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: Date.now()
      } as NodeExecutionStateData;

      // Set error state for both LLM and connected output nodes
      setNodeState(node.id, errorState);
      outputNodes.forEach(outputNode => {
        setNodeState(outputNode.id, errorState);
      });
    } finally {
      // Remove from executing set
      set(state => ({
        executingNodes: new Set(
          [...state.executingNodes].filter(id => id !== node.id)
        )
      }));
    }
  },

  executeFlow: async (nodes, edges) => {
    // Reset execution state
    get().resetExecution();

    // Find all root nodes
    const rootNodes = nodes.filter(node => get().isRootNode(node.id, edges));

    // Execute all root nodes in parallel
    await Promise.all(
      rootNodes.map(node => get().executeNode(node, edges, nodes))
    );
  },
}));

// Helper functions for executing LLM nodes
async function executeOllamaNode(data: LLMNodeData) {
  const { ollamaUrl = 'http://localhost:11434', model, prompt } = data;
  
  // Log the full prompt for debugging
  console.log('Executing Ollama node with prompt:', {
    model,
    promptLength: prompt.length,
    prompt: prompt,
  });
  
  try {
    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        model, 
        prompt, 
        stream: false,
        // Add some safety parameters
        num_predict: 2048, // Limit response length
        context_window: 4096, // Maximum context window
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      
      // Handle specific error cases
      if (errorText.includes('unexpected EOF')) {
        throw new Error(`Prompt too long or malformed. Length: ${prompt.length} chars. Try reducing the input size or splitting the content.`);
      }
      
      if (errorText.includes('context window')) {
        throw new Error(`Prompt exceeds model's context window. Length: ${prompt.length} chars. Try reducing the input size.`);
      }
      
      // Log the full error details
      console.error('Ollama API error details:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        promptLength: prompt.length,
      });
      
      throw new Error(`Ollama API error (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    
    // Log successful execution
    console.log('Ollama execution successful:', {
      promptLength: prompt.length,
      responseLength: result.response.length,
      totalTokens: result.total_tokens,
    });
    
    return {
      content: result.response,
      text: result.response,
      raw: result,
    };
  } catch (error) {
    // Enhance error message with prompt details
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const enhancedError = new Error(
      `Ollama execution failed: ${errorMessage}\nPrompt length: ${prompt.length} chars`
    );
    
    // Preserve the original stack trace
    if (error instanceof Error) {
      enhancedError.stack = error.stack;
    }
    
    throw enhancedError;
  }
}

async function executeOpenAINode(data: LLMNodeData) {
  const { model, prompt } = data;
  const apiKey = process.env.REACT_APP_OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OpenAI API key is not set');
  }
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: data.temperature || 0,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.error?.message || `OpenAI API error: ${response.statusText}`);
  }

  const result = await response.json();
  return {
    content: result.choices[0].message.content,
    text: result.choices[0].message.content,
    raw: result,
  };
}

const executeAPINode = async (node: Node<APINodeData>, parentResults: Record<string, any>): Promise<any> => {
  const { data } = node;
  if (!data.url) {
    throw new Error('URL is required');
  }

  // Interpolate variables in URL, headers, and body
  const interpolateVariables = (text: string) => {
    return text.replace(/{{([^}]+)}}/g, (match, path) => {
      const [nodeId, field] = path.split('.');
      const parentResult = parentResults[nodeId];
      if (!parentResult) return match;
      
      if (field && typeof parentResult === 'object' && parentResult !== null) {
        return parentResult[field]?.toString() || match;
      }
      return typeof parentResult === 'string' 
        ? parentResult 
        : JSON.stringify(parentResult);
    });
  };

  // Ensure URL has a scheme
  let url = interpolateVariables(data.url);
  if (!url.match(/^https?:\/\//)) {
    url = `https://${url}`;
  }
  
  // Build headers with default Content-Type
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(data.headers || {})
  };
  
  Object.entries(headers).forEach(([key, value]) => {
    headers[key] = interpolateVariables(value);
  });

  // Build query parameters for GET requests
  if (data.method === 'GET' && data.bodyParams) {
    try {
      const urlObj = new URL(url);
      const enabledParams = data.bodyParams.filter(p => p.enabled && p.key);
      enabledParams.forEach(({ key, value }) => {
        urlObj.searchParams.append(key, interpolateVariables(value));
      });
      url = urlObj.toString();
    } catch (error) {
      console.error('Failed to append query parameters:', error);
    }
  }

  // Build body based on format
  let body: string | FormData | undefined;
  if (data.method && !['GET', 'HEAD'].includes(data.method)) {
    if (data.bodyFormat === 'raw') {
      body = data.body ? interpolateVariables(data.body) : undefined;
    } else if (data.bodyParams) {
      const enabledParams = data.bodyParams.filter(p => p.enabled && p.key);
      
      if (data.contentType === 'application/json') {
        const obj = enabledParams.reduce((acc, { key, value }) => ({
          ...acc,
          [key]: interpolateVariables(value)
        }), {});
        body = JSON.stringify(obj);
        headers['Content-Type'] = 'application/json';
      } else if (data.contentType === 'multipart/form-data') {
        const formData = new FormData();
        enabledParams.forEach(({ key, value }) => {
          formData.append(key, interpolateVariables(value));
        });
        body = formData;
        // Let the browser set the Content-Type for FormData
        delete headers['Content-Type'];
      } else {
        // x-www-form-urlencoded
        body = enabledParams
          .map(({ key, value }) => `${encodeURIComponent(key)}=${encodeURIComponent(interpolateVariables(value))}`)
          .join('&');
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
      }
    }
  }

  try {
    // Make the request
    const response = await fetch(url, {
      method: data.method || 'GET',
      headers,
      body,
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    // Parse response based on content type
    const contentType = response.headers.get('content-type');
    let result;
    
    if (contentType?.includes('application/json')) {
      result = await response.json();
    } else {
      result = await response.text();
    }

    // Return a structured result that can be used by child nodes
    return {
      data: result,
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      url: response.url,
      method: data.method || 'GET',
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('API execution error:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to execute API request');
  }
}; 