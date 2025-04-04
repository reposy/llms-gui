import React, { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { LLMNodeData } from '../../types/nodes';
import { updateNodeData } from '../../store/flowSlice';
import { useNodeState } from '../../store/flowExecutionStore';

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
  const dispatch = useDispatch();
  const executionState = useNodeState(nodeId);
  
  // Handle config changes
  const handleConfigChange = useCallback((key: keyof LLMNodeData, value: any) => {
    dispatch(updateNodeData({
      nodeId,
      data: { ...data, [key]: value }
    }));
  }, [dispatch, nodeId, data]);
  
  return (
    <div className="space-y-4">
      {/* Provider Selection */}
      <div>
        <ConfigLabel>Provider</ConfigLabel>
        <div className="flex gap-2">
          <button
            className={`flex-1 p-2 rounded-lg text-sm font-medium ${
              data.provider === 'ollama'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            onClick={() => handleConfigChange('provider', 'ollama')}
          >
            Ollama
          </button>
          <button
            className={`flex-1 p-2 rounded-lg text-sm font-medium ${
              data.provider === 'openai'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            onClick={() => handleConfigChange('provider', 'openai')}
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
          value={data.model}
          onChange={(e) => handleConfigChange('model', e.target.value)}
          placeholder={data.provider === 'ollama' ? 'llama2' : 'gpt-3.5-turbo'}
        />
      </div>

      {/* Ollama URL for Ollama provider */}
      {data.provider === 'ollama' && (
        <div>
          <ConfigLabel>Ollama URL</ConfigLabel>
          <input
            type="text"
            className="w-full p-2.5 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
            value={data.ollamaUrl || 'http://localhost:11434'}
            onChange={(e) => handleConfigChange('ollamaUrl', e.target.value)}
            placeholder="http://localhost:11434"
          />
        </div>
      )}

      {/* Temperature Slider */}
      <div>
        <div className="flex justify-between items-center">
          <ConfigLabel>Temperature</ConfigLabel>
          <span className="text-sm text-gray-600">{data.temperature}</span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          className="w-full"
          value={data.temperature}
          onChange={(e) => handleConfigChange('temperature', parseFloat(e.target.value))}
        />
      </div>

      {/* Prompt Input */}
      <div>
        <ConfigLabel>Prompt</ConfigLabel>
        <textarea
          className="w-full p-2.5 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 font-mono text-sm"
          value={data.prompt || ''}
          onChange={(e) => handleConfigChange('prompt', e.target.value)}
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