import axios from 'axios';
import { LLMNodeData } from '../types/nodes';

export type LLMProvider = 'ollama' | 'openai';

interface LLMRequest {
  prompt: string;
  model: string;
  provider?: LLMProvider;
  config?: Record<string, any>;
}

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

export async function executeNode(data: LLMNodeData): Promise<string> {
  if (!data.prompt) {
    throw new Error('프롬프트를 입력해주세요.');
  }

  if (!data.model) {
    throw new Error('모델을 선택해주세요.');
  }

  if (data.provider === 'ollama') {
    const response = await axios.post<OllamaResponse>(
      `${data.ollamaUrl || 'http://localhost:11434'}/api/generate`,
      {
        model: data.model,
        prompt: data.prompt,
        temperature: data.temperature,
        stream: false,
      }
    );
    return response.data.response;
  } else if (data.provider === 'openai') {
    const response = await axios.post<OpenAIResponse>(
      'https://api.openai.com/v1/chat/completions',
      {
        model: data.model,
        messages: [
          {
            role: 'user',
            content: data.prompt,
          },
        ],
        temperature: data.temperature,
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data.choices[0].message.content;
  }

  throw new Error('지원하지 않는 LLM 제공자입니다.');
}

export async function getAvailableModels(provider: LLMProvider): Promise<string[]> {
  if (provider === 'openai') {
    return ['gpt-4', 'gpt-3.5-turbo'];
  }

  // For Ollama, return an empty array as models should be manually input
  return [];
}

export const runLLM = async (request: LLMRequest): Promise<LLMResponse> => {
  // OpenAI API 키는 환경 변수에서 가져와야 합니다
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  
  try {
    // OpenAI API 엔드포인트
    const endpoint = 'https://api.openai.com/v1/chat/completions';
    
    const response = await axios.post(
      endpoint,
      {
        model: request.model === 'gpt-4' ? 'gpt-4' : 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: request.prompt,
          },
        ],
        temperature: 0.7,
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return {
      response: response.data.choices[0].message.content,
    };
  } catch (error) {
    console.error('OpenAI API 호출 중 오류:', error);
    throw new Error('LLM 처리 중 오류가 발생했습니다.');
  }
}; 