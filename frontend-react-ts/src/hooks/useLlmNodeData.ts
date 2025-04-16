import { useCallback } from 'react';
import { useNodeContent, LLMNodeContent } from '../store/useNodeContentStore';
import { LLMMode } from '../api/llm';

/**
 * Simplified hook for LLM node data - minimal implementation that just connects to the store
 */
export const useLlmNodeData = ({ 
  nodeId
}: { 
  nodeId: string
}) => {
  // Use the general NodeContentStore with LLMNodeContent type
  const { 
    content: generalContent, 
    setContent,
    isContentDirty
  } = useNodeContent(nodeId);

  // Cast the general content to LLMNodeContent type
  const content = generalContent as LLMNodeContent;

  // Destructure content for easier access
  const prompt = content.prompt || '';
  const model = content.model || '';
  const temperature = content.temperature ?? 0.7;
  const provider = content.provider || 'ollama';
  const ollamaUrl = content.ollamaUrl || 'http://localhost:11434';
  const openaiApiKey = content.openaiApiKey || '';
  const mode = content.mode || 'text';
  const label = content.label || 'LLM Node';
  const responseContent = content.content || '';

  /**
   * Handle prompt change
   */
  const handlePromptChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent({ prompt: event.target.value });
  }, [setContent]);

  /**
   * Handle model change
   */
  const handleModelChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setContent({ model: event.target.value });
  }, [setContent]);

  /**
   * Handle temperature change
   */
  const handleTemperatureChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setContent({ temperature: parseFloat(event.target.value) });
  }, [setContent]);

  /**
   * Set temperature directly
   */
  const setTemperature = useCallback((newTemperature: number) => {
    setContent({ temperature: newTemperature });
  }, [setContent]);

  /**
   * Handle provider change
   */
  const handleProviderChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    setContent({ provider: event.target.value as 'ollama' | 'openai' });
  }, [setContent]);

  /**
   * Set provider directly
   */
  const setProvider = useCallback((newProvider: 'ollama' | 'openai') => {
    setContent({ provider: newProvider });
  }, [setContent]);

  /**
   * Handle Ollama URL change
   */
  const handleOllamaUrlChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setContent({ ollamaUrl: event.target.value });
  }, [setContent]);

  /**
   * Handle OpenAI API key change
   */
  const handleOpenaiApiKeyChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setContent({ openaiApiKey: event.target.value });
  }, [setContent]);

  /**
   * Handle mode change
   */
  const handleModeChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    setContent({ mode: event.target.value as LLMMode });
  }, [setContent]);

  /**
   * Set mode directly
   */
  const setMode = useCallback((newMode: LLMMode) => {
    setContent({ mode: newMode });
  }, [setContent]);

  return {
    prompt,
    model,
    temperature,
    provider,
    ollamaUrl,
    openaiApiKey,
    mode,
    label,
    responseContent,
    isContentDirty,
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
    setContent
  };
}; 