import { useCallback } from 'react';
import { createNodeDataHook } from './useNodeDataFactory';
import { LLMNodeContent, LLMMode } from '../types/nodes';

/**
 * Default values for LLM node content
 */
const LLM_DEFAULTS: Partial<LLMNodeContent> = {
  prompt: '',
  model: '',
  temperature: 0.7,
  provider: 'ollama',
  ollamaUrl: 'http://localhost:11434',
  openaiApiKey: '',
  mode: 'text',
  label: 'LLM Node',
  responseContent: ''
};

/**
 * Custom hook to manage LLM node state and operations.
 * Uses the standardized hook factory pattern.
 */
export const useLlmNodeData = ({ nodeId }: { nodeId: string }) => {
  // Use the factory to create the base hook functionality
  const { content, updateContent: updateLlmContent, createChangeHandler } = createNodeDataHook<LLMNodeContent>('llm', LLM_DEFAULTS)({ nodeId });

  // Extract properties with defaults for easier access
  const prompt = content?.prompt || LLM_DEFAULTS.prompt;
  const model = content?.model || LLM_DEFAULTS.model;
  const temperature = content?.temperature ?? LLM_DEFAULTS.temperature;
  const provider = content?.provider || LLM_DEFAULTS.provider;
  const ollamaUrl = content?.ollamaUrl || LLM_DEFAULTS.ollamaUrl;
  const openaiApiKey = content?.openaiApiKey || LLM_DEFAULTS.openaiApiKey;
  const mode = content?.mode || LLM_DEFAULTS.mode;
  const label = content?.label || LLM_DEFAULTS.label;
  const responseContent = content?.responseContent || LLM_DEFAULTS.responseContent;

  // Create change handlers for form events
  const handlePromptChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateLlmContent({ prompt: event.target.value });
  }, [updateLlmContent]);

  const handleModelChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    updateLlmContent({ model: event.target.value });
  }, [updateLlmContent]);

  const handleTemperatureChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    updateLlmContent({ temperature: parseFloat(event.target.value) });
  }, [updateLlmContent]);

  // Direct value setters
  const setTemperature = createChangeHandler('temperature');
  const setProvider = createChangeHandler('provider');
  const setMode = createChangeHandler('mode');

  // Form event handlers
  const handleProviderChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    updateLlmContent({ provider: event.target.value as 'ollama' | 'openai' });
  }, [updateLlmContent]);

  const handleOllamaUrlChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    updateLlmContent({ ollamaUrl: event.target.value });
  }, [updateLlmContent]);

  const handleOpenaiApiKeyChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    updateLlmContent({ openaiApiKey: event.target.value });
  }, [updateLlmContent]);

  const handleModeChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    updateLlmContent({ mode: event.target.value as LLMMode });
  }, [updateLlmContent]);

  return {
    // Data
    content,
    prompt,
    model,
    temperature,
    provider,
    ollamaUrl,
    openaiApiKey,
    mode,
    label,
    responseContent,
    
    // Event handlers
    handlePromptChange,
    handleModelChange,
    handleTemperatureChange,
    setTemperature,
    handleProviderChange,
    setProvider,
    handleOllamaUrlChange,
    handleOpenaiApiKeyChange,
    handleModeChange,
    setMode,
    
    // Direct update method
    updateContent: updateLlmContent
  };
}; 