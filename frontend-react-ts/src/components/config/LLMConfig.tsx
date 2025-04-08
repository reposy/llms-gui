import React, { useCallback } from 'react';
import { LLMNodeData } from '../../types/nodes';
import { useNodeState } from '../../store/flowExecutionStore';
import { useLlmNodeData } from '../../hooks/useLlmNodeData';

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

export const LLMConfig: React.FC<LLMConfigProps> = ({ nodeId, data }) => {
  const executionState = useNodeState(nodeId);
  
  // Use the LLM data hook instead of managed content
  const {
    prompt,
    model,
    temperature,
    provider,
    ollamaUrl,
    isDirty,
    handlePromptChange,
    handleModelChange,
    handleTemperatureChange,
    setProvider,
    handleOllamaUrlChange,
    setTemperature
  } = useLlmNodeData({ nodeId });
  
  // Debug logs for render and content state
  console.log(`%c[LLMConfig Render] Node: ${nodeId}`, 'color: green; font-weight: bold;', { 
    prompt,
    model,
    temperature,
    provider,
    isDirty,
    dataFromProps: data 
  });

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
          placeholder={provider === 'ollama' ? 'llama2' : 'gpt-3.5-turbo'}
        />
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
      </div>

      {/* Execution Result (if available) */}
      {executionState?.status === 'success' && executionState?.result && (
        <div>
          <ConfigLabel>Result</ConfigLabel>
          <div className="p-2.5 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 font-mono text-sm max-h-40 overflow-auto">
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