import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { LLMNodeData } from '../../types/nodes';
import { NodeState } from '../../types/execution';
import { NodeStatusIndicator } from './shared/NodeStatusIndicator';
import { LLMNodeHeader } from './LLMNodeHeader';
import { NodeViewMode } from '../../store/viewModeSlice';
import { updateNodeData } from '../../store/flowSlice';
import { debounce } from 'lodash';
import { isEditingNodeRef } from '../../hooks/useFlowSync';

interface LLMNodeExpandedViewProps {
  id: string;
  data: LLMNodeData;
  nodeState: NodeState | undefined;
  viewMode: NodeViewMode;
  onToggleView: () => void;
}

export const LLMNodeExpandedView: React.FC<LLMNodeExpandedViewProps> = ({
  id,
  data,
  nodeState,
  viewMode,
  onToggleView
}) => {
  const dispatch = useDispatch();
  const [promptDraft, setPromptDraft] = useState(data.prompt || '');
  const [modelDraft, setModelDraft] = useState(data.model || '');
  const [isComposing, setIsComposing] = useState(false);
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [isEditingModel, setIsEditingModel] = useState(false);
  const modelInputRef = useRef<HTMLInputElement>(null);
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null);
  const lastPromptRef = useRef(data.prompt || '');

  // Create debounced update function
  const debouncedUpdatePrompt = useRef(
    debounce((value: string) => {
      // Only update if not composing and the value has actually changed
      if (!isComposing && value !== lastPromptRef.current) {
        lastPromptRef.current = value;
        dispatch(updateNodeData({
          nodeId: id,
          data: { ...data, prompt: value }
        }));
      }
    }, 500)
  ).current;

  // Map the execution state to the status indicator format
  const nodeStatus = useMemo(() => {
    if (!nodeState) return 'idle';
    
    // Map 'skipped' to 'idle' for the NodeStatusIndicator
    return nodeState.status === 'skipped' 
      ? 'idle' 
      : nodeState.status === 'running' || nodeState.status === 'success' || nodeState.status === 'error'
        ? nodeState.status
        : 'idle';
  }, [nodeState]);

  // Initialize drafts on first render or when node ID changes
  useEffect(() => {
    setPromptDraft(data.prompt || '');
    setModelDraft(data.model || '');
    lastPromptRef.current = data.prompt || '';
  }, [id, data.prompt, data.model]);
  
  // Only sync external prompt changes with local state when not actively editing
  useEffect(() => {
    // Only update local draft if we're not composing or editing, AND the data has actually changed
    if (!isComposing && !isEditingPrompt && data.prompt !== promptDraft && data.prompt !== undefined) {
      setPromptDraft(data.prompt);
      lastPromptRef.current = data.prompt;
    }
  }, [data.prompt, promptDraft, isComposing, isEditingPrompt]);

  // Only sync external model changes when not actively editing
  useEffect(() => {
    if (!isEditingModel && data.model !== modelDraft && data.model !== undefined) {
      setModelDraft(data.model);
    }
  }, [data.model, modelDraft, isEditingModel]);

  // Restore focus to model input after Redux update if still editing
  useEffect(() => {
    if (isEditingModel && modelInputRef.current) {
      modelInputRef.current.focus();
      
      // Place cursor at the end
      const length = modelInputRef.current.value.length;
      modelInputRef.current.setSelectionRange(length, length);
    }
  }, [isEditingModel, data.model]);

  // Clean up debounced function on unmount
  useEffect(() => {
    return () => {
      debouncedUpdatePrompt.cancel();
    };
  }, [debouncedUpdatePrompt]);

  const handlePromptChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newPrompt = e.target.value;
    setPromptDraft(newPrompt);
    
    // Never dispatch during composition
    if (!isComposing) {
      debouncedUpdatePrompt(newPrompt);
    }
  }, [debouncedUpdatePrompt, isComposing]);

  const handlePromptFocus = useCallback(() => {
    setIsEditingPrompt(true);
    isEditingNodeRef.current = id; // Mark this node as being edited
  }, [id]);

  const handlePromptBlur = useCallback(() => {
    setIsEditingPrompt(false);
    isEditingNodeRef.current = null; // Clear the editing node reference
    
    // Always save draft to Redux on blur (even if not changed)
    // This ensures the latest value is always in Redux
    debouncedUpdatePrompt.cancel(); // Cancel any pending updates
    lastPromptRef.current = promptDraft;
    dispatch(updateNodeData({
      nodeId: id,
      data: { ...data, prompt: promptDraft }
    }));
  }, [dispatch, id, data, promptDraft, debouncedUpdatePrompt]);

  const handlePromptKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Prevent bubbling to ReactFlow
    e.stopPropagation();
    
    // Save on Enter + Ctrl/Cmd
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      debouncedUpdatePrompt.cancel();
      lastPromptRef.current = promptDraft;
      dispatch(updateNodeData({
        nodeId: id,
        data: { ...data, prompt: promptDraft }
      }));
    }
  }, [dispatch, id, data, promptDraft, debouncedUpdatePrompt]);

  const handleModelChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newModel = e.target.value;
    setModelDraft(newModel);
  }, []);

  const handleModelFocus = useCallback(() => {
    setIsEditingModel(true);
    isEditingNodeRef.current = id; // Mark this node as being edited
  }, [id]);

  const handleModelBlur = useCallback(() => {
    setIsEditingModel(false);
    isEditingNodeRef.current = null; // Clear the editing node reference
    
    // Always update Redux when focus is lost (even if not changed)
    // This ensures the latest value is always in Redux
    dispatch(updateNodeData({
      nodeId: id,
      data: { ...data, model: modelDraft }
    }));
  }, [dispatch, id, data, modelDraft]);

  const handleModelKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    // Stop propagation for all keyboard events when editing the model
    e.stopPropagation();
    
    // Save on Enter
    if (e.key === 'Enter' && modelDraft !== data.model) {
      dispatch(updateNodeData({
        nodeId: id,
        data: { ...data, model: modelDraft }
      }));
      // Blur the input to match expected behavior
      e.currentTarget.blur();
    }
  }, [dispatch, id, data, modelDraft]);

  const handlePromptCompositionStart = useCallback(() => {
    setIsComposing(true);
    isEditingNodeRef.current = id; // Ensure node is marked as editing during composition
  }, [id]);

  const handlePromptCompositionEnd = useCallback((e: React.CompositionEvent<HTMLTextAreaElement>) => {
    setIsComposing(false);
    const newPrompt = e.currentTarget.value;
    setPromptDraft(newPrompt);
    
    // Wait for IME to fully complete before scheduling an update
    setTimeout(() => {
      if (newPrompt !== lastPromptRef.current) {
        debouncedUpdatePrompt(newPrompt);
      }
    }, 0);
  }, [debouncedUpdatePrompt]);

  const handleTemperatureChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    // Directly dispatch for sliders - not impacting typing performance
    dispatch(updateNodeData({
      nodeId: id,
      data: { ...data, temperature: value }
    }));
  }, [dispatch, id, data]);

  const handleProviderChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    dispatch(updateNodeData({
      nodeId: id,
      data: { ...data, provider: e.target.value as 'ollama' | 'openai' }
    }));
  }, [dispatch, id, data]);

  return (
    <>
      <LLMNodeHeader
        id={id}
        data={data}
        viewMode={viewMode}
        onToggleView={onToggleView}
      />

      {/* Expanded content */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <select
            value={data.provider}
            onChange={handleProviderChange}
            className="shrink-0 px-2 py-1 text-sm bg-white border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyDown={(e) => e.stopPropagation()}
          >
            <option value="ollama">Ollama</option>
            <option value="openai">OpenAI</option>
          </select>

          <input
            ref={modelInputRef}
            type="text"
            value={isEditingModel ? modelDraft : data.model}
            onChange={handleModelChange}
            onFocus={handleModelFocus}
            onBlur={handleModelBlur}
            onKeyDown={handleModelKeyDown}
            placeholder="Model name"
            className="flex-1 px-2 py-1 text-sm bg-white border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="space-y-1">
          <div className="text-xs font-medium text-gray-600">Prompt</div>
          <textarea
            ref={promptTextareaRef}
            value={promptDraft}
            onChange={handlePromptChange}
            onFocus={handlePromptFocus}
            onBlur={handlePromptBlur}
            onKeyDown={handlePromptKeyDown}
            onCompositionStart={handlePromptCompositionStart}
            onCompositionEnd={handlePromptCompositionEnd}
            placeholder="Enter your prompt here..."
            className="w-full h-32 px-2 py-1 text-sm bg-white border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <div className="space-y-1">
          <div className="text-xs font-medium text-gray-600">Settings</div>
          <div className="flex gap-2">
            <div className="flex-1">
              <div className="text-xs text-gray-600 mb-1">Temperature</div>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={data.temperature || 0.7}
                onChange={handleTemperatureChange}
                onKeyDown={(e) => e.stopPropagation()}
                className="w-full"
              />
              <div className="text-xs text-gray-600 text-right">{data.temperature || 0.7}</div>
            </div>
          </div>
        </div>

        <NodeStatusIndicator status={nodeStatus} error={nodeState?.error} />

        {/* Result Preview */}
        {nodeState?.status === 'success' && nodeState?.result !== null && nodeState?.result !== undefined && (
          <div className="space-y-1">
            <div className="text-xs font-medium text-gray-600">Result</div>
            <div className="p-2 text-xs font-mono bg-gray-50 rounded border border-gray-200 max-h-[100px] overflow-auto">
              {typeof nodeState.result === 'string' 
                ? nodeState.result
                : (
                  <span className="text-red-500">(Error: Unexpected result format. Check console.)</span>
                )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}; 