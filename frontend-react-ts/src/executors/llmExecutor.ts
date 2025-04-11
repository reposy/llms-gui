import { Node } from 'reactflow';
import axios from 'axios';
import { LLMNodeData, NodeType, LLMResult } from '../types/nodes'; // Adjusted import
import { ExecutionContext, NodeState } from '../types/execution';
import { getNodeContent, LLMNodeContent } from '../store/useNodeContentStore';
import { resolveTemplate } from '../utils/executionUtils';

// Define the expected parameters for the executor
interface ExecuteLlmNodeParams {
  node: Node<LLMNodeData>;
  input: any;
  context: ExecutionContext;
  setNodeState: (nodeId: string, state: Partial<NodeState>) => void;
  resolveTemplate: (template: string, data: any, context?: any) => string;
}

// Interface for LLM API call
interface CallLlmParams {
  prompt: string;
  system?: string;
  config: any;
  executionId: string;
}

/**
 * Executes an LLM node.
 * Supports a variety of LLM APIs including OpenAI, Anthropic, etc.
 */
export async function executeLlmNode(params: ExecuteLlmNodeParams): Promise<any> {
  const { node, input, context, resolveTemplate } = params;
  const { executionId, executionMode, iterationItem, iterationTracking } = context;
  const nodeId = node.id;
  const nodeData = node.data;
  
  console.log(`[LlmExecutor] (${nodeId}) Executing with execution ID: ${executionId}`);
  
  // Check for missing execution mode and use fallback
  if (!executionMode) {
    console.warn(`[LlmExecutor] (${nodeId}) WARNING: executionMode is missing in context! Using standard mode as fallback`);
    // Handle array inputs as batch mode even if not explicitly set
    if (Array.isArray(input) && input.length > 0) {
      console.log(`[LlmExecutor] (${nodeId}) Detected array input, treating as batch mode despite missing executionMode`);
      // We can't modify the context type directly due to TypeScript constraints
      // But we ensure it's handled as if in batch mode
      context.inputRows = input;
    }
  } else {
    console.log(`[LlmExecutor] (${nodeId}) Execution mode: ${executionMode}`);
  }
  
  // Log more detailed information about inputs, especially for batch mode
  if (executionMode === 'batch') {
    console.log(`[LlmExecutor] (${nodeId}) Operating in BATCH mode`);
    if (Array.isArray(input)) {
      console.log(`[LlmExecutor] (${nodeId}) Received array input with ${input.length} items for batch processing:`, input);
    } else if (context.inputRows && Array.isArray(context.inputRows)) {
      console.log(`[LlmExecutor] (${nodeId}) Found inputRows in context with ${context.inputRows.length} items:`, context.inputRows);
    } else {
      console.log(`[LlmExecutor] (${nodeId}) Input in batch mode is not an array:`, input);
    }

    // Additional check for inputRows in context
    if (!Array.isArray(input) && (!context.inputRows || !Array.isArray(context.inputRows))) {
      console.warn(`[LlmExecutor] (${nodeId}) WARNING: Batch mode but no array input or inputRows found!`);
    }
  } else {
    console.log(`[LlmExecutor] (${nodeId}) Input value:`, input);
  }
  
  if (iterationItem !== undefined) {
    console.log(`[LlmExecutor] (${nodeId}) Iteration item:`, iterationItem);
  }
  
  if (iterationTracking) {
    console.log(`[LlmExecutor] (${nodeId}) Iteration tracking:`, iterationTracking);
  }
  
  // Get node content from nodeContentStore first, then fall back to node.data
  const nodeContent = getNodeContent(nodeId) as LLMNodeContent;
  
  // Detailed logging for debugging
  console.log(`[LlmExecutor] (${nodeId}) Node content store data:`, nodeContent);
  console.log(`[LlmExecutor] (${nodeId}) Node.data:`, nodeData);
  
  // Get prompt from content store first, fall back to node.data if not available
  const prompt = nodeContent?.prompt || nodeData.prompt || '';
  // Optional system message (not in the current content model)
  const system = '';
  
  console.log(`[LlmExecutor] (${nodeId}) Content source:`, nodeContent?.prompt ? 'nodeContentStore' : (nodeData.prompt ? 'node.data' : 'default empty'));
  console.log(`[LlmExecutor] (${nodeId}) Final prompt template to use:`, prompt);
  
  try {
    console.log(`[LlmExecutor] (${nodeId}) Template string: "${prompt}"`);
    
    // Check if we're in an iteration context and log it clearly
    if (context.executionMode === 'iteration-item' && context.iterationItem !== undefined) {
      console.log(`[LlmExecutor] (${nodeId}) Processing as ITERATION-ITEM with value:`, context.iterationItem);
    }
    
    // Make sure to call resolveTemplate with the correct parameters:
    // - First parameter is the template string
    // - Second parameter is the input data that {{input}} should resolve to
    // - Third parameter is the execution context with batch/foreach info
    const resolvedPrompt = resolveTemplate(prompt, input, context);
    const resolvedSystem = system ? resolveTemplate(system, input, context) : "";
    
    console.log(`[LlmExecutor] (${nodeId}) Template: ${prompt}`);
    console.log(`[LlmExecutor] (${nodeId}) Resolved prompt: "${resolvedPrompt}"`);
    if (resolvedSystem) {
      console.log(`[LlmExecutor] (${nodeId}) Resolved system: ${resolvedSystem}`);
    }
    
    // If no prompt provided, or blank after template resolution, return null
    if (!resolvedPrompt.trim()) {
      console.log(`[LlmExecutor] (${nodeId}) Empty prompt after resolution, returning null`);
      return null;
    }
    
    // Execute LLM call
    const llmResult = await callLlm({
      prompt: resolvedPrompt,
      system: resolvedSystem,
      config: {
        provider: nodeContent?.provider || nodeData.provider || 'ollama', 
        model: nodeContent?.model || nodeData.model || 'llama3',
        temperature: nodeContent?.temperature ?? nodeData.temperature ?? 0.7,
        ollamaUrl: nodeContent?.ollamaUrl || nodeData.ollamaUrl || 'http://localhost:11434'
      },
      executionId
    });
    
    console.log(`[LlmExecutor] (${nodeId}) LLM Result:`, llmResult);
    return llmResult;
    
  } catch (error: unknown) {
    console.error(`[LlmExecutor] (${nodeId}) Error:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`LLM execution failed: ${errorMessage}`);
  }
}

/**
 * Implementation of the callLlm function to handle different LLM providers
 */
async function callLlm(params: CallLlmParams): Promise<any> {
  const { prompt, system, config, executionId } = params;
  const provider = config.provider || 'ollama';
  const model = config.model || 'llama3';
  const temperature = config.temperature !== undefined ? config.temperature : 0.7;
  
  console.log(`[callLlm] Executing with provider: ${provider}, model: ${model}`);
  
  // Handle different providers
  if (provider === 'ollama') {
    return await callOllamaLlm(prompt, model, temperature, config.ollamaUrl);
  } else if (provider === 'openai') {
    return await callOpenAILlm(prompt, system || '', model, temperature, config.apiKey);
  } else {
    throw new Error(`Unsupported LLM provider: ${provider}`);
  }
}

/**
 * Call Ollama API
 */
async function callOllamaLlm(prompt: string, model = 'llama3', temperature: number, baseUrl?: string): Promise<any> {
  const ollamaUrl = baseUrl || 'http://localhost:11434';
  console.log(`[callOllamaLlm] Calling Ollama API at ${ollamaUrl}`);
  
  try {
    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        prompt: prompt,
        stream: false,
        temperature: temperature,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      text: data.response,
      model: model,
      provider: 'ollama',
    };
  } catch (error: unknown) {
    console.error('Error calling Ollama API:', error);
    throw error;
  }
}

/**
 * Call OpenAI API
 */
async function callOpenAILlm(prompt: string, system: string, model: string, temperature: number, apiKey?: string): Promise<any> {
  if (!apiKey) {
    throw new Error('OpenAI API key is required');
  }
  
  console.log(`[callOpenAILlm] Calling OpenAI API for model ${model}`);
  
  try {
    const messages = [];
    
    if (system) {
      messages.push({
        role: 'system',
        content: system
      });
    }
    
    messages.push({
      role: 'user',
      content: prompt
    });
    
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: model,
        messages: messages,
        temperature: temperature,
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    return {
      text: response.data.choices[0].message.content,
      model: model,
      provider: 'openai',
      raw: response.data
    };
  } catch (error: unknown) {
    console.error('Error calling OpenAI API:', error);
    throw error;
  }
}

export async function executeLlmNodeOld(params: {
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