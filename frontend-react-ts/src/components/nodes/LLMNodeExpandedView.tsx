import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { LLMNodeData } from '../../types/nodes';
import { NodeState } from '../../types/execution';
import { NodeStatusIndicator } from './shared/NodeStatusIndicator';
import { LLMNodeHeader } from './LLMNodeHeader';
import { NodeViewMode } from '../../store/viewModeSlice';
import { updateNodeData } from '../../store/flowSlice';
import { debounce } from 'lodash';
import { isEditingNodeRef, useFlowSync } from '../../hooks/useFlowSync';
import { NodeContent, useNodeContent } from '../../store/nodeContentStore';

interface LLMNodeExpandedViewProps {
  id: string;
  data: LLMNodeData;
  nodeState: NodeState | null;
  viewMode: NodeViewMode;
  onToggleView: () => void;
  nodeContent: NodeContent;
}

export const LLMNodeExpandedView: React.FC<LLMNodeExpandedViewProps> = ({
  id,
  data,
  nodeState,
  viewMode,
  onToggleView,
  nodeContent
}) => {
  const dispatch = useDispatch();
  const [promptDraft, setPromptDraft] = useState(nodeContent.prompt || '');
  const [modelDraft, setModelDraft] = useState(nodeContent.model || '');
  const [isComposing, setIsComposing] = useState(false);
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [isEditingModel, setIsEditingModel] = useState(false);
  const modelInputRef = useRef<HTMLInputElement>(null);
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null);
  const lastPromptRef = useRef(nodeContent.prompt || '');
  
  // Access the flow sync utilities for committing to Redux
  const { markNodeDirty, commitChanges } = useFlowSync({ 
    isRestoringHistory: useRef(false)
  });
  
  // Access node content store utilities
  const { setContent, markDirty } = useNodeContent(id);

  // Create debounced update function - but now update the content store instead of Redux
  const debouncedUpdatePrompt = useRef(
    debounce((value: string) => {
      // Only update if not composing and the value has actually changed
      if (!isComposing && value !== lastPromptRef.current) {
        lastPromptRef.current = value;
        setContent({ prompt: value });
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

  // Initialize drafts on first render or when node content changes
  useEffect(() => {
    if (!isEditingPrompt && !isComposing) {
      setPromptDraft(nodeContent.prompt || '');
      lastPromptRef.current = nodeContent.prompt || '';
    }
    
    if (!isEditingModel) {
      setModelDraft(nodeContent.model || '');
    }
  }, [id, nodeContent.prompt, nodeContent.model, isEditingPrompt, isEditingModel, isComposing]);

  // Clean up debounced function on unmount
  useEffect(() => {
    return () => {
      debouncedUpdatePrompt.cancel();
    };
  }, [debouncedUpdatePrompt]);

  // Function to sync content from content store to Redux
  const syncToRedux = useCallback(() => {
    // Only sync if we have content
    if (nodeContent) {
      dispatch(updateNodeData({
        nodeId: id,
        data: { 
          ...data, 
          prompt: nodeContent.prompt, 
          model: nodeContent.model,
          temperature: nodeContent.temperature,
          provider: nodeContent.provider as 'ollama' | 'openai',
          ollamaUrl: nodeContent.ollamaUrl,
          label: nodeContent.label
        }
      }));
      
      // Mark content as not dirty after syncing
      markDirty(false);
      
      // Ensure changes are committed to Redux
      commitChanges();
    }
  }, [dispatch, id, data, nodeContent, markDirty, commitChanges]);

  const handlePromptChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newPrompt = e.target.value;
    setPromptDraft(newPrompt);
    
    // Update the content store
    setContent({ prompt: newPrompt });
    
    // Mark the node as dirty for React Flow sync
    markNodeDirty(id);
  }, [id, markNodeDirty, setContent]);

  const handlePromptFocus = useCallback(() => {
    setIsEditingPrompt(true);
    isEditingNodeRef.current = id; // Mark this node as being edited
  }, [id]);

  const handlePromptBlur = useCallback(() => {
    setIsEditingPrompt(false);
    isEditingNodeRef.current = null; // Clear the editing node reference
    
    // Update node content store with final value
    setContent({ prompt: promptDraft });
    lastPromptRef.current = promptDraft;
    
    // Sync to Redux on blur
    syncToRedux();
  }, [id, promptDraft, setContent, syncToRedux]);

  const handlePromptKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Prevent bubbling to ReactFlow
    e.stopPropagation();
    
    // Save on Enter + Ctrl/Cmd
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      // Update the content store
      setContent({ prompt: promptDraft });
      lastPromptRef.current = promptDraft;
      
      // Sync to Redux
      syncToRedux();
    }
  }, [promptDraft, setContent, syncToRedux]);

  const handleModelChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newModel = e.target.value;
    setModelDraft(newModel);
    
    // Update the content store
    setContent({ model: newModel });
    
    // Mark the node as dirty for React Flow
    markNodeDirty(id);
  }, [id, markNodeDirty, setContent]);

  const handleModelFocus = useCallback(() => {
    setIsEditingModel(true);
    isEditingNodeRef.current = id; // Mark this node as being edited
  }, [id]);

  const handleModelBlur = useCallback(() => {
    setIsEditingModel(false);
    isEditingNodeRef.current = null; // Clear the editing node reference
    
    // Update content store
    setContent({ model: modelDraft });
    
    // Sync to Redux
    syncToRedux();
  }, [id, modelDraft, setContent, syncToRedux]);

  const handleModelKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    // Stop propagation for all keyboard events when editing the model
    e.stopPropagation();
    
    // Save on Enter
    if (e.key === 'Enter') {
      // Update content store
      setContent({ model: modelDraft });
      
      // Sync to Redux
      syncToRedux();
      
      // Blur the input to match expected behavior
      e.currentTarget.blur();
    }
  }, [modelDraft, setContent, syncToRedux]);

  const handlePromptCompositionStart = useCallback(() => {
    setIsComposing(true);
    isEditingNodeRef.current = id; // Ensure node is marked as editing during composition
  }, [id]);

  const handlePromptCompositionEnd = useCallback((e: React.CompositionEvent<HTMLTextAreaElement>) => {
    setIsComposing(false);
    const newPrompt = e.currentTarget.value;
    setPromptDraft(newPrompt);
    
    // Update content store
    setContent({ prompt: newPrompt });
    
    // Mark the node as dirty
    markNodeDirty(id);
  }, [id, markNodeDirty, setContent]);

  const handleTemperatureChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    
    // Update content store
    setContent({ temperature: value });
    
    // Mark the node as dirty
    markNodeDirty(id);
    
    // For UI responsiveness, we also update Redux immediately
    syncToRedux();
  }, [id, markNodeDirty, setContent, syncToRedux]);

  const handleProviderChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    // Update content store
    setContent({ provider: e.target.value as 'ollama' | 'openai' });
    
    // Mark the node as dirty
    markNodeDirty(id);
    
    // For UI responsiveness, we also update Redux immediately
    syncToRedux();
  }, [id, markNodeDirty, setContent, syncToRedux]);

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
            className="flex-1 p-1 border border-gray-300 rounded bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            value={nodeContent.provider || data.provider}
            onChange={handleProviderChange}
          >
            <option value="openai">OpenAI</option>
            <option value="ollama">Ollama</option>
          </select>
          <input
            ref={modelInputRef}
            type="text"
            className="flex-1 p-1 border border-gray-300 rounded bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            placeholder="Model (e.g., gpt-4-turbo)"
            value={modelDraft}
            onChange={handleModelChange}
            onFocus={handleModelFocus}
            onBlur={handleModelBlur}
            onKeyDown={handleModelKeyDown}
          />
        </div>

        <div className="flex items-center justify-between gap-2">
          <label className="text-xs text-gray-600">Temperature</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            className="w-32"
            value={nodeContent.temperature || data.temperature}
            onChange={handleTemperatureChange}
          />
          <span className="text-xs w-6 text-right">
            {nodeContent.temperature !== undefined 
              ? nodeContent.temperature.toFixed(2) 
              : data.temperature.toFixed(2)}
          </span>
        </div>

        <div className="flex flex-col">
          <label className="text-xs text-gray-600 mb-1">Prompt</label>
          <div className="relative">
            <NodeStatusIndicator 
              status={nodeStatus} 
              className="absolute -right-1 -top-1" 
            />
            <textarea
              ref={promptTextareaRef}
              className="w-full h-[8em] p-2 border border-gray-300 rounded bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="Enter your prompt here..."
              value={promptDraft}
              onChange={handlePromptChange}
              onFocus={handlePromptFocus}
              onBlur={handlePromptBlur}
              onKeyDown={handlePromptKeyDown}
              onCompositionStart={handlePromptCompositionStart}
              onCompositionEnd={handlePromptCompositionEnd}
            ></textarea>
          </div>
        </div>

        {/* Display execution result when available */}
        {nodeState?.status === 'success' && nodeState.result && (
          <div className="text-xs text-gray-800 mt-1 mb-1 bg-gray-100 p-2 rounded border border-gray-300 max-h-16 overflow-y-auto">
            <div className="font-semibold text-gray-600 mb-1">Result Preview:</div>
            <div className="whitespace-pre-line line-clamp-2">
              {typeof nodeState.result === 'string' 
                ? nodeState.result 
                : JSON.stringify(nodeState.result, null, 2)}
            </div>
          </div>
        )}

        {nodeState?.error && (
          <div className="text-xs text-red-500 mt-1">
            Error: {nodeState.error}
          </div>
        )}
      </div>
    </>
  );
}; 