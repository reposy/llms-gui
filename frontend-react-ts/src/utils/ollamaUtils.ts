import { LLMNodeData, LLMResult } from '../types/nodes';

export async function executeOllamaNode(data: LLMNodeData): Promise<LLMResult> {
  const { ollamaUrl = 'http://localhost:11434', model, prompt } = data;
  
  const response = await fetch(`${ollamaUrl}/api/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.statusText}`);
  }

  const result = await response.json();
  return {
    content: result.response,
    text: result.response,
    raw: result,
  };
} 