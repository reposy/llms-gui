// src/components/config/LLMConfig.tsx
import React, { useCallback, useMemo } from 'react';
import { useNodeState } from '../../store/useNodeStateStore';
import { useLlmNodeData } from '../../hooks/useLlmNodeData';
import { useNodeConnections } from '../../hooks/useNodeConnections';

interface LLMConfigProps {
  nodeId: string;
  // data prop is no longer needed as data is fetched by the hook
  // data: LLMNodeData; 
}

// Reusable label component
const ConfigLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label className="block text-sm font-medium text-gray-700 mb-1">
    {children}
  </label>
);

// Debug logs for render and content state - Comment out in production
// Only log when debugging specific issues
const DEBUG_LOGS = false;

// Temporary placeholder for isVisionModel logic
// TODO: Implement proper vision model detection based on provider and model name
const isVisionModel = (provider: 'ollama' | 'openai', model: string): boolean => {
  // console.warn('Vision model detection is using a placeholder implementation!');
  if (provider === 'ollama') {
      // 모델 이름에 'vision' 포함 여부 체크 제거
      const visionAbleModels = ['llama', 'gemma']

      for (const visionModel of visionAbleModels) {
        if (model?.includes(visionModel)) { // 모델 이름이 null/undefined 인 경우 방지
          return true;
        }
      }
  }
  if (provider === 'openai') {
      const visionAbleModels = [
        'gpt-4o',
        'gpt-4o-mini',
        'gpt-4o-nano', 
      ]

      for (const visionModel of visionAbleModels) {
        if (model?.includes(visionModel)) { // 모델 이름이 null/undefined 인 경우 방지
          return true;
        }
      }
  }
  // Add more robust checks based on known model identifiers
  return false;
};

