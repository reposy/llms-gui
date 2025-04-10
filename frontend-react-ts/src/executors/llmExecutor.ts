import { Node } from 'reactflow';
import axios from 'axios';
import { LLMNodeData, NodeType, LLMResult } from '../types/nodes'; // Adjusted import
import { ExecutionContext, NodeState } from '../types/execution';
import { getNodeContent, LLMNodeContent } from '../store/useNodeContentStore';

export async function executeLlmNode(params: {
  node: Node<LLMNodeData>;
  input: any;
  context: ExecutionContext;
  setNodeState: (nodeId: string, state: Partial<NodeState>) => void;
  resolveTemplate: (template: string, data: any, context?: any) => string;
}): Promise<LLMResult> {
  const { node, input, context, setNodeState, resolveTemplate } = params;
  const { executionId } = context;
  const nodeId = node.id;

  console.log(`[LLM Executor] Executing LLM node ${nodeId}...`);
  console.log(`[LLM Executor] Input:`, input);

  // Start executing and update state
  setNodeState(nodeId, {
    status: 'running',
    executionId,
    error: undefined,
    result: undefined, // Clear any previous result
  });

  try {
    // Get content from node content store
    const nodeContent = getNodeContent(nodeId) as LLMNodeContent;
    if (!nodeContent) {
      throw new Error('LLM node content not found in store.');
    }

    // Prepare prompt, replacing any {{input}} placeholders with actual input
    let promptText = nodeContent.prompt || '';
    
    // Replace placeholders using resolveTemplate utility
    promptText = resolveTemplate(promptText, input, context);

    console.log(`[LLM Executor] Using model "${nodeContent.model}" with temperature ${nodeContent.temperature}`);
    console.log(`[LLM Executor] Processed prompt:`, promptText);

    // Prepare model settings
    const provider = nodeContent.provider || 'ollama';
    const model = nodeContent.model || 'llama3';
    const temperature = nodeContent.temperature !== undefined ? nodeContent.temperature : 0.7;
    const ollamaUrl = nodeContent.ollamaUrl || 'http://localhost:11434';

    // LLM Call implementation based on provider
    let result: string;
    
    if (provider === 'ollama') {
      // Ollama API call
      console.log(`[LLM Executor] Calling Ollama API at ${ollamaUrl} for model ${model}`);
      
      try {
        const response = await fetch(`${ollamaUrl}/api/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: model,
            prompt: promptText,
            stream: false,
            temperature: temperature,
          }),
        });

        if (!response.ok) {
          throw new Error(`Ollama API returned ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        result = data.response;
        
        // Successful result handling
        console.log(`[LLM Executor] Received result for ${nodeId}:`, result.substring(0, 100) + (result.length > 100 ? '...' : ''));
      } catch (error: any) {
        console.error(`[LLM Executor] API error for ${nodeId}:`, error);
        throw new Error(`Ollama API error: ${error.message}`);
      }
    } else if (provider === 'openai') {
      // OpenAI integration would go here
      throw new Error('OpenAI provider not yet implemented');
    } else {
      throw new Error(`Unknown provider: ${provider}`);
    }

    // Update state with success
    setNodeState(nodeId, {
      status: 'success',
      result: {
        text: result,
        model: model,
        provider: provider,
      },
      _lastUpdate: Date.now(), // Use _lastUpdate instead of executionTime
    });

    return {
      text: result,
      model: model,
      provider: provider,
    };
  } catch (error: any) {
    console.error(`[LLM Executor] Error executing LLM node ${nodeId}:`, error);
    
    // Update state with error
    setNodeState(nodeId, {
      status: 'error',
      error: error.message || 'Unknown error executing LLM model',
      _lastUpdate: Date.now(), // Use _lastUpdate instead of executionTime
    });
    
    throw error;
  }
} 