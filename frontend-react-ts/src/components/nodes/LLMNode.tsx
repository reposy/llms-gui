import React, { useCallback, useState, useEffect, useRef } from 'react';
import { Handle, Position, useEdges, useNodes, Node } from 'reactflow';
import { useDispatch } from 'react-redux';
import { updateNodeData } from '../../store/flowSlice';
import { LLMNodeData, NodeData } from '../../types/nodes';
import { useFlowExecution } from '../../store/flowExecutionStore';

interface Props {
  id: string;
  data: LLMNodeData;
}

const LLMNode: React.FC<Props> = ({ id, data }) => {
  const dispatch = useDispatch();
  const edges = useEdges();
  const nodes = useNodes() as Node<NodeData>[];
  const flowExecution = useFlowExecution();
  const executionState = flowExecution.getNodeState(id);
  const [prompt, setPrompt] = useState(data.prompt || '');
  const isInitialMount = useRef(true);
  const isRoot = flowExecution.isRootNode(id, edges);

  // Only update prompt when data.prompt changes externally
  useEffect(() => {
    if (data.prompt !== prompt) {
      setPrompt(data.prompt || '');
    }
  }, [data.prompt]);

  // Initialize default values only once on mount
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      const updates: Partial<LLMNodeData> = {};
      
      if (data.temperature === undefined) {
        updates.temperature = 0.5;
      }
      if (data.ollamaUrl === undefined) {
        updates.ollamaUrl = 'http://localhost:11434';
      }
      if (data.model === undefined) {
        updates.model = data.provider === 'openai' ? 'gpt-3.5-turbo' : 'llama2';
      }

      if (Object.keys(updates).length > 0) {
        dispatch(updateNodeData({
          nodeId: id,
          data: { ...data, ...updates }
        }));
      }
    }
  }, []);

  const handleChange = useCallback((key: string, value: any) => {
    dispatch(updateNodeData({
      nodeId: id,
      data: { ...data, [key]: value }
    }));
  }, [dispatch, id, data]);

  const handlePromptChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newPrompt = e.target.value;
    setPrompt(newPrompt);
    handleChange('prompt', newPrompt);
  }, [handleChange]);

  const handleExecute = useCallback(async () => {
    if (!isRoot) return;
    await flowExecution.executeFlow(nodes, edges);
  }, [isRoot, nodes, edges, flowExecution]);

  const isExecuting = executionState.status === 'running';
  const hasError = executionState.status === 'error';
  const errorMessage = executionState.error;

  return (
    <div className="relative px-4 py-2 shadow-md rounded-md bg-white border-2 border-blue-500 min-w-[300px]">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center">
          <div className="w-3 h-3 bg-blue-500 rounded-full mr-2" />
          <div className="font-bold text-blue-500">{data.label || 'LLM'}</div>
        </div>
        {isRoot && (
          <button
            onClick={handleExecute}
            disabled={isExecuting}
            className="flex items-center justify-center gap-1 px-3 py-1 text-sm text-white bg-blue-500 rounded hover:bg-blue-600 disabled:bg-blue-300 disabled:cursor-not-allowed flex-shrink-0 ml-2"
          >
            {isExecuting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                실행중
              </>
            ) : (
              '실행'
            )}
          </button>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex gap-2">
          <select
            value={data.provider || 'ollama'}
            onChange={(e) => handleChange('provider', e.target.value)}
            className="flex-1 p-1 text-sm border rounded bg-white"
          >
            <option value="ollama">Ollama</option>
            <option value="openai">OpenAI</option>
          </select>
          {data.provider === 'openai' ? (
            <select
              value={data.model || 'gpt-3.5-turbo'}
              onChange={(e) => handleChange('model', e.target.value)}
              className="flex-1 p-1 text-sm border rounded bg-white"
            >
              <option value="gpt-4">GPT-4</option>
              <option value="gpt-4-0125-preview">GPT-4-0125-preview</option>
              <option value="gpt-4-turbo-preview">GPT-4-turbo-preview</option>
              <option value="gpt-3.5-turbo">GPT-3.5-turbo</option>
              <option value="gpt-3.5-turbo-0125">GPT-3.5-turbo-0125</option>
            </select>
          ) : null}
        </div>

        {data.provider === 'ollama' && (
          <div className="space-y-2">
            <div>
              <label className="block text-sm font-medium mb-1">URL:</label>
              <input
                type="text"
                value={data.ollamaUrl || 'http://localhost:11434'}
                onChange={(e) => handleChange('ollamaUrl', e.target.value)}
                placeholder="http://localhost:11434"
                className="w-full p-1 text-sm border rounded bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Model:</label>
              <input
                type="text"
                value={data.model || 'llama2'}
                onChange={(e) => handleChange('model', e.target.value)}
                placeholder="llama2, mistral"
                className="w-full p-1 text-sm border rounded bg-white"
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Temperature:</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={data.temperature ?? 0.5}
            onChange={(e) => handleChange('temperature', parseFloat(e.target.value))}
            className="flex-1"
          />
          <span className="text-sm">{data.temperature ?? 0.5}</span>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Prompt:</label>
          <textarea
            value={prompt}
            onChange={handlePromptChange}
            placeholder="프롬프트를 입력하세요..."
            className="w-full p-2 text-sm border rounded resize-none h-[50px] bg-white"
            rows={2}
          />
        </div>
      </div>

      {hasError && errorMessage && (
        <div className="mt-2 text-sm text-red-500">
          {errorMessage}
        </div>
      )}

      <Handle
        type="target"
        position={Position.Left}
        style={{
          width: '8px',
          height: '8px',
          backgroundColor: 'rgb(59 130 246)',
          left: '-4px',
          top: '50%',
          transform: 'translateY(-50%)',
        }}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{
          width: '8px',
          height: '8px',
          backgroundColor: 'rgb(59 130 246)',
          right: '-4px',
          top: '50%',
          transform: 'translateY(-50%)',
        }}
      />
    </div>
  );
};

export default LLMNode; 