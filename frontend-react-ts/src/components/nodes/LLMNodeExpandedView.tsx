import React, { useCallback, useMemo } from 'react';
import { LLMNodeData } from '../../types/nodes';
import { NodeState } from '../../types/execution';
import { NodeStatusIndicator } from './shared/NodeStatusIndicator';
import { LLMNodeHeader } from './LLMNodeHeader';
import { NodeViewMode } from '../../store/viewModeSlice';
import { useManagedNodeContent } from '../../hooks/useManagedNodeContent';

interface LLMNodeExpandedViewProps {
  id: string;
  data: LLMNodeData;
  nodeState: NodeState | null;
  viewMode: NodeViewMode;
  onToggleView: () => void;
}

export const LLMNodeExpandedView: React.FC<LLMNodeExpandedViewProps> = ({
  id,
  data,
  nodeState,
  viewMode,
  onToggleView,
}) => {
  const { 
    content, 
    isDirty, 
    updateContent, 
    saveContent 
  } = useManagedNodeContent(id, data);
  
  // Debug logs for render and content state
  console.log(`%c[LLMNodeExpandedView Render] Node: ${id}`, 'color: blue; font-weight: bold;', { 
    content, 
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

  // Handler for updating and immediately saving content
  const handleUpdateAndSave = useCallback((key: string, value: any) => {
    updateContent({ [key]: value });
    saveContent();
  }, [updateContent, saveContent]);

  const handleBlur = useCallback(() => {
    saveContent();
  }, [saveContent]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey || e.currentTarget instanceof HTMLInputElement)) {
      e.preventDefault();
      saveContent();
      e.currentTarget.blur();
    }
  }, [saveContent]);

  return (
    <>
      <LLMNodeHeader
        id={id}
        data={{ ...data, label: content.label ?? data.label }}
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
            value={content.model || ''}
            onChange={(e) => {
              const newModel = e.target.value;
              console.log(`[LLMNodeExpandedView ${id}] Updating model to: ${newModel}`);
              updateContent({ model: newModel });
            }}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="nodrag nopan border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white text-black"
            placeholder="e.g., llama3:latest"
          />
        </div>
        
        <div className="flex flex-col space-y-1">
          <label className="text-xs font-medium text-gray-600">Prompt:</label>
          <textarea
            value={content.prompt || ''}
            onChange={(e) => updateContent({ prompt: e.target.value })}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="nodrag nopan border border-gray-300 rounded px-2 py-1 text-sm h-24 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white text-black"
            placeholder="Enter your prompt here..."
          />
        </div>

        <div className="flex flex-col space-y-1">
          <label className="text-xs font-medium text-gray-600 flex justify-between">
            <span>Temperature:</span>
            <span>{(content.temperature ?? 0.7).toFixed(1)}</span>
          </label>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={content.temperature ?? 0.7}
            onChange={(e) => handleUpdateAndSave('temperature', parseFloat(e.target.value))}
            className="nodrag nopan w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div className="flex flex-col space-y-1">
          <label className="text-xs font-medium text-gray-600">Provider:</label>
          <select
            value={content.provider ?? 'ollama'}
            onChange={(e) => handleUpdateAndSave('provider', e.target.value)}
            className="nodrag nopan border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white text-black"
          >
            <option value="ollama">Ollama</option>
            <option value="openai">OpenAI</option>
          </select>
        </div>
        
        {(content.provider ?? 'ollama') === 'ollama' && (
          <div className="flex flex-col space-y-1">
            <label className="text-xs font-medium text-gray-600">Ollama URL (Optional):</label>
            <input
              type="text"
              name="ollamaUrl"
              value={content.ollamaUrl ?? ''}
              onChange={(e) => updateContent({ ollamaUrl: e.target.value })}
              onBlur={handleBlur}
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
}; 