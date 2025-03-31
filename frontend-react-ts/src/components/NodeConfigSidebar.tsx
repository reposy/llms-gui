import React, { useEffect, useState } from 'react';
import { Node } from 'reactflow';
import { useDispatch, useSelector } from 'react-redux';
import { NodeData, LLMNodeData, APINodeData, OutputNodeData, LLMResult } from '../types/nodes';
import { updateNodeData } from '../store/flowSlice';
import { RootState } from '../store/store';
import { useFlowExecution } from '../store/flowExecutionStore';

// Constants
const DEFAULT_OLLAMA_URL = 'http://localhost:11434';
const DEFAULT_TEMPERATURE = 0;

// Types
interface NodeConfigSidebarProps {
  selectedNodeId: string | null;
}

interface FormatButtonProps {
  format: 'json' | 'text';
  currentFormat: 'json' | 'text';
  onClick: () => void;
}

// Utility functions
const formatExecutionResult = (result: any, format: 'json' | 'text'): string => {
  if (!result) return '';

  try {
    const jsonResult = typeof result === 'string' ? JSON.parse(result) : result;

    if (format === 'json') {
      return JSON.stringify(jsonResult, null, 2);
    } else {
      if (typeof jsonResult === 'object' && jsonResult !== null) {
        return jsonResult.content || jsonResult.text || '';
      }
      return String(jsonResult);
    }
  } catch (error) {
    return String(result);
  }
};

// Reusable components
const FormatButton: React.FC<FormatButtonProps> = ({ format, currentFormat, onClick }) => (
  <button
    className={`flex-1 p-2 rounded-lg text-sm font-medium ${
      currentFormat === format
        ? 'bg-purple-500 text-white'
        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
    }`}
    onClick={onClick}
  >
    {format.toUpperCase()}
  </button>
);

const ConfigLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label className="block text-sm font-medium text-gray-700 mb-1">
    {children}
  </label>
);

