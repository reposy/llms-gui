import React, { useCallback, useEffect, useState } from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';
import { useDispatch, useSelector } from 'react-redux';
import { updateNodeData, setNodeViewMode, getNodeEffectiveViewMode, VIEW_MODES, NodeViewMode, GlobalViewMode } from '../../store/flowSlice';
import { LLMNodeData } from '../../types/nodes';
import { useIsRootNode, useNodeState, executeFlow } from '../../store/flowExecutionStore';
import { RootState } from '../../store/store';
import NodeErrorBoundary from './NodeErrorBoundary';
import clsx from 'clsx';
// Import shared components
import { NodeHeader } from './shared/NodeHeader';
import { NodeStatusIndicator } from './shared/NodeStatusIndicator';

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

  // Update drafts when data changes externally
  useEffect(() => {
    if (!isComposing) {
      setPromptDraft(data.prompt || '');
    }
  }, [data.prompt, isComposing]);

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

  // Encapsulate label update logic for the shared component
  const handleLabelUpdate = useCallback((nodeId: string, newLabel: string) => {
    dispatch(updateNodeData({ nodeId, data: { ...data, label: newLabel } }));
  }, [dispatch, data]); // id is implicitly captured

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
      {/* Use NodeHeader */}
      <NodeHeader
        nodeId={id}
        label={data.label || 'LLM'}
        placeholderLabel="LLM"
        isRootNode={isRootNode}
        isRunning={nodeState?.status === 'running'}
        viewMode={viewMode}
        themeColor="blue"
        onRun={handleRun}
        onLabelUpdate={handleLabelUpdate}
        onToggleView={toggleNodeView}
      />
      
      {/* Compact content */}
      <div className="text-sm text-gray-600">
        {data.provider} | {data.model}
        {data.temperature && ` | ${data.temperature}`}
      </div>
      <div className="text-sm text-gray-600 line-clamp-2">
        {data.prompt || 'No prompt set'}
      </div>

      {/* Use NodeStatusIndicator */}
      <NodeStatusIndicator status={nodeState?.status ?? 'idle'} error={nodeState?.error} />
    </>
  );

  const renderExpandedView = () => (
    <>
      {/* Use NodeHeader */}
      <NodeHeader
        nodeId={id}
        label={data.label || 'LLM'}
        placeholderLabel="LLM"
        isRootNode={isRootNode}
        isRunning={nodeState?.status === 'running'}
        viewMode={viewMode}
        themeColor="blue"
        onRun={handleRun}
        onLabelUpdate={handleLabelUpdate}
        onToggleView={toggleNodeView}
      />

      {/* Expanded content */}
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

        {/* Use NodeStatusIndicator */}
        <NodeStatusIndicator status={nodeState?.status ?? 'idle'} error={nodeState?.error} />

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
      <div className="relative w-[350px]">
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
            left: '-4px',
            zIndex: 50
          }}
        />

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
            right: '-4px',
            zIndex: 50
          }}
        />

        <div
          className={clsx(
            'px-4 py-2 shadow-md rounded-md bg-white',
            'border',
            selected
              ? 'border-blue-500 ring-2 ring-blue-300 ring-offset-1 shadow-lg'
              : 'border-blue-200 shadow-sm'
          )}
        >
          {viewMode === VIEW_MODES.COMPACT ? renderCompactView() : renderExpandedView()}
        </div>
      </div>
    </NodeErrorBoundary>
  );
};

export default LLMNode; 