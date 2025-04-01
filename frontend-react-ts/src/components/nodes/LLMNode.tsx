import React, { useCallback, useEffect, useState } from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';
import { useDispatch, useSelector } from 'react-redux';
import { updateNodeData, setNodeViewMode, getNodeEffectiveViewMode, VIEW_MODES, NodeViewMode, GlobalViewMode } from '../../store/flowSlice';
import { LLMNodeData } from '../../types/nodes';
import { useIsRootNode, useNodeState, executeFlow } from '../../store/flowExecutionStore';
import { RootState } from '../../store/store';
import NodeErrorBoundary from './NodeErrorBoundary';
import clsx from 'clsx';

interface Props {
  id: string;
  data: LLMNodeData;
  isConnectable: boolean;
  selected?: boolean;
}

const LLMNode: React.FC<Props> = ({ id, data, isConnectable, selected }) => {
  const dispatch = useDispatch();
  const isRootNode = useIsRootNode(id);
  const nodeState = useNodeState(id);
  const { getZoom } = useReactFlow();
  const viewMode = useSelector((state: RootState) => getNodeEffectiveViewMode(state, id)) as NodeViewMode;
  const globalViewMode = useSelector((state: RootState) => state.flow.globalViewMode) as GlobalViewMode;
  const [promptDraft, setPromptDraft] = useState(data.prompt || '');
  const [isComposing, setIsComposing] = useState(false);
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState(data.label || 'LLM');

  // Update drafts when data changes externally
  useEffect(() => {
    if (!isComposing) {
      setPromptDraft(data.prompt || '');
    }
  }, [data.prompt, isComposing]);

  // Update label draft when data changes externally
  useEffect(() => {
    setLabelDraft(data.label || 'LLM');
  }, [data.label]);

  const handlePromptChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newPrompt = e.target.value;
    setPromptDraft(newPrompt);
    
    if (!isComposing) {
      dispatch(updateNodeData({
        nodeId: id,
        data: { ...data, prompt: newPrompt }
      }));
    }
  }, [dispatch, id, data, isComposing]);

  const handlePromptCompositionEnd = useCallback((e: React.CompositionEvent<HTMLTextAreaElement>) => {
    setIsComposing(false);
    const newPrompt = e.currentTarget.value;
    
    dispatch(updateNodeData({
      nodeId: id,
      data: { ...data, prompt: newPrompt }
    }));
  }, [dispatch, id, data]);

  const handleLabelChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLabelDraft(e.target.value);
  }, []);

  const handleLabelBlur = useCallback(() => {
    setIsEditingLabel(false);
    if (labelDraft.trim() !== data.label) {
      dispatch(updateNodeData({
        nodeId: id,
        data: { ...data, label: labelDraft.trim() || 'LLM' }
      }));
    }
  }, [dispatch, id, data, labelDraft]);

  const handleLabelKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      setIsEditingLabel(false);
      setLabelDraft(data.label || 'LLM');
    }
  }, [data.label]);

  const handleProviderChange = useCallback((provider: 'ollama' | 'openai') => {
    dispatch(updateNodeData({
      nodeId: id,
      data: { 
        ...data, 
        provider,
        // Reset model when changing provider
        model: provider === 'ollama' ? 'llama2' : 'gpt-3.5-turbo'
      }
    }));
  }, [dispatch, id, data]);

  const handleModelChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(updateNodeData({
      nodeId: id,
      data: { ...data, model: e.target.value }
    }));
  }, [dispatch, id, data]);

  const handleTemperatureChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const temp = parseFloat(e.target.value);
    if (!isNaN(temp) && temp >= 0 && temp <= 1) {
      dispatch(updateNodeData({
        nodeId: id,
        data: { ...data, temperature: temp }
      }));
    }
  }, [dispatch, id, data]);

  const handleUrlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(updateNodeData({
      nodeId: id,
      data: { ...data, ollamaUrl: e.target.value }
    }));
  }, [dispatch, id, data]);

  const handleRun = useCallback(() => {
    executeFlow(id);
  }, [id]);

  const toggleNodeView = () => {
    dispatch(setNodeViewMode({
      nodeId: id,
      mode: viewMode === VIEW_MODES.COMPACT ? VIEW_MODES.EXPANDED : VIEW_MODES.COMPACT
    }));
  };

  // Auto-collapse based on zoom level if in auto mode
  useEffect(() => {
    if (globalViewMode === VIEW_MODES.AUTO) {
      const zoom = getZoom();
      const shouldBeCompact = zoom < 0.7;
      dispatch(setNodeViewMode({ 
        nodeId: id, 
        mode: shouldBeCompact ? VIEW_MODES.COMPACT : VIEW_MODES.EXPANDED 
      }));
    }
  }, [globalViewMode, getZoom, id, dispatch]);

  const renderCompactView = () => (
    <>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {isRootNode ? (
            <button
              onClick={handleRun}
              className="shrink-0 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
              title="Run full flow from this node"
            >
              {nodeState?.status === 'running' ? '⏳' : '▶'} Run
            </button>
          ) : (
            <div 
              className="shrink-0 px-2 py-1 text-xs font-medium bg-gray-100 text-gray-400 rounded cursor-not-allowed"
              title="Only root nodes can be executed"
            >
              ▶
            </div>
          )}
          
          {isEditingLabel ? (
            <input
              type="text"
              value={labelDraft}
              onChange={handleLabelChange}
              onBlur={handleLabelBlur}
              onKeyDown={handleLabelKeyDown}
              className="px-1 py-0.5 text-sm font-bold text-blue-500 border border-blue-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
              style={{ width: `${Math.max(labelDraft.length * 8, 60)}px` }}
            />
          ) : (
            <div
              onClick={() => setIsEditingLabel(true)}
              className="font-bold text-blue-500 cursor-text hover:bg-blue-50 px-1 py-0.5 rounded"
              title="Click to edit node name"
            >
              {data.label || 'LLM'}
            </div>
          )}

          <button
            onClick={toggleNodeView}
            className="shrink-0 w-6 h-6 flex items-center justify-center text-xs text-gray-400 hover:text-gray-600 transition-colors rounded hover:bg-gray-100"
            title={viewMode === VIEW_MODES.COMPACT ? 'Show more details' : 'Show less details'}
          >
            {viewMode === VIEW_MODES.COMPACT ? '⌄' : '⌃'}
          </button>
        </div>
      </div>

      <div className="text-sm text-gray-600">
        {data.provider} | {data.model}
        {data.temperature && ` | ${data.temperature}`}
      </div>
      <div className="text-sm text-gray-600 line-clamp-2">
        {data.prompt || 'No prompt set'}
      </div>
      {nodeState?.status !== 'idle' && (
        <div className="flex items-center gap-1 text-xs py-1">
          {nodeState.status === 'running' && (
            <span className="text-yellow-600">⏳ Running...</span>
          )}
          {nodeState.status === 'success' && (
            <span className="text-green-600">✅ Success</span>
          )}
          {nodeState.status === 'error' && (
            <span className="text-red-600" title={nodeState.error}>❌ Error</span>
          )}
        </div>
      )}
    </>
  );

  const renderExpandedView = () => (
    <>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {isRootNode ? (
            <button
              onClick={handleRun}
              className="shrink-0 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
              title="Run full flow from this node"
            >
              {nodeState?.status === 'running' ? '⏳' : '▶'} Run
            </button>
          ) : (
            <div 
              className="shrink-0 px-2 py-1 text-xs font-medium bg-gray-100 text-gray-400 rounded cursor-not-allowed"
              title="Only root nodes can be executed"
            >
              ▶
            </div>
          )}
          
          {isEditingLabel ? (
            <input
              type="text"
              value={labelDraft}
              onChange={handleLabelChange}
              onBlur={handleLabelBlur}
              onKeyDown={handleLabelKeyDown}
              className="px-1 py-0.5 text-sm font-bold text-blue-500 border border-blue-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
              style={{ width: `${Math.max(labelDraft.length * 8, 60)}px` }}
            />
          ) : (
            <div
              onClick={() => setIsEditingLabel(true)}
              className="font-bold text-blue-500 cursor-text hover:bg-blue-50 px-1 py-0.5 rounded"
              title="Click to edit node name"
            >
              {data.label || 'LLM'}
            </div>
          )}

          <button
            onClick={toggleNodeView}
            className="shrink-0 w-6 h-6 flex items-center justify-center text-xs text-gray-400 hover:text-gray-600 transition-colors rounded hover:bg-gray-100"
            title={viewMode === VIEW_MODES.COMPACT ? 'Show more details' : 'Show less details'}
          >
            {viewMode === VIEW_MODES.COMPACT ? '⌄' : '⌃'}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex gap-2">
          <select
            value={data.provider}
            onChange={(e) => dispatch(updateNodeData({
              nodeId: id,
              data: { ...data, provider: e.target.value as 'ollama' | 'openai' }
            }))}
            className="shrink-0 px-2 py-1 text-sm bg-white border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ollama">Ollama</option>
            <option value="openai">OpenAI</option>
          </select>

          <input
            type="text"
            value={data.model}
            onChange={(e) => dispatch(updateNodeData({
              nodeId: id,
              data: { ...data, model: e.target.value }
            }))}
            placeholder="Model name"
            className="flex-1 px-2 py-1 text-sm bg-white border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="space-y-1">
          <div className="text-xs font-medium text-gray-600">Prompt</div>
          <textarea
            value={promptDraft}
            onChange={handlePromptChange}
            onCompositionStart={() => setIsComposing(true)}
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
                onChange={(e) => dispatch(updateNodeData({
                  nodeId: id,
                  data: { ...data, temperature: parseFloat(e.target.value) }
                }))}
                className="w-full"
              />
              <div className="text-xs text-gray-600 text-right">{data.temperature || 0.7}</div>
            </div>
          </div>
        </div>

        {/* Execution Status */}
        {nodeState?.status !== 'idle' && (
          <div className="flex items-center gap-1 text-xs">
            {nodeState.status === 'running' && (
              <span className="text-yellow-600">⏳ Running...</span>
            )}
            {nodeState.status === 'success' && (
              <span className="text-green-600">✅ Success</span>
            )}
            {nodeState.status === 'error' && (
              <span className="text-red-600" title={nodeState.error}>❌ Error</span>
            )}
          </div>
        )}

        {/* Result Preview */}
        {nodeState?.result && (
          <div className="space-y-1">
            <div className="text-xs font-medium text-gray-600">Result</div>
            <div className="p-2 text-xs font-mono bg-gray-50 rounded border border-gray-200 max-h-[100px] overflow-auto">
              {typeof nodeState.result === 'string' 
                ? nodeState.result 
                : JSON.stringify(nodeState.result, null, 2)}
            </div>
          </div>
        )}
      </div>
    </>
  );

  return (
    <NodeErrorBoundary nodeId={id}>
      <div className="relative overflow-visible">
        {/* Input handle */}
        <Handle
          type="target"
          position={Position.Left}
          id={`${id}-target`}
          isConnectable={isConnectable}
          style={{
            background: '#3b82f6',
            border: '1px solid white',
            width: '8px',
            height: '8px',
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 50
          }}
        />

        {/* Output handle */}
        <Handle
          type="source"
          position={Position.Right}
          id={`${id}-source`}
          isConnectable={isConnectable}
          style={{
            background: '#3b82f6',
            border: '1px solid white',
            width: '8px',
            height: '8px',
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 50
          }}
        />

        {/* Node content box */}
        <div className={clsx(
          'w-[350px] px-4 py-2 bg-white rounded-md',
          'ring-1 ring-blue-100',
          selected ? [
            'ring-2 ring-blue-500',
            'shadow-[0_0_0_1px_rgba(59,130,246,0.5)]'
          ] : [
            'shadow-sm'
          ]
        )}>
          <div className="space-y-2">
            {viewMode === VIEW_MODES.COMPACT ? renderCompactView() : renderExpandedView()}
          </div>
        </div>
      </div>
    </NodeErrorBoundary>
  );
};

export default LLMNode; 