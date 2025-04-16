import { callOllama } from './llm/ollamaClient';

interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  stream?: boolean;
  options?: {
    temperature?: number;
  };
}

interface OllamaGenerateResponse {
  model: string;
  response: string;
  done: boolean;
}

/**
 * @deprecated Use callOllama from './llm/ollamaClient' instead
 */
export async function generateOllamaResponse(
  model: string,
  prompt: string,
  temperature?: number,
  baseUrl: string = 'http://localhost:11434'
): Promise<string> {
  try {
    // Use the new unified Ollama client
    return await callOllama({
      model,
      prompt,
      temperature,
      baseUrl
    });
  } catch (error) {
    console.error('Error calling Ollama API:', error);
    throw error;
  }
} 