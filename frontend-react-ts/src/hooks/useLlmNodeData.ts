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
 * Return type for useLlmNodeData hook
 */
interface LlmNodeDataHook {
  content: LLMNodeContent | undefined;
  prompt: string;
  model: string;
  temperature: number | undefined;
  provider: 'ollama' | 'openai' | undefined;
  ollamaUrl: string;
  openaiApiKey: string;
  isStreaming: boolean;
  streamingResult: string;
  selectedFiles: File[];
  mode: LLMMode | undefined;
  label: string;
  responseContent: string | object;
  isDirty: boolean;
  updateContent: (updates: Partial<LLMNodeContent>) => void;
  handlePromptChange: (value: string) => void;
  handleModelChange: (value: string) => void;
  handleTemperatureChange: (value: number) => void;
  handleProviderChange: (value: 'ollama' | 'openai') => void;
  handleOllamaUrlChange: (value: string) => void;
  handleOpenAIApiKeyChange: (value: string) => void;
  setIsStreaming: (value: boolean) => void;
  updateStreamingResult: (value: string) => void;
  handleFileSelect: (files: File[]) => void;
  hasImageInputs: boolean;
  setMode: (value: LLMMode | undefined) => void;
}

/**
 * Custom hook for managing LLM node data
 */
export const useLlmNodeData = createNodeDataHook<LLMNodeContent, LlmNodeDataHook>(
  'llm',
  (params) => {
    const { nodeId, content, updateContent, createChangeHandler } = params;

    // 기본값과 함께 속성 추출
    const prompt = content?.prompt || LLM_DEFAULTS.prompt || '';
    const model = content?.model || LLM_DEFAULTS.model || '';
    const temperature = content?.temperature ?? LLM_DEFAULTS.temperature;
    const provider = content?.provider || LLM_DEFAULTS.provider;
    const ollamaUrl = content?.ollamaUrl || LLM_DEFAULTS.ollamaUrl || '';
    const openaiApiKey = content?.openaiApiKey || LLM_DEFAULTS.openaiApiKey || '';
    const mode = content?.mode || LLM_DEFAULTS.mode;
    const label = content?.label || LLM_DEFAULTS.label || '';
    const responseContent = content?.responseContent || '';
    const isDirty = content?.isDirty || false;

    // 직접적인 값 설정자
    const setTemperature = createChangeHandler('temperature');
    const setMode = createChangeHandler('mode');

    // 폼 이벤트 핸들러
    const handlePromptChange = useCallback((value: string) => {
      updateContent({ prompt: value });
    }, [updateContent]);

    const handleModelChange = useCallback((value: string) => {
      updateContent({ model: value });
    }, [updateContent]);

    const handleTemperatureChange = useCallback((value: number) => {
      updateContent({ temperature: value });
    }, [updateContent]);

    const handleProviderChange = useCallback((value: 'ollama' | 'openai') => {
      updateContent({ provider: value });
    }, [updateContent]);

    const handleOllamaUrlChange = useCallback((value: string) => {
      updateContent({ ollamaUrl: value });
    }, [updateContent]);

    const handleOpenAIApiKeyChange = useCallback((value: string) => {
      updateContent({ openaiApiKey: value });
    }, [updateContent]);

    return {
      content,
      prompt,
      model,
      temperature,
      provider,
      ollamaUrl,
      openaiApiKey: content?.openaiApiKey || '',
      isStreaming: content?.isStreaming || false,
      streamingResult: content?.streamingResult || '',
      selectedFiles: content?.selectedFiles || [],
      mode,
      label,
      responseContent: content?.responseContent || '',
      isDirty: false,
      updateContent,
      handlePromptChange,
      handleModelChange,
      handleTemperatureChange,
      handleProviderChange,
      handleOllamaUrlChange,
      handleOpenAIApiKeyChange,
      setMode,
      setIsStreaming: (value: boolean) => updateContent({ isStreaming: value }),
      updateStreamingResult: (value: string) => updateContent({ streamingResult: value }),
      handleFileSelect: (files: File[]) => updateContent({ selectedFiles: files }),
      hasImageInputs: content?.hasImageInputs || false
    };
  },
  LLM_DEFAULTS
); 