/**
 * LLM 서비스 인터페이스 및 함수
 */

import { ollamaService } from './ollamaService';
import { openaiService } from './openaiService';
import { LLMRequestParams, LLMServiceResponse } from './llm/types'; // Import new standard types

/**
 * LLM 호출 디스패처 함수 (Facade)
 * Provider에 따라 적절한 서비스의 generate 메서드를 호출합니다.
 * 
 * @param params - 표준 LLM 요청 파라미터 (LLMRequestParams)
 * @returns 표준 LLM 응답 (LLMServiceResponse)
 */
export async function runLLM(params: LLMRequestParams): Promise<LLMServiceResponse> {
  const { provider, model } = params;
  console.log(`LLM 디스패처 호출: ${provider}, ${model}`);

  switch (provider) {
    case 'ollama':
      // Pass the entire params object to the service's generate method
      return await ollamaService.generate(params);
    case 'openai':
      // Pass the entire params object to the service's generate method
      // API Key check should ideally happen within the service or earlier
      if (!params.openaiApiKey) {
        console.warn('OpenAI API key is missing in runLLM params. The service might throw an error.');
        // Consider throwing an error here or letting the service handle it
      }
      return await openaiService.generate(params);
    default:
      console.error(`지원하지 않는 LLM provider: ${provider}`);
      throw new Error(`Unsupported LLM provider: ${provider}`);
  }
} 