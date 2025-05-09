import { LLMNodeContent } from './common';

/**
 * Creates default LLMNodeContent
 */
export const createDefaultLlmNodeContent = (label?: string): LLMNodeContent => {
  return {
    label: label || 'LLM Node',
    prompt: '',
    model: 'llama3',
    temperature: 0.7,
    provider: 'ollama',
    ollamaUrl: 'http://localhost:11434',
    openaiApiKey: '',
    mode: 'text',
    responseContent: '',
    isDirty: false
  };
};

/**
 * Validates a LLM node's properties
 */
export const validateLlmNodeContent = (content: LLMNodeContent): string[] => {
  const errors: string[] = [];
  
  // Validate prompt
  if (!content.prompt || content.prompt.trim() === '') {
    errors.push('Prompt is required');
  }
  
  // Validate model
  if (!content.model || content.model.trim() === '') {
    errors.push('Model is required');
  }
  
  // Validate temperature
  if (content.temperature === undefined || 
      content.temperature < 0 || 
      content.temperature > 1) {
    errors.push('Temperature must be between 0 and 1');
  }
  
  // Validate provider
  if (!content.provider) {
    errors.push('Provider is required');
  }
  
  // Validate provider-specific properties
  if (content.provider === 'ollama' && (!content.ollamaUrl || content.ollamaUrl.trim() === '')) {
    errors.push('Ollama URL is required when using Ollama provider');
  }
  
  if (content.provider === 'openai' && (!content.openaiApiKey || content.openaiApiKey.trim() === '')) {
    errors.push('OpenAI API key is required when using OpenAI provider');
  }
  
  return errors;
};

/**
 * Truncates LLM content if too long for storage
 */
export const truncateLlmContentForStorage = (
  content: LLMNodeContent, 
  maxLength: number = 1000
): LLMNodeContent => {
  if (!content) return {
    provider: 'ollama',
    model: '',
    prompt: '',
    temperature: 0.7
  };
  
  const result = { ...content };
  
  if (content.responseContent && 
      typeof content.responseContent === 'string' && 
      content.responseContent.length > maxLength) {
    result.responseContent = `[Content truncated for storage: ${content.responseContent.length} chars]`;
  }
  
  return result;
}; 