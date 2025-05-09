// src/components/nodes/LLMNodeExpandedView.tsx
import React, { useCallback, useMemo } from 'react';
import { LLMNodeData } from '../../types/nodes';
import { NodeState } from '../../types/execution';
import { NodeStatusIndicator } from './shared/NodeStatusIndicator';
import LLMNodeHeader from './LLMNodeHeader';
import { NodeViewMode } from '../../store/viewModeStore';
import { useLlmNodeData } from '../../hooks/useLlmNodeData';
import { useNodeConnections } from '../../hooks/useNodeConnections';

// 디버깅 모드 설정
const DEBUG_LOGS = false;

interface LLMNodeExpandedViewProps {
  id: string;
  data: LLMNodeData;
  nodeState: NodeState | null;
  viewMode: NodeViewMode;
  onToggleView: () => void;
}

// LLMResult를 ReactNode로 변환하는 함수 추가
const renderResponseContent = (content: string | any | React.ReactNode): React.ReactNode => {
  if (content === null || content === undefined) {
    return <span className="text-gray-400">No result yet.</span>;
  }
  
  if (React.isValidElement(content)) {
    return content;
  }
  
  if (typeof content === 'string') {
    return content;
  }
  
  // LLMResult 또는 객체인 경우 JSON으로 변환하여 표시
  try {
    return JSON.stringify(content, null, 2);
  } catch (error) {
    return String(content);
  }
};

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
    mode,
    label,
    responseContent,
    handlePromptChange,
    handleModelChange,
    handleTemperatureChange,
    updateContent,
    handleOllamaUrlChange,
    setMode
  } = useLlmNodeData({ nodeId: id });
  
  const { incoming } = useNodeConnections(id);
  
  const hasImageInputs = useMemo(() => {
    return incoming.length > 0;
  }, [incoming]);

  const canEnableVisionMode = useMemo(() => {
    const hasInputs = hasImageInputs;
    if (DEBUG_LOGS) {
      console.log(`[LLMNodeExpandedView] Node ${id} can${hasInputs ? '' : 'not'} use vision mode (has image inputs: ${hasInputs})`);
    }
    return hasInputs;
  }, [id, hasImageInputs]);

  const nodeStatus = useMemo(() => {
    if (!nodeState) return 'idle';
    return nodeState.status || 'idle';
  }, [nodeState]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey || e.currentTarget instanceof HTMLInputElement)) {
      e.preventDefault();
      e.currentTarget.blur();
    }
  }, []);

  // 실제 렌더링
  return (
    <div className="llm-node-container">
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
            onChange={(e) => handleModelChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className="nodrag nopan border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white text-black"
            placeholder="e.g., llama3:latest"
          />
        </div>
        
        <div className="flex flex-col space-y-1">
          <label className="text-xs font-medium text-gray-600">Prompt:</label>
          <textarea
            value={prompt}
            onChange={(e) => handlePromptChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className="nodrag nopan border border-gray-300 rounded px-2 py-1 text-sm h-24 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white text-black"
            placeholder="Enter your prompt here..."
          />
        </div>

        <div className="flex flex-col space-y-1">
          <label className="text-xs font-medium text-gray-600 flex justify-between">
            <span>Temperature:</span>
            <span>{temperature !== undefined ? temperature.toFixed(1) : '0.0'}</span>
          </label>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={temperature}
            onChange={(e) => handleTemperatureChange(parseFloat(e.target.value))}
            className="nodrag nopan w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div className="flex flex-col space-y-1">
          <label className="text-xs font-medium text-gray-600">Provider:</label>
          <select
            value={provider || 'ollama'}
            onChange={(e) => {
              const newValue = e.target.value as 'ollama' | 'openai';
              updateContent({ provider: newValue });
            }}
            className="nodrag nopan border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white text-black"
          >
            <option value="ollama">Ollama</option>
            <option value="openai">OpenAI</option>
          </select>
        </div>
        
        {/* Mode Selection */}
        <div className="flex flex-col space-y-1">
          <label className="text-xs font-medium text-gray-600">Mode:</label>
          <div className="flex space-x-2">
            <button
              className={`nodrag nopan flex-1 px-2 py-1 text-xs rounded ${
                mode === 'text' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
              onClick={(e) => { 
                e.stopPropagation();
                setMode('text'); 
              }}
            >
              Text
            </button>
            <button
              title={!canEnableVisionMode ? '이미지 입력이 필요합니다. 입력 노드를 연결하세요.' : '비전 모드 사용'}
              className={`nodrag nopan flex-1 px-2 py-1 text-xs rounded ${
                mode === 'vision' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              } ${!canEnableVisionMode ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-300'}`}
              onClick={(e) => { 
                e.stopPropagation();
                if (canEnableVisionMode) {
                  setMode('vision');
                } 
              }}
            >
              Vision
            </button>
          </div>
        </div>
      </div>
      {/* Result 영역 추가 */}
      <div className="mt-3 text-sm font-mono p-2 bg-gray-100 rounded max-h-[150px] overflow-auto">
        {renderResponseContent(responseContent)}
      </div>
    </div>
  );
});