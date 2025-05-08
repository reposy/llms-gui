import { useCallback } from 'react';
import { useNodeContentStore } from '../store/useNodeContentStore';
import { LLMNodeContent, LLMMode } from '../types/nodes';
import { isEqual } from 'lodash';

/**
 * Custom hook to manage LLM node state and operations using Zustand store.
 * Centralizes logic for LLMNode component.
 */
export const useLlmNodeData = ({ 
  nodeId
}: { 
  nodeId: string
}) => {
  // Use the content selector pattern consistent with other hooks
  const content = useNodeContentStore(
    useCallback(
      (state) => state.getNodeContent(nodeId, 'llm') as LLMNodeContent,
      [nodeId]
    )
  );
  
  const setNodeContent = useNodeContentStore(state => state.setNodeContent);

  // Destructure content with defaults for easier access
  const prompt = content?.prompt || '';
  const model = content?.model || '';
  const temperature = content?.temperature ?? 0.7;
  const provider = content?.provider || 'ollama';
  const ollamaUrl = content?.ollamaUrl || 'http://localhost:11434';
  const openaiApiKey = content?.openaiApiKey || '';
  const mode = content?.mode || 'text';
  const label = content?.label || 'LLM Node';
  const responseContent = content?.responseContent || '';

  /**
   * Update content with deep equality check to prevent unnecessary updates
   */
  const updateLlmContent = useCallback((updates: Partial<LLMNodeContent>) => {
    const hasChanges = Object.entries(updates).some(([key, value]) => {
      const currentValue = content[key as keyof LLMNodeContent];
      return !isEqual(currentValue, value);
    });
    
    if (!hasChanges) {
      console.log(`[LLMNode ${nodeId}] Skipping content update - no changes (deep equal)`);
      return;
    }
    
    console.log(`[LLMNode ${nodeId}] Updating content with:`, updates);
    setNodeContent(nodeId, updates);
  }, [nodeId, content, setNodeContent]);

  /**
   * Handle prompt change
   */
  const handlePromptChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateLlmContent({ prompt: event.target.value });
  }, [updateLlmContent]);

  /**
   * Handle model change
   */
  const handleModelChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    updateLlmContent({ model: event.target.value });
  }, [updateLlmContent]);

  /**
   * Handle temperature change
   */
  const handleTemperatureChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    updateLlmContent({ temperature: parseFloat(event.target.value) });
  }, [updateLlmContent]);

  /**
   * Set temperature directly
   */
  const setTemperature = useCallback((newTemperature: number) => {
    updateLlmContent({ temperature: newTemperature });
  }, [updateLlmContent]);

  /**
   * Handle provider change
   */
  const handleProviderChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    updateLlmContent({ provider: event.target.value as 'ollama' | 'openai' });
  }, [updateLlmContent]);

  /**
   * Set provider directly
   */
  const setProvider = useCallback((newProvider: 'ollama' | 'openai') => {
    updateLlmContent({ provider: newProvider });
  }, [updateLlmContent]);

  /**
   * Handle Ollama URL change
   */
  const handleOllamaUrlChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    updateLlmContent({ ollamaUrl: event.target.value });
  }, [updateLlmContent]);

  /**
   * Handle OpenAI API key change
   */
  const handleOpenaiApiKeyChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    updateLlmContent({ openaiApiKey: event.target.value });
  }, [updateLlmContent]);

  /**
   * Handle mode change
   */
  const handleModeChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    updateLlmContent({ mode: event.target.value as LLMMode });
  }, [updateLlmContent]);

  /**
   * Set mode directly
   */
  const setMode = useCallback((newMode: LLMMode) => {
    updateLlmContent({ mode: newMode });
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