export const LLMConfig: React.FC<LLMConfigProps> = ({ nodeId }) => {
  const executionState = useNodeState(nodeId);
  
  // Use the LLM data hook instead of managed content
  const {
    prompt,
    model,
    temperature,
    provider,
    ollamaUrl,
    mode,
    openaiApiKey,
    isDirty,
    handlePromptChange,
    handleModelChange,
    handleTemperatureChange,
    handleProviderChange,
    handleOllamaUrlChange,
    handleOpenAIApiKeyChange,
    setMode,
  } = useLlmNodeData({ nodeId });
  
  // Check if the current model supports vision features using the local placeholder
  const supportsVision = model && isVisionModel(provider || 'ollama', model);
  
  // Vision button is always enabled from UI perspective
  // const canEnableVisionButton = useMemo(() => {
  //   if (DEBUG_LOGS) {
  //     console.log(`[LLMConfig] Node ${nodeId} vision button status:`, {
  //       supportsVision,
  //     });
  //   }
  //   return supportsVision;
  // }, [nodeId, supportsVision]);
  
  // Check if there are image inputs (used for click handler alert)
  const hasImageInputs = useNodeConnections(nodeId).hasImageInputs;
  
  // Debug logs for render and content state
  if (DEBUG_LOGS) {
    console.log(`[LLMConfig Render] Node: ${nodeId}`, { 
      prompt,
      model,
      temperature,
      provider,
      mode,
      supportsVision,
      isDirty,
      // dataFromProps: data 
    });
  }

  // Event handler to stop propagation to prevent backspace from deleting nodes
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <div className="space-y-4">
      {/* Provider Selection */}
      <div>
        <ConfigLabel>Provider</ConfigLabel>
        <div className="flex gap-2">
          <button
            className={`flex-1 p-2 rounded-lg text-sm font-medium ${
              provider === 'ollama'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            onClick={() => handleProviderChange('ollama')}
            onKeyDown={handleKeyDown}
          >
            Ollama
          </button>
          <button
            className={`flex-1 p-2 rounded-lg text-sm font-medium ${
              provider === 'openai'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            onClick={() => handleProviderChange('openai')}
            onKeyDown={handleKeyDown}
          >
            OpenAI
          </button>
        </div>
      </div>

      {/* Model Selection */}
      <div>
        <ConfigLabel>Model</ConfigLabel>
        <input
          type="text"
          className="w-full p-2.5 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
          value={model}
          onChange={(e) => handleModelChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={provider === 'ollama' ? 'llama3' : 'gpt-3.5-turbo'}
        />
        {model && (
          <div className="mt-1 text-xs text-gray-500">
            {supportsVision 
              ? '✅ 이 모델은 비전(이미지) 기능을 지원합니다' 
              : '⚠️ 이 모델은 텍스트만 지원합니다'}
          </div>
        )}
      </div>

      {/* Mode Selection (Text/Vision) */}
      <div>
        <ConfigLabel>Mode</ConfigLabel>
        <div className="flex gap-2">
          <button
            className={`flex-1 p-2 rounded-lg text-sm font-medium ${
              mode === 'text'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            onClick={() => setMode('text')}
            onKeyDown={handleKeyDown}
          >
            Text
          </button>
          <button
            className={`flex-1 p-2 rounded-lg text-sm font-medium ${
              mode === 'vision'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            onClick={() => {
              // 클릭 시 임시 로직으로 비전 지원 여부 확인 (알림용)
              if (!supportsVision) {
                alert(`모델 ${model}은(는) 비전 기능을 지원하지 않을 수 있습니다. (임시 확인)`);
                // 지원 여부와 관계없이 모드 변경 허용
              }
              
              // 이미지 입력 연결 여부 확인 (알림용)
              if (!hasImageInputs) {
                alert('비전 모드는 이미지 입력이 필요합니다. 이미지 입력 노드를 연결하세요.');
                // 입력이 없어도 모드 변경은 허용
              }
              
              setMode('vision');
            }}
            onKeyDown={handleKeyDown}
            title={
               // 툴팁 업데이트: 비전 지원 여부와 관계없이 일반적인 설명 제공
               '텍스트와 이미지 입력을 함께 처리합니다.'
            }
          >
            Vision
          </button>
        </div>
        {mode === 'vision' && (
          <div className="mt-1 text-xs text-gray-500">
            ℹ️ 이미지는 입력 노드로부터 제공되어야 합니다.
          </div>
        )}
      </div>

      {/* Ollama URL for Ollama provider */}
      {provider === 'ollama' && (
        <div>
          <ConfigLabel>Ollama URL</ConfigLabel>
          <input
            type="text"
            className="w-full p-2.5 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
            value={ollamaUrl}
            onChange={(e) => handleOllamaUrlChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="http://localhost:11434"
          />
        </div>
      )}

      {/* OpenAI API Key for OpenAI provider */}
      {provider === 'openai' && (
        <div>
          <ConfigLabel>OpenAI API Key</ConfigLabel>
          <input
            type="password"
            className="w-full p-2.5 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
            value={openaiApiKey}
            onChange={(e) => handleOpenAIApiKeyChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="sk-..."
          />
        </div>
      )}

      {/* Temperature Slider */}
      <div>
        <div className="flex justify-between items-center">
          <ConfigLabel>Temperature</ConfigLabel>
          <span className="text-sm text-gray-600">{temperature?.toFixed(1) || '0.0'}</span>
        </div>
        <input
          type="range"
          min="0"
          max="2"
          step="0.1"
          value={temperature || 0}
          onChange={(e) => handleTemperatureChange(parseFloat(e.target.value))}
          onKeyDown={handleKeyDown}
          className="w-full h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer"
        />
      </div>

      {/* Prompt Textarea */}
      <div>
        <ConfigLabel>Prompt</ConfigLabel>
        <textarea
          className="w-full p-2.5 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 h-36"
          value={prompt}
          onChange={(e) => handlePromptChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter your prompt here..."
        />
        {/* Optional character count or helper text */}
        <div className="mt-1 text-xs text-gray-500 flex justify-between">
          <span>{prompt?.length || 0} characters</span>
          {prompt?.length > 0 && (
            <button
              className="text-blue-500 hover:text-blue-700"
              onClick={() => handlePromptChange('')}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Execution Status */}
      {executionState && (
        <div className="mt-4">
          <div className={`px-4 py-3 rounded-md text-sm ${
            executionState.status === 'running' ? 'bg-blue-50 text-blue-700' :
            executionState.status === 'success' ? 'bg-green-50 text-green-700' :
            executionState.status === 'error' ? 'bg-red-50 text-red-700' :
            'bg-gray-50 text-gray-700'
          }`}>
            {executionState.status === 'running' && 'Processing your request...'}
            {executionState.status === 'success' && 'Request completed successfully.'}
            {executionState.status === 'error' && `Error: ${executionState.error || 'Unknown error'}`}
            {executionState.status === 'idle' && 'Ready to process your request.'}
          </div>
        </div>
      )}
    </div>
  );
}; 