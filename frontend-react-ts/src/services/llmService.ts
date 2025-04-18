/**
 * LLM 서비스 인터페이스 및 함수
 */

import { callOllama } from './ollamaService';
import { callOpenAI } from './openaiService';

/**
 * LLM 호출 파라미터 인터페이스 (공통)
 */
export interface RunLLMParams {
  provider: string;
  model: string;
  prompt: string;
  temperature: number;
  ollamaUrl?: string;
  openaiApiKey?: string;
  images?: string[];
}

/**
 * LLM 응답 인터페이스 (공통)
 */
export interface LLMResponse {
  response: string;
  raw?: any;
}

/**
 * LLM 호출 디스패처 함수
 * Provider에 따라 적절한 서비스 호출
 */
export async function runLLM({
  provider,
  model,
  prompt,
  temperature,
  ollamaUrl = 'http://localhost:11434', // Default Ollama URL if not provided
  openaiApiKey,
  images
}: RunLLMParams): Promise<LLMResponse> {
  console.log(`LLM 디스패처 호출: ${provider}, ${model}`);
  switch (provider) {
    case 'ollama':
      return await callOllama({
        model,
        prompt,
        temperature,
        ollamaUrl, // Pass the specific URL
        images
      });
    case 'openai':
      // API Key check is done within callOpenAI now
      return await callOpenAI({
        model,
        prompt,
        temperature,
        apiKey: openaiApiKey || '' // Pass API key or empty string (callOpenAI handles the check)
      });
    default:
      console.error(`지원하지 않는 LLM provider: ${provider}`);
      throw new Error(`Unsupported LLM provider: ${provider}`);
  }
} 