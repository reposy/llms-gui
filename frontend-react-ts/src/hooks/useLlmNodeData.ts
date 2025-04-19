import { useCallback, useMemo } from 'react';
import { shallow } from 'zustand/shallow';
import { useNodeContent, LLMNodeContent, useNodeContentStore, isNodeDirty } from '../store/useNodeContentStore';
import { LLMMode } from '../types/nodes';

/**
 * Simplified hook for LLM node data - minimal implementation that just connects to the store
 */
export const useLlmNodeData = ({ 
  nodeId
}: { 
  nodeId: string
}) => {
  // Use shallow comparison for content retrieval
  const content = useNodeContentStore(
    state => state.contents[nodeId] || {},
    shallow
  ) as LLMNodeContent;
  
  // Get the update function
  const updateContent = useNodeContentStore(
    state => state.setNodeContent,
    shallow
  );
  
  // useNodeContentStore의 isNodeDirty 함수를 사용하여 dirty 상태 확인
  const isContentDirty = useNodeContentStore(
    state => state.isNodeDirty(nodeId),
    shallow
  );

  // Memoize extracted values to prevent recreation
  const values = useMemo(() => ({
    prompt: content.prompt || '',
    model: content.model || '',
    temperature: content.temperature ?? 0.7,
    provider: content.provider || 'ollama',
    ollamaUrl: content.ollamaUrl || 'http://localhost:11434',
    openaiApiKey: content.openaiApiKey || '',
    mode: content.mode || 'text',
    label: content.label || 'LLM Node',
    responseContent: content.content || '',
    isDirty: isContentDirty
  }), [content, isContentDirty]);

  /**
   * Handle prompt change
   */
  const handlePromptChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateContent(nodeId, { prompt: event.target.value });
  }, [updateContent, nodeId]);

  /**
   * Handle model change
   */
  const handleModelChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    updateContent(nodeId, { model: event.target.value });
  }, [updateContent, nodeId]);

  /**
   * Handle temperature change
   */
  const handleTemperatureChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    updateContent(nodeId, { temperature: parseFloat(event.target.value) });
  }, [updateContent, nodeId]);

  /**
   * Set temperature directly
   */
  const setTemperature = useCallback((newTemperature: number) => {
    updateContent(nodeId, { temperature: newTemperature });
  }, [updateContent, nodeId]);

  /**
   * Handle provider change
   */
  const handleProviderChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    updateContent(nodeId, { provider: event.target.value as 'ollama' | 'openai' });
  }, [updateContent, nodeId]);

  /**
   * Set provider directly
   */
  const setProvider = useCallback((newProvider: 'ollama' | 'openai') => {
    updateContent(nodeId, { provider: newProvider });
  }, [updateContent, nodeId]);

  /**
   * Handle Ollama URL change
   */
  const handleOllamaUrlChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    updateContent(nodeId, { ollamaUrl: event.target.value });
  }, [updateContent, nodeId]);

  /**
   * Handle OpenAI API key change
   */
  const handleOpenaiApiKeyChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    updateContent(nodeId, { openaiApiKey: event.target.value });
  }, [updateContent, nodeId]);

  /**
   * Handle mode change
   */
  const handleModeChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    updateContent(nodeId, { mode: event.target.value as LLMMode });
  }, [updateContent, nodeId]);

  /**
   * Set mode directly
   */
  const setMode = useCallback((newMode: LLMMode) => {
    updateContent(nodeId, { mode: newMode });
  }, [updateContent, nodeId]);

  // Memoize the handlers
  const handlers = useMemo(() => ({
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
    setContent: (newContent: Partial<LLMNodeContent>) => updateContent(nodeId, newContent)
  }), [
    handlePromptChange, handleModelChange, handleTemperatureChange, 
    setTemperature, handleProviderChange, setProvider, 
    handleOllamaUrlChange, handleOpenaiApiKeyChange, 
    handleModeChange, setMode, updateContent, nodeId
  ]);

  // Return combined values and handlers with proper memoization
  return {
    ...values,
    ...handlers
  };
}; 