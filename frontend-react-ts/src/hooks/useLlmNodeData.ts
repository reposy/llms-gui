import { useCallback, useMemo, ChangeEvent } from 'react';
import { useNodeContent, LLMNodeContent } from '../store/useNodeContentStore';

/**
 * Custom hook to manage LLM node state and operations using Zustand store.
 * Centralizes logic for both LLMNode and LLMConfig components
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
  const label = content.label || 'LLM Node';

  /**
   * Handle prompt change
   */
  const handlePromptChange = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
    const newPrompt = event.target.value;
    setContent({ prompt: newPrompt });
  }, [setContent]);

  /**
   * Handle model change
   */
  const handleModelChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const newModel = event.target.value;
    setContent({ model: newModel });
  }, [setContent]);

  /**
   * Handle temperature change
   */
  const handleTemperatureChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const newTemperature = parseFloat(event.target.value);
    setContent({ temperature: newTemperature });
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
  const handleProviderChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
    const newProvider = event.target.value as 'ollama' | 'openai';
    setContent({ provider: newProvider });
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
  const handleOllamaUrlChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const newUrl = event.target.value;
    setContent({ ollamaUrl: newUrl });
  }, [setContent]);

  /**
   * Update multiple properties at once
   */
  const updateLlmContent = useCallback((updates: Partial<LLMNodeContent>) => {
    setContent(updates);
  }, [setContent]);

  return {
    // Data
    content,
    prompt,
    model,
    temperature,
    provider,
    ollamaUrl,
    label,
    isDirty: isContentDirty,
    
    // Event handlers
    handlePromptChange,
    handleModelChange,
    handleTemperatureChange,
    setTemperature,
    handleProviderChange,
    setProvider,
    handleOllamaUrlChange,
    updateLlmContent,
  };
}; 