// Main component
export const NodeConfigSidebar: React.FC<NodeConfigSidebarProps> = ({ selectedNodeId }) => {
  const dispatch = useDispatch();
  const nodes = useSelector((state: RootState) => state.flow.nodes);
  const edges = useSelector((state: RootState) => state.flow.edges);
  const executionStates = useSelector((state: RootState) => state.flow.nodeExecutionStates);
  const flowExecution = useFlowExecution();
  const [isOpen, setIsOpen] = useState(false);
  
  const selectedNode = nodes.find(node => node.id === selectedNodeId);
  const executionState = selectedNodeId ? flowExecution.getNodeState(selectedNodeId) : null;
  
  useEffect(() => {
    setIsOpen(!!selectedNode);
  }, [selectedNode]);

  if (!selectedNode || !isOpen) return null;

  const handleConfigChange = (key: string, value: any) => {
    dispatch(updateNodeData({
      nodeId: selectedNodeId as string,
      data: {
        ...selectedNode.data,
        [key]: value
      }
    }));
  };

  const renderLLMConfig = (data: LLMNodeData) => (
    <div className="space-y-4">
      {/* Provider Selection */}
      <div>
        <ConfigLabel>Provider</ConfigLabel>
        <select
          className="w-full p-2.5 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
          value={data.provider}
          onChange={(e) => handleConfigChange('provider', e.target.value)}
        >
          <option value="">Provider 선택...</option>
          <option value="openai">OpenAI</option>
          <option value="ollama">Ollama (Local)</option>
        </select>
      </div>

      {/* Ollama-specific Configuration */}
      {data.provider === 'ollama' && (
        <div>
          <ConfigLabel>Ollama URL</ConfigLabel>
          <input
            type="text"
            className="w-full p-2.5 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
            value={data.ollamaUrl || DEFAULT_OLLAMA_URL}
            onChange={(e) => handleConfigChange('ollamaUrl', e.target.value)}
            placeholder={DEFAULT_OLLAMA_URL}
          />
        </div>
      )}

      {/* Model Selection */}
      <div>
        <ConfigLabel>Model</ConfigLabel>
        {data.provider === 'ollama' ? (
          <input
            type="text"
            className="w-full p-2.5 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
            value={data.model || ''}
            onChange={(e) => handleConfigChange('model', e.target.value)}
            placeholder="llama2, codellama, mistral 등"
          />
        ) : (
          <select
            className="w-full p-2.5 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
            value={data.model || ''}
            onChange={(e) => handleConfigChange('model', e.target.value)}
          >
            <option value="">모델 선택</option>
            <option value="gpt-4">GPT-4</option>
            <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
          </select>
        )}
      </div>

      {/* Temperature Control */}
      <div>
        <ConfigLabel>Temperature</ConfigLabel>
        <div className="flex flex-col gap-1">
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={data.temperature ?? DEFAULT_TEMPERATURE}
            onChange={(e) => handleConfigChange('temperature', parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <div className="text-sm text-gray-600 text-right">
            {data.temperature ?? DEFAULT_TEMPERATURE}
          </div>
        </div>
      </div>

      {/* Prompt Input */}
      <div>
        <ConfigLabel>Prompt</ConfigLabel>
        <textarea
          className="w-full p-2.5 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 font-mono text-sm"
          value={data.prompt || ''}
          onChange={(e) => handleConfigChange('prompt', e.target.value)}
          rows={8}
          placeholder="프롬프트를 입력하세요..."
        />
      </div>
    </div>
  );

  const renderAPIConfig = (data: APINodeData) => (
    <div className="space-y-4">
      {/* HTTP Method Selection */}
      <div>
        <ConfigLabel>Method</ConfigLabel>
        <select
          className="w-full p-2.5 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
          value={data.method}
          onChange={(e) => handleConfigChange('method', e.target.value)}
        >
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="DELETE">DELETE</option>
        </select>
      </div>

      {/* API URL Input */}
      <div>
        <ConfigLabel>URL</ConfigLabel>
        <input
          type="text"
          className="w-full p-2.5 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
          value={data.url}
          onChange={(e) => handleConfigChange('url', e.target.value)}
          placeholder="https://api.example.com/endpoint"
        />
      </div>

      {/* Headers Input */}
      <div>
        <ConfigLabel>Headers</ConfigLabel>
        <textarea
          className="w-full p-2.5 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
          value={Object.entries(data.headers || {}).map(([key, value]) => `${key}: ${value}`).join('\n')}
          onChange={(e) => {
            const headers: Record<string, string> = {};
            e.target.value.split('\n').forEach(line => {
              const [key, ...values] = line.split(':');
              if (key && values.length > 0) {
                headers[key.trim()] = values.join(':').trim();
              }
            });
            handleConfigChange('headers', headers);
          }}
          rows={4}
          placeholder="Content-Type: application/json&#10;Authorization: Bearer token"
        />
      </div>

      {/* Request Body Input */}
      <div>
        <ConfigLabel>Body</ConfigLabel>
        <textarea
          className="w-full p-2.5 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
          value={data.body || ''}
          onChange={(e) => handleConfigChange('body', e.target.value)}
          rows={4}
          placeholder="{\n  'key': 'value'\n}"
        />
      </div>
    </div>
  );

  const renderOutputConfig = (data: OutputNodeData) => {
    let displayContent = '실행 대기 중...';
    
    if (executionState?.status === 'running') {
      displayContent = '처리 중...';
    } else if (executionState?.status === 'error') {
      displayContent = `오류: ${executionState.error}`;
    } else if (executionState?.result) {
      displayContent = formatExecutionResult(executionState.result, data.format);
    }

    return (
      <div className="space-y-4">
        {/* Format Selection */}
        <div>
          <ConfigLabel>Format</ConfigLabel>
          <div className="flex gap-2">
            <FormatButton
              format="json"
              currentFormat={data.format}
              onClick={() => handleConfigChange('format', 'json')}
            />
            <FormatButton
              format="text"
              currentFormat={data.format}
              onClick={() => handleConfigChange('format', 'text')}
            />
          </div>
        </div>

        {/* Content Display */}
        <div>
          <ConfigLabel>Content</ConfigLabel>
          <textarea
            className="w-full h-[300px] p-2.5 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 font-mono text-sm"
            value={displayContent}
            readOnly
          />
        </div>
      </div>
    );
  };

  return (
    <div className="w-80 bg-white border-l border-gray-200 p-6 shadow-lg overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className={`w-3 h-3 rounded-full ${
          selectedNode.type === 'llm' ? 'bg-blue-500' :
          selectedNode.type === 'api' ? 'bg-green-500' :
          'bg-purple-500'
        }`} />
        <h2 className="text-lg font-semibold text-gray-900">
          {selectedNode.type?.toUpperCase()} 설정
        </h2>
        <button
          onClick={() => setIsOpen(false)}
          className="ml-auto text-gray-400 hover:text-gray-500"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Node-specific Configuration */}
      {selectedNode.type === 'llm' && renderLLMConfig(selectedNode.data as LLMNodeData)}
      {selectedNode.type === 'api' && renderAPIConfig(selectedNode.data as APINodeData)}
      {selectedNode.type === 'output' && renderOutputConfig(selectedNode.data as OutputNodeData)}
    </div>
  );
}; 