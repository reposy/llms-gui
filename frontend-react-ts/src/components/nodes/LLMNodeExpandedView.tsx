import React, { useCallback, useMemo } from 'react';
import { LLMNodeData } from '../../types/nodes';
import { NodeState } from '../../types/execution';
import { NodeStatusIndicator } from './shared/NodeStatusIndicator';
import { LLMNodeHeader } from './LLMNodeHeader';
import { NodeViewMode } from '../../store/viewModeStore';
import { useLlmNodeData } from '../../hooks/useLlmNodeData';
import { useNodeConnections } from '../../hooks/useNodeConnections';

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
    mode,
    label,
    responseContent,
    isDirty,
    handlePromptChange,
    handleModelChange,
    handleTemperatureChange,
    handleProviderChange,
    handleOllamaUrlChange,
    setMode
  } = useLlmNodeData({ nodeId: id });
  
  // Check if there are input nodes that could provide images
  const { hasImageInputs } = useNodeConnections(id);
  
  // Check if vision mode is possible
  const canEnableVisionMode = useMemo(() => {
    const hasInputs = hasImageInputs();
    console.log(`[LLMNodeExpandedView] Node ${id} can${hasInputs ? '' : 'not'} use vision mode (has image inputs: ${hasInputs})`);
    return hasInputs;
  }, [id, hasImageInputs]);
  
  // Debug logs for render and content state
  console.log(`%c[LLMNodeExpandedView Render] Node: ${id}`, 'color: blue; font-weight: bold;', { 
    prompt,
    model,
    temperature,
    provider,
    responseContent,
    isDirty,
    dataFromProps: data 
  });

  // Specific debug log for content changes
  React.useEffect(() => {
    if (responseContent) {
      console.log(`%c[LLMNodeExpandedView] Content changed for ${id}:`, 'color: green; font-weight: bold;', {
        contentLength: responseContent.length,
        contentPreview: responseContent.substring(0, 50) + (responseContent.length > 50 ? '...' : '')
      });
    }
  }, [id, responseContent]);

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
              onClick={() => setMode('text')}
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
              onClick={() => {
                if (!canEnableVisionMode) {
                  alert('비전 모드는 이미지 입력이 필요합니다. 이미지 입력 노드를 연결하세요.');
                  return;
                }
                setMode('vision');
              }}
            >
              Vision
            </button>
          </div>
          {mode === 'vision' && (
            <div className="text-xs text-gray-500 mt-1">
              ℹ️ 이미지는 입력 노드로부터 제공되어야 합니다.
            </div>
          )}
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

        {/* Result Display */}
        {responseContent && (
          <div className="w-full p-3 rounded-md bg-gray-100 text-sm whitespace-pre-wrap overflow-auto max-h-[200px] mt-3">
            {/* Mode & Model Info Badge - 모드와 모델 정보가 응답에 포함된 경우 */}
            {responseContent.includes('[Mode:') && responseContent.includes('[Model:') && (
              <div className="flex flex-wrap gap-1 mb-2">
                {/* Mode Badge */}
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  responseContent.includes('[Mode: vision]') 
                    ? 'bg-purple-100 text-purple-800' 
                    : 'bg-blue-100 text-blue-800'
                }`}>
                  {responseContent.includes('[Mode: vision]') ? '🖼️ Vision' : '📝 Text'} Mode
                </span>
                
                {/* Model Badge */}
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-800">
                  🤖 {responseContent.match(/\[Model: ([^\]]+)\]/)?.[1] || model}
                </span>
              </div>
            )}
            
            {/* Actual content - 모드/모델 정보 제거 */}
            {responseContent.replace(/\[Mode: [^\]]+\]\s*\[Model: [^\]]+\]\s*\n+/g, '')}
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