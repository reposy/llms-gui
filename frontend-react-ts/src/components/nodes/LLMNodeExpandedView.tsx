import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { LLMNodeData } from '../../types/nodes';
import { NodeState } from '../../types/execution';
import { NodeStatusIndicator } from './shared/NodeStatusIndicator';
import { LLMNodeHeader } from './LLMNodeHeader';
import { NodeViewMode } from '../../store/viewModeSlice';
import { debounce } from 'lodash';
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

  const [promptDraft, setPromptDraft] = useState(content.prompt || '');
  const [modelDraft, setModelDraft] = useState(content.model || '');
  const [tempDraft, setTempDraft] = useState(content.temperature ?? 0.7);
  const [providerDraft, setProviderDraft] = useState(content.provider ?? 'ollama');
  const [ollamaUrlDraft, setOllamaUrlDraft] = useState(content.ollamaUrl ?? '');

  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [isEditingModel, setIsEditingModel] = useState(false);
  const [isComposing, setIsComposing] = useState(false);

  const nodeStatus = useMemo(() => {
    if (!nodeState) return 'idle';
    return nodeState.status === 'skipped' 
      ? 'idle' 
      : nodeState.status === 'running' || nodeState.status === 'success' || nodeState.status === 'error'
        ? nodeState.status
        : 'idle';
  }, [nodeState]);

  useEffect(() => {
    console.log(`[LLMNodeExpandedView ${id}] Content changed, syncing drafts`, content);
    if (!isEditingPrompt && !isComposing) {
      setPromptDraft(content.prompt || '');
    }
    if (!isEditingModel) {
      setModelDraft(content.model || '');
    }
    setTempDraft(content.temperature ?? 0.7);
    setProviderDraft(content.provider ?? 'ollama');
    setOllamaUrlDraft(content.ollamaUrl ?? '');
  }, [id, content, isEditingPrompt, isEditingModel, isComposing]);

  const handlePromptChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newPrompt = e.target.value;
    setPromptDraft(newPrompt);
    updateContent({ prompt: newPrompt });
  }, [updateContent]);

  const handleModelChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newModel = e.target.value;
    setModelDraft(newModel);
    updateContent({ model: newModel });
  }, [updateContent]);
  
  const handleTemperatureChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setTempDraft(value);
    updateContent({ temperature: isNaN(value) ? 0.7 : value });
    saveContent();
  }, [updateContent, saveContent]);

  const handleProviderChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as 'ollama' | 'openai';
    setProviderDraft(value);
    updateContent({ provider: value });
    saveContent();
  }, [updateContent, saveContent]);
  
  const handleOllamaUrlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setOllamaUrlDraft(value);
    updateContent({ ollamaUrl: value });
  }, [updateContent]);

  const handleFocus = useCallback((setter: React.Dispatch<React.SetStateAction<boolean>>) => {
    setter(true);
  }, []);

  const handleBlur = useCallback((setter: React.Dispatch<React.SetStateAction<boolean>>) => {
    setter(false);
    saveContent();
  }, [saveContent]);

  const handleCompositionStart = useCallback(() => {
    setIsComposing(true);
  }, []);

  const handleCompositionEnd = useCallback((e: React.CompositionEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    setIsComposing(false);
    const target = e.target as HTMLTextAreaElement | HTMLInputElement;
    if (target instanceof HTMLTextAreaElement) {
        updateContent({ prompt: target.value });
    } else if (target.name === 'model') {
        updateContent({ model: target.value });
    } else if (target.name === 'ollamaUrl') {
        updateContent({ ollamaUrl: target.value });
    }
  }, [updateContent]);

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
            value={modelDraft}
            onChange={handleModelChange}
            onFocus={() => handleFocus(setIsEditingModel)}
            onBlur={() => handleBlur(setIsEditingModel)}
            onKeyDown={handleKeyDown}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            className="nodrag nopan border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            placeholder="e.g., llama3:latest"
          />
        </div>
        
        <div className="flex flex-col space-y-1">
          <label className="text-xs font-medium text-gray-600">Prompt:</label>
          <textarea
            value={promptDraft}
            onChange={handlePromptChange}
            onFocus={() => handleFocus(setIsEditingPrompt)}
            onBlur={() => handleBlur(setIsEditingPrompt)}
            onKeyDown={handleKeyDown}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            className="nodrag nopan border border-gray-300 rounded px-2 py-1 text-sm h-24 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter your prompt here..."
          />
        </div>

        <div className="flex flex-col space-y-1">
          <label className="text-xs font-medium text-gray-600 flex justify-between">
            <span>Temperature:</span>
            <span>{tempDraft.toFixed(1)}</span>
          </label>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={tempDraft}
            onChange={handleTemperatureChange}
            className="nodrag nopan w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
          />
        </div>

        <div className="flex flex-col space-y-1">
          <label className="text-xs font-medium text-gray-600">Provider:</label>
          <select
            value={providerDraft}
            onChange={handleProviderChange}
            className="nodrag nopan border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
          >
            <option value="ollama">Ollama</option>
            <option value="openai">OpenAI</option>
          </select>
        </div>
        
        {providerDraft === 'ollama' && (
          <div className="flex flex-col space-y-1">
            <label className="text-xs font-medium text-gray-600">Ollama URL (Optional):</label>
            <input
              type="text"
              name="ollamaUrl"
              value={ollamaUrlDraft}
              onChange={handleOllamaUrlChange}
              onBlur={() => saveContent()}
              onKeyDown={handleKeyDown}
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={handleCompositionEnd}
              className="nodrag nopan border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
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