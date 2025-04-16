import { LLMNodeData, LLMResult } from '../types/nodes';
import { callOllama } from './llm/ollamaClient';

export async function executeOllamaNode(data: LLMNodeData): Promise<LLMResult> {
  const { ollamaUrl = 'http://localhost:11434', model, prompt, temperature } = data;
  
  try {
    // Use the new Ollama client
    const response = await callOllama({
      model,
      prompt,
      temperature,
      baseUrl: ollamaUrl
    });
    
    return {
      content: response,
      text: response,
      raw: { response }
    };
  } catch (error) {
    console.error(`Ollama API error: ${error}`);
    throw new Error(`Ollama API error: ${error instanceof Error ? error.message : String(error)}`);
  }
} 