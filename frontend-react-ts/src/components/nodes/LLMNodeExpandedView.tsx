import React, { useCallback, useMemo } from 'react';
import { LLMNodeData } from '../../types/nodes';
import { NodeState } from '../../types/execution';
import { NodeStatusIndicator } from './shared/NodeStatusIndicator';
import { LLMNodeHeader } from './LLMNodeHeader';
import { NodeViewMode } from '../../store/viewModeStore';
import { useLlmNodeData } from '../../hooks/useLlmNodeData';

interface LLMNodeExpandedViewProps {
  id: string;
  data: LLMNodeData;
  nodeState: NodeState | null;
  viewMode: NodeViewMode;
  onToggleView: () => void;
}

export const LLMNodeExpandedView: React.FC<LLMNodeExpandedViewProps> = React.memo(({
  id,
  data,
  nodeState,
  viewMode,
  onToggleView,
}) => {
  const { 
    prompt,
    model,
    temperature,
    provider,
    ollamaUrl,
    label,
    isDirty,
    handlePromptChange,
    handleModelChange,
    handleTemperatureChange,
    handleProviderChange,
    handleOllamaUrlChange
  } = useLlmNodeData({ nodeId: id });
  
  // Debug logs for render and content state
  console.log(`%c[LLMNodeExpandedView Render] Node: ${id}`, 'color: blue; font-weight: bold;', { 
    prompt,
    model,
    temperature,
    provider,
    isDirty,
    dataFromProps: data 
  });

  const nodeStatus = useMemo(() => {
    if (!nodeState) return 'idle';
    return nodeState.status === 'skipped' 
      ? 'idle' 
      : nodeState.status === 'running' || nodeState.status === 'success' || nodeState.status === 'error'
        ? nodeState.status
        : 'idle';
  }, [nodeState]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey || e.currentTarget instanceof HTMLInputElement)) {
      e.preventDefault();
      e.currentTarget.blur();
    }
  }, []);

  return (
    <>
      <LLMNodeHeader
        id={id}
        data={{ ...data, label: label ?? data.label }}
        viewMode={viewMode}
        onToggleView={onToggleView}
        isContentDirty={isDirty}
      />
      
      <div className="absolute -top-2 -right-2">
        <NodeStatusIndicator status={nodeStatus} />
      </div>
      
      <div className="p-2 space-y-3">
        <div className="flex flex-col space-y-1">
          <label className="text-xs font-medium text-gray-600">Model:</label>
          <input
            type="text"
            name="model"
            value={model}
            onChange={handleModelChange}
            onKeyDown={handleKeyDown}
            className="nodrag nopan border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white text-black"
            placeholder="e.g., llama3:latest"
          />
        </div>
        
        <div className="flex flex-col space-y-1">
          <label className="text-xs font-medium text-gray-600">Prompt:</label>
          <textarea
            value={prompt}
            onChange={handlePromptChange}
            onKeyDown={handleKeyDown}
            className="nodrag nopan border border-gray-300 rounded px-2 py-1 text-sm h-24 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white text-black"
            placeholder="Enter your prompt here..."
          />
        </div>

        <div className="flex flex-col space-y-1">
          <label className="text-xs font-medium text-gray-600 flex justify-between">
            <span>Temperature:</span>
            <span>{temperature.toFixed(1)}</span>
          </label>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={temperature}
            onChange={handleTemperatureChange}
            className="nodrag nopan w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div className="flex flex-col space-y-1">
          <label className="text-xs font-medium text-gray-600">Provider:</label>
          <select
            value={provider}
            onChange={handleProviderChange}
            className="nodrag nopan border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white text-black"
          >
            <option value="ollama">Ollama</option>
            <option value="openai">OpenAI</option>
          </select>
        </div>
        
        {provider === 'ollama' && (
          <div className="flex flex-col space-y-1">
            <label className="text-xs font-medium text-gray-600">Ollama URL (Optional):</label>
            <input
              type="text"
              name="ollamaUrl"
              value={ollamaUrl}
              onChange={handleOllamaUrlChange}
              onKeyDown={handleKeyDown}
              className="nodrag nopan border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white text-black"
              placeholder="http://localhost:11434"
            />
          </div>
        )}

        {nodeState?.result && (
          <div className="mt-2 p-2 border border-green-200 bg-green-50 rounded text-xs text-green-800">
            <strong>Result:</strong>
            <pre className="whitespace-pre-wrap break-all">{JSON.stringify(nodeState.result, null, 2)}</pre>
          </div>
        )}
        {nodeState?.error && (
          <div className="mt-2 p-2 border border-red-200 bg-red-50 rounded text-xs text-red-800">
            <strong>Error:</strong> {nodeState.error}
          </div>
        )}
      </div>
    </>
  );
}); 