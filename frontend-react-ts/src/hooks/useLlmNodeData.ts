import { useCallback, useMemo, ChangeEvent } from 'react';
import { useNodeContent, LLMNodeContent } from '../store/useNodeContentStore';
import { isEqual } from 'lodash';

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
   * Handle prompt change with deep equality check
   */
  const handlePromptChange = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
    const newPrompt = event.target.value;
    if (isEqual(newPrompt, prompt)) {
      console.log(`[LLMNode ${nodeId}] Skipping prompt update - no change (deep equal)`);
      return;
    }
    setContent({ prompt: newPrompt });
  }, [nodeId, prompt, setContent]);

  /**
   * Handle model change with deep equality check
   */
  const handleModelChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const newModel = event.target.value;
    if (isEqual(newModel, model)) {
      console.log(`[LLMNode ${nodeId}] Skipping model update - no change (deep equal)`);
      return;
    }
    setContent({ model: newModel });
  }, [nodeId, model, setContent]);

  /**
   * Handle temperature change with deep equality check
   */
  const handleTemperatureChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const newTemperature = parseFloat(event.target.value);
    if (isEqual(newTemperature, temperature)) {
      console.log(`[LLMNode ${nodeId}] Skipping temperature update - no change (deep equal)`);
      return;
    }
    setContent({ temperature: newTemperature });
  }, [nodeId, temperature, setContent]);

  /**
   * Set temperature directly with deep equality check
   */
  const setTemperature = useCallback((newTemperature: number) => {
    if (isEqual(newTemperature, temperature)) {
      console.log(`[LLMNode ${nodeId}] Skipping temperature update - no change (deep equal)`);
      return;
    }
    setContent({ temperature: newTemperature });
  }, [nodeId, temperature, setContent]);

  /**
   * Handle provider change with deep equality check
   */
  const handleProviderChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
    const newProvider = event.target.value as 'ollama' | 'openai';
    if (isEqual(newProvider, provider)) {
      console.log(`[LLMNode ${nodeId}] Skipping provider update - no change (deep equal)`);
      return;
    }
    setContent({ provider: newProvider });
  }, [nodeId, provider, setContent]);

  /**
   * Set provider directly with deep equality check
   */
  const setProvider = useCallback((newProvider: 'ollama' | 'openai') => {
    if (isEqual(newProvider, provider)) {
      console.log(`[LLMNode ${nodeId}] Skipping provider update - no change (deep equal)`);
      return;
    }
    setContent({ provider: newProvider });
  }, [nodeId, provider, setContent]);

  /**
   * Handle Ollama URL change with deep equality check
   */
  const handleOllamaUrlChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const newUrl = event.target.value;
    if (isEqual(newUrl, ollamaUrl)) {
      console.log(`[LLMNode ${nodeId}] Skipping URL update - no change (deep equal)`);
      return;
    }
    setContent({ ollamaUrl: newUrl });
  }, [nodeId, ollamaUrl, setContent]);

  /**
   * Update multiple properties at once with deep equality check
   */
  const updateLlmContent = useCallback((updates: Partial<LLMNodeContent>) => {
    // Skip update if no actual changes using deep equality
    const hasChanges = Object.entries(updates).some(([key, value]) => {
      const currentValue = content[key as keyof LLMNodeContent];
      return !isEqual(currentValue, value);
    });
    
    if (!hasChanges) {
      console.log(`[LLMNode ${nodeId}] Skipping content update - no changes in update object (deep equal)`);
      return;
    }
    
    // Create new content object with updates
    const newContent = {
      ...content,
      ...updates
    };

    // Final deep equality check against current content
    if (isEqual(newContent, content)) {
      console.log(`[LLMNode ${nodeId}] Skipping content update - merged content unchanged (deep equal)`);
      return;
    }
    
    console.log(`[LLMNode ${nodeId}] Updating content with:`, updates);
    setContent(updates);
  }, [nodeId, content, setContent]);

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