import { Node } from 'reactflow';
import axios from 'axios';
import { LLMNodeData, NodeType, LLMResult } from '../types/nodes'; // Adjusted import
import { ExecutionContext, NodeState } from '../types/execution';
import { getNodeContent } from '../store/nodeContentStore';

export async function executeLlmNode(params: {
  node: Node<LLMNodeData>;
  inputs: any[];
  context: ExecutionContext;
  setNodeState: (nodeId: string, state: Partial<NodeState>) => void;
  resolveTemplate: (template: string, data: any) => string;
}): Promise<any> {
  const { node, inputs, context, setNodeState, resolveTemplate } = params;
  const nodeId = node.id;
  const nodeData = node.data;
  const { executionId } = context;
  
  // Get node content from content store
  const nodeContent = getNodeContent(nodeId) || {};

  console.log(`[ExecuteNode ${nodeId}] (LLM) Executing with context:`, context, `Inputs:`, inputs);

  // --- Proceed with Execution --- 

  // Use inputs[0] as the primary data input for prompt templating
  // If called, assume it's on an active path and should use the primary input.
  const promptInput = inputs.length > 0 ? inputs[0] : {};
  console.log(`[ExecuteNode ${nodeId}] (LLM) Using prompt input:`, promptInput);
  
  // Use content from store if available, fallback to Redux data
  const promptTemplate = nodeContent.prompt || nodeData.prompt || '';
  const resolvedPrompt = resolveTemplate(promptTemplate, promptInput);
  console.log(`[ExecuteNode ${nodeId}] (LLM) Resolved prompt:`, resolvedPrompt);

  if (!resolvedPrompt) {
    // If the prompt resolves to nothing AFTER potentially passing the condition,
    // it's an error in the prompt/data, not a conditional skip.
    throw new Error("Prompt resolves to empty or null.");
  }

  let apiUrl: string;
  let requestPayload: any;
  let isDirectOllamaCall = false;
  
  // Use content from store or fallback to Redux data
  const provider = nodeContent.provider || nodeData.provider;
  const model = nodeContent.model || nodeData.model;
  const temperature = nodeContent.temperature ?? nodeData.temperature ?? 0.7;
  const ollamaUrl = nodeContent.ollamaUrl || nodeData.ollamaUrl;

  // Determine API URL and Payload based on provider and ollamaUrl presence
  if (provider === 'ollama' && ollamaUrl) {
    // Direct Ollama Call
    isDirectOllamaCall = true;
    apiUrl = `${ollamaUrl.replace(/\/$/, '')}/api/chat`; // Use chat endpoint
    requestPayload = {
      model: model, // Use the selected model
      messages: [{ role: 'user', content: resolvedPrompt }],
      stream: false, // Assuming non-streaming for now
      options: {
        temperature: temperature,
      },
    };
    console.log(`[ExecuteNode ${nodeId}] (LLM) Using Direct Ollama URL: ${apiUrl}`);
  } else {
    // Call via Proxy (/api/llm)
    apiUrl = 'http://localhost:8000/api/llm'; // Fallback proxy URL
    requestPayload = {
      provider: provider || 'ollama',
      model: model || (provider === 'openai' ? 'gpt-3.5-turbo' : 'llama2'),
      prompt: resolvedPrompt,
      temperature: temperature,
      // Conditionally include ollama_url if calling proxy for ollama
      ...(provider === 'ollama' && ollamaUrl && { ollama_url: ollamaUrl }),
    };
    console.log(`[ExecuteNode ${nodeId}] (LLM) Using Proxy URL: ${apiUrl}`);
  }

  console.log(`[ExecuteNode ${nodeId}] (LLM) Sending payload:`, requestPayload);

  try {
    const response = await axios.post(apiUrl, requestPayload);
    let output: string | undefined;

    // Parse response based on which endpoint was called
    if (isDirectOllamaCall) {
      // Direct Ollama /api/chat response structure
      output = response.data?.message?.content;
      console.log(`[ExecuteNode ${nodeId}] (LLM) Received direct Ollama output:`, output);
    } else {
      // Proxy /api/llm response structure (assuming { response: '...' })
      output = response.data?.response;
      console.log(`[ExecuteNode ${nodeId}] (LLM) Received proxy output:`, output);
    }

    if (output === undefined) {
        console.warn(`[ExecuteNode ${nodeId}] (LLM) API response did not contain expected content. Response data:`, response.data);
        throw new Error("LLM API response did not contain expected content.");
    }

    return output;

  } catch (apiError: any) {
    let errorMessage = apiError.message;
    if (apiError.response) {
      // Attempt to get more specific error from response data
      errorMessage = JSON.stringify(apiError.response.data) || `HTTP ${apiError.response.status} ${apiError.response.statusText}`;
    }
    console.error(`[ExecuteNode ${nodeId}] (LLM) API Error calling ${apiUrl}:`, errorMessage, apiError);
    throw new Error(`LLM API Error: ${errorMessage}`);
  }
} 