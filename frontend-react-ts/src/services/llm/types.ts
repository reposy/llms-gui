/**
 * Defines standard types and interfaces for LLM service interactions.
 */

import { FileMetadata, LocalFileMetadata } from '../../types/files';

/**
 * Common parameters for requesting LLM generation.
 */
export interface LLMRequestParams {
  provider: 'ollama' | 'openai'; // LLM 서비스 제공자
  model: string;                 // 모델 이름
  prompt: string;                // 프롬프트 텍스트
  
  // 선택적 파라미터
  temperature?: number;          // 온도 (창의성 설정)
  maxTokens?: number;            // 최대 토큰 수
  mode?: 'text' | 'vision';      // 텍스트 또는 비전 모드
  
  // 이미지 데이터 소스 (중요: 항상 하나의 소스만 사용해야 함)
  imageMetadata?: FileMetadata[]; // 서버에 저장된 파일 메타데이터 (우선순위 1)
  localImages?: LocalFileMetadata[]; // 로컬 메모리 저장 파일 메타데이터 (우선순위 2) 
  inputFiles?: File[];           // 기존 방식 File 객체 (우선순위 3, 하위 호환성용)
  
  // 서비스별 설정
  ollamaUrl?: string;            // Ollama 서버 URL
  openaiApiKey?: string;         // OpenAI API 키
  
  // 기타 서비스별 파라미터
  [key: string]: any;
}

/**
 * Standard response structure from an LLM service call.
 */
export interface LLMServiceResponse {
  response: string;              // 텍스트 응답
  usage?: {                      // 선택적 사용량 정보
    promptTokens?: number;       // 프롬프트 토큰 수
    completionTokens?: number;   // 응답 토큰 수
    totalTokens?: number;        // 총 토큰 수
  };
  raw?: any;                     // 원시 응답 데이터 (디버깅용)
  // Optional: Include additional metadata if needed later
  // e.g., modelUsed: string;
}

/**
 * Interface that all specific LLM provider services (Ollama, OpenAI, etc.) must implement.
 */
export interface LLMProviderService {
  /**
   * Generates text based on the provided parameters.
   * @param params - The request parameters.
   * @returns A promise that resolves with the standardized LLM service response.
   * @throws {Error} If the generation fails.
   */
  generate(params: LLMRequestParams): Promise<LLMServiceResponse>;
}

// You might also define specific error types here later, e.g.:
// export class LLMServiceError extends Error { ... } 