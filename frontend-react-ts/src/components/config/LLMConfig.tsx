import React, { useCallback, useMemo } from 'react';
import { LLMNodeData } from '../../types/nodes';
import { useNodeState } from '../../store/useNodeStateStore';
import { useLlmNodeData } from '../../hooks/useLlmNodeData';
import { isVisionModel } from '../../api/llm';
import { useNodeConnections } from '../../hooks/useNodeConnections';

interface LLMConfigProps {
  nodeId: string;
  data: LLMNodeData;
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

export const LLMConfig: React.FC<LLMConfigProps> = ({ nodeId, data }) => {
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
    setProvider,
    handleOllamaUrlChange,
    handleOpenaiApiKeyChange,
    handleModeChange,
    setMode,
    setTemperature
  } = useLlmNodeData({ nodeId });
  
  // Check if there are input nodes that could provide images
  const { hasImageInputs } = useNodeConnections(nodeId);
  
  // Check if the current model supports vision features
  const supportsVision = model && isVisionModel(provider as any, model);
  
  // Check if vision mode can be enabled (needs image inputs and supported model)
  const canEnableVisionMode = useMemo(() => {
    const hasInputs = hasImageInputs();
    const canEnable = supportsVision && hasInputs;
    if (DEBUG_LOGS) {
      console.log(`[LLMConfig] Node ${nodeId} vision mode status:`, {
        supportsVision,
        hasImageInputs: hasInputs,
        canEnableVision: canEnable
      });
    }
    return canEnable;
  }, [nodeId, supportsVision, hasImageInputs]);
  
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
      dataFromProps: data 
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
            onClick={() => setProvider('ollama')}
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
            onClick={() => setProvider('openai')}
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
          onChange={handleModelChange}
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
            } ${
              !canEnableVisionMode ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            onClick={() => {
              if (!supportsVision) {
                alert(`모델 ${model}은(는) 비전 기능을 지원하지 않습니다. 비전을 지원하는 모델로 변경해주세요.`);
                return;
              }
              
              if (!hasImageInputs()) {
                alert('비전 모드는 이미지 입력이 필요합니다. 이미지 입력 노드를 연결하세요.');
                return;
              }
              
              // If both conditions pass, we can enable vision mode
              setMode('vision');
            }}
            onKeyDown={handleKeyDown}
            disabled={!canEnableVisionMode}
            title={
              !supportsVision 
                ? '현재 모델은 비전을 지원하지 않습니다' 
                : !hasImageInputs() 
                  ? '이미지 입력이 필요합니다. 입력 노드를 연결하세요.'
                  : '이미지 입력 처리'
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
            onChange={handleOllamaUrlChange}
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
            onChange={handleOpenaiApiKeyChange}
            onKeyDown={handleKeyDown}
            placeholder="sk-..."
          />
        </div>
      )}

      {/* Temperature Slider */}
      <div>
        <div className="flex justify-between items-center">
          <ConfigLabel>Temperature</ConfigLabel>
          <span className="text-sm text-gray-600">{temperature.toFixed(1)}</span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          className="w-full"
          value={temperature}
          onChange={handleTemperatureChange}
          onKeyDown={handleKeyDown}
        />
      </div>

      {/* Prompt Input */}
      <div>
        <ConfigLabel>Prompt</ConfigLabel>
        <textarea
          className="w-full p-2.5 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 font-mono text-sm"
          value={prompt}
          onChange={handlePromptChange}
          onKeyDown={handleKeyDown}
          rows={8}
          placeholder="Enter your prompt here..."
        />
        {mode === 'vision' && (
          <div className="mt-1 text-xs text-gray-500">
            ℹ️ 프롬프트에 {'{{input}}'} 을 포함하면 이미지 파일명으로 대체됩니다.
          </div>
        )}
      </div>

      {/* Execution Result (if available) */}
      {executionState?.status === 'success' && executionState?.result && (
        <div>
          <ConfigLabel>Result</ConfigLabel>
          <div className="p-2.5 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 font-mono text-sm max-h-40 overflow-auto whitespace-pre-wrap">
            {typeof executionState.result === 'string' 
              ? executionState.result 
              : JSON.stringify(executionState.result, null, 2)}
          </div>
        </div>
      )}

      {/* Error Message (if any) */}
      {executionState?.status === 'error' && executionState?.error && (
        <div>
          <ConfigLabel>Error</ConfigLabel>
          <div className="p-2.5 bg-red-50 border border-red-300 rounded-lg text-red-700 font-mono text-sm">
            {executionState.error}
          </div>
        </div>
      )}
    </div>
  );
}; 