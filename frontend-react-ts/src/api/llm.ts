import axios from 'axios';
import { LLMNodeData } from '../types/nodes';
import { callOllama, callOllamaVision } from '../utils/llm/ollamaClient';
import { callOpenAI, callOpenAIVision } from '../utils/llm/openaiClient';

export type LLMProvider = 'ollama' | 'openai';
export type LLMMode = 'text' | 'vision';

// Interface for LLM requests
export interface LLMRequest {
  prompt: string;
  model: string;
  provider: LLMProvider;
  mode?: LLMMode;
  inputImage?: File | Blob;
  temperature?: number;
  ollamaUrl?: string;
  openaiApiKey?: string;
}

// Interface for LLM responses
export interface LLMResponse {
  response: string;
  mode?: LLMMode;
  model?: string;
  raw?: any;
}

// Ollama response structure
interface OllamaResponse {
  response: string;
  context?: number[];
  created_at: string;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_duration?: number;
  eval_duration?: number;
  eval_count?: number;
}

// OpenAI response structure
interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
    index: number;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Execute an LLM node with the appropriate provider
 */
export async function executeNode(data: LLMNodeData): Promise<string> {
  if (!data.prompt) {
    throw new Error('프롬프트를 입력해주세요.');
  }

  if (!data.model) {
    throw new Error('모델을 선택해주세요.');
  }

  try {
    const result = await runLLM({
      provider: data.provider,
      model: data.model,
      prompt: data.prompt,
      temperature: data.temperature,
      ollamaUrl: data.ollamaUrl,
      // Add more parameters as needed
    });
    
    return result.response;
  } catch (error) {
    console.error('LLM execution error:', error);
    throw error;
  }
}

/**
 * Get available models for a given provider
 */
export async function getAvailableModels(provider: LLMProvider): Promise<string[]> {
  if (provider === 'openai') {
    return [
      'gpt-4',
      'gpt-4-turbo',
      'gpt-4-vision-preview',
      'gpt-3.5-turbo'
    ];
  } else if (provider === 'ollama') {
    // For Ollama, get models from the API if possible
    try {
      const baseUrl = 'http://localhost:11434';
      const response = await axios.get(`${baseUrl}/api/tags`);
      if (response.data && Array.isArray(response.data.models)) {
        return response.data.models.map((model: any) => model.name);
      }
    } catch (error) {
      console.warn('Failed to fetch Ollama models:', error);
    }
    
    // Default models if API call fails
    return [
      'llama3',
      'mistral',
      'gemma:7b', 
      'llava'
    ];
  }

  return [];
}

/**
 * Check if a model supports vision/image input
 */
export function isVisionModel(provider: LLMProvider, model: string): boolean {
  if (provider === 'openai') {
    return model.includes('vision') || model.includes('gpt-4-turbo') || model.includes('gpt-4-vision');
  } else if (provider === 'ollama') {
    return model.toLowerCase().includes('llava') || 
           model.toLowerCase().includes('vision') || 
           model.toLowerCase().includes('bakllava') ||
           model.toLowerCase().includes('gemma3') ||
           model.toLowerCase().includes('gemma:3');
  }
  
  return false;
}

/**
 * Main LLM processing function that handles both text and vision models
 * across different providers
 */
export const runLLM = async (request: LLMRequest): Promise<LLMResponse> => {
  const { 
    provider, 
    model, 
    prompt, 
    mode = 'text',
    inputImage,
    temperature = 0.7,
    ollamaUrl = 'http://localhost:11434',
    openaiApiKey
  } = request;

  if (!prompt || !model || !provider) {
    throw new Error('Required parameters (prompt, model, provider) are missing');
  }
  
  try {
    // Text mode for all providers
    if (provider === 'ollama') {
      const response = await callOllama({
        model,
        prompt,
        temperature,
        baseUrl: ollamaUrl,
        logger: console.log
      });
      
      return { 
        response,
        mode: 'text',
        model
      };
    } else if (provider === 'openai') {
      if (!openaiApiKey) {
        throw new Error('OpenAI API key is required for OpenAI provider');
      }
      
      const response = await callOpenAI({
        model,
        prompt,
        temperature,
        apiKey: openaiApiKey,
        logger: console.log
      });
      
      return { 
        response,
        mode: 'text',
        model
      };
    }
    
    throw new Error(`Unsupported provider (${provider})`);
  } catch (error) {
    console.error(`${provider.toUpperCase()} API 호출 중 오류:`, error);
    throw error;
  }
} 