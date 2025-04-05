import React, { useCallback } from 'react';
import { LLMNodeData } from '../../types/nodes';
import { useNodeState } from '../../store/flowExecutionStore';
import { useManagedNodeContent } from '../../hooks/useManagedNodeContent';
import { NodeContent } from '../../store/nodeContentStore';

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
  
  // Use the managed content hook
  const { content, isDirty, updateContent, saveContent } = useManagedNodeContent(nodeId, data);
  
  // Debug logs for render and content state
  console.log(`%c[LLMConfig Render] Node: ${nodeId}`, 'color: green; font-weight: bold;', { 
    content, 
    isDirty,
    dataFromProps: data 
  });

  // Simplified handler for immediate save fields (like Provider, Temperature)
  const handleUpdateAndSave = useCallback((key: keyof NodeContent, value: any) => {
    console.log(`%c[LLMConfig handleUpdateAndSave] Node: ${nodeId}, Key: ${String(key)}`, 'color: green;', { 
      currentValue: content[key], 
      newValue: value 
    });
    updateContent({ [key]: value });
    saveContent();
  }, [updateContent, saveContent, content, nodeId]);

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
              content.provider === 'ollama'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            onClick={() => handleUpdateAndSave('provider', 'ollama')}
            onKeyDown={handleKeyDown}
          >
            Ollama
          </button>
          <button
            className={`flex-1 p-2 rounded-lg text-sm font-medium ${
              content.provider === 'openai'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            onClick={() => handleUpdateAndSave('provider', 'openai')}
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
          value={content.model || ''}
          onChange={(e) => updateContent({ model: e.target.value })}
          onBlur={saveContent}
          onKeyDown={handleKeyDown}
          placeholder={content.provider === 'ollama' ? 'llama2' : 'gpt-3.5-turbo'}
        />
      </div>

      {/* Ollama URL for Ollama provider */}
      {content.provider === 'ollama' && (
        <div>
          <ConfigLabel>Ollama URL</ConfigLabel>
          <input
            type="text"
            className="w-full p-2.5 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
            value={content.ollamaUrl || 'http://localhost:11434'}
            onChange={(e) => updateContent({ ollamaUrl: e.target.value })}
            onBlur={saveContent}
            onKeyDown={handleKeyDown}
            placeholder="http://localhost:11434"
          />
        </div>
      )}

      {/* Temperature Slider */}
      <div>
        <div className="flex justify-between items-center">
          <ConfigLabel>Temperature</ConfigLabel>
          <span className="text-sm text-gray-600">{(content.temperature ?? 0).toFixed(1)}</span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          className="w-full"
          value={content.temperature ?? 0}
          onChange={(e) => handleUpdateAndSave('temperature', parseFloat(e.target.value))}
          onKeyDown={handleKeyDown}
        />
      </div>

      {/* Prompt Input */}
      <div>
        <ConfigLabel>Prompt</ConfigLabel>
        <textarea
          className="w-full p-2.5 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 font-mono text-sm"
          value={content.prompt || ''}
          onChange={(e) => updateContent({ prompt: e.target.value })}
          onBlur={saveContent}
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