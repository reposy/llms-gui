import React, { useEffect, useState, useCallback } from 'react';
import { Node } from 'reactflow';
import { useDispatch, useSelector } from 'react-redux';
import { NodeData, LLMNodeData, APINodeData, OutputNodeData, LLMResult } from '../types/nodes';
import { updateNodeData } from '../store/flowSlice';
import { RootState } from '../store/store';
import { useFlowExecutionStore } from '../store/flowExecutionStore';

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

interface KeyValuePair {
  key: string;
  value: string;
  enabled: boolean;
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
  const flowExecution = useFlowExecutionStore();
  const [isOpen, setIsOpen] = useState(false);
  
  // IME composition states
  const [isUrlComposing, setIsUrlComposing] = useState(false);
  const [isHeaderKeyComposing, setIsHeaderKeyComposing] = useState(false);
  const [headerKeyDrafts, setHeaderKeyDrafts] = useState<Record<number, string>>({});
  const [isHeaderValueComposing, setIsHeaderValueComposing] = useState(false);
  const [headerValueDrafts, setHeaderValueDrafts] = useState<Record<number, string>>({});
  const [isParamKeyComposing, setIsParamKeyComposing] = useState(false);
  const [paramKeyDrafts, setParamKeyDrafts] = useState<Record<number, string>>({});
  const [isParamValueComposing, setIsParamValueComposing] = useState(false);
  const [paramValueDrafts, setParamValueDrafts] = useState<Record<number, string>>({});
  
  const [urlDraft, setUrlDraft] = useState('');
  
  const selectedNode = nodes.find(node => node.id === selectedNodeId);
  const executionState = selectedNodeId ? useFlowExecutionStore.getState().getNodeState(selectedNodeId) : null;

  // API node state
  const [headers, setHeaders] = useState<KeyValuePair[]>([
    { key: 'Content-Type', value: 'application/json', enabled: true }
  ]);
  const [queryParams, setQueryParams] = useState<KeyValuePair[]>([]);
  const [bodyFormat, setBodyFormat] = useState<'key-value' | 'raw'>('key-value');
  const [contentType, setContentType] = useState<string>('application/json');
  const [bodyParams, setBodyParams] = useState<KeyValuePair[]>([
    { key: '', value: '', enabled: true }
  ]);
  
  // Sync drafts with node data
  useEffect(() => {
    if (selectedNode?.type === 'api') {
      const apiData = selectedNode.data as APINodeData;
      
      // Initialize header drafts
      const initialHeaderKeyDrafts: Record<number, string> = {};
      const initialHeaderValueDrafts: Record<number, string> = {};
      Object.entries(apiData.headers || {}).forEach(([key, value], index) => {
        initialHeaderKeyDrafts[index] = key;
        initialHeaderValueDrafts[index] = value;
      });
      setHeaderKeyDrafts(initialHeaderKeyDrafts);
      setHeaderValueDrafts(initialHeaderValueDrafts);

      // Initialize param drafts
      const initialParamKeyDrafts: Record<number, string> = {};
      const initialParamValueDrafts: Record<number, string> = {};
      Object.entries(apiData.queryParams || {}).forEach(([key, value], index) => {
        initialParamKeyDrafts[index] = key;
        initialParamValueDrafts[index] = value;
      });
      setParamKeyDrafts(initialParamKeyDrafts);
      setParamValueDrafts(initialParamValueDrafts);

      if (!isUrlComposing) {
        setUrlDraft(apiData.url ?? '');
      }
    }
  }, [selectedNode, isUrlComposing]);

  useEffect(() => {
    setIsOpen(!!selectedNode);
  }, [selectedNode]);

  // Update node data when headers change
  const updateNodeHeaders = useCallback((newHeaders: KeyValuePair[]) => {
    // Type Guard: Ensure selectedNode exists and is an API node
    if (!selectedNode || selectedNode.type !== 'api') return;
    
    // selectedNode.data is now guaranteed to be APINodeData here
    const apiData = selectedNode.data;

    const enabledHeaders = newHeaders
      .filter(h => h.enabled && h.key)
      .reduce((acc, { key, value }) => ({ ...acc, [key]: value }), {});

    dispatch(updateNodeData({
      nodeId: selectedNode.id,
      // Pass only relevant fields for APINodeData
      data: { headers: enabledHeaders } 
    }));
  }, [dispatch, selectedNode]);

  // Update node data when query parameters change
  const updateNodeQueryParams = useCallback((newParams: KeyValuePair[]) => {
    // Type Guard: Ensure selectedNode exists and is an API node
    if (!selectedNode || selectedNode.type !== 'api') return;

    // selectedNode.data is now guaranteed to be APINodeData here
    const apiData = selectedNode.data;

    const enabledParams = newParams
      .filter(p => p.enabled && p.key)
      .reduce((acc, { key, value }) => ({ ...acc, [key]: value }), {});

    // Update URL with new query parameters
    try {
      // Construct URL safely using apiData
      const currentUrl = apiData.url || ''; // Use apiData here
      const urlBase = currentUrl.startsWith('http') ? currentUrl : `https://${currentUrl}`;
      // Add basic check for empty URL base before creating URL object
      if (!urlBase || urlBase === 'https://') {
         throw new Error("Invalid base URL for adding query parameters.");
      }
      const url = new URL(urlBase);
      url.search = ''; // Clear existing params before setting new ones
      Object.entries(enabledParams).forEach(([key, value]) => {
        url.searchParams.set(key, encodeURIComponent(String(value)));
      });
      const newUrl = url.toString();

      dispatch(updateNodeData({
        nodeId: selectedNode.id,
        data: { url: newUrl, queryParams: enabledParams } // Update both
      }));
    } catch (error) { // Handle invalid URL or other errors
      console.error("Error parsing or updating URL with query params:", error);
      // If URL processing fails, just update the query parameters in data
      // Add explicit type assertion here
      dispatch(updateNodeData({
        nodeId: selectedNode.id,
        data: { queryParams: enabledParams } as Partial<APINodeData> // Assert type
      }));
    }
  }, [dispatch, selectedNode]);

  const addHeader = useCallback(() => {
    if (!selectedNode || selectedNode.type !== 'api') return;
    const apiData = selectedNode.data as APINodeData;
    const currentHeaders = apiData.headers || {};
    const newKey = `header${Object.keys(currentHeaders).length + 1}`;

    const updatedData: APINodeData = {
      ...apiData,
      headers: {
        ...currentHeaders,
        [newKey]: ''
      }
    };

    dispatch(updateNodeData({
      nodeId: selectedNode.id,
      data: updatedData
    }));
  }, [selectedNode, dispatch]);

  const updateHeader = useCallback((index: number, field: keyof KeyValuePair, value: string | boolean) => {
    if (!selectedNode || selectedNode.type !== 'api') return;
    if ((field === 'key' && isHeaderKeyComposing) || (field === 'value' && isHeaderValueComposing)) return;

    const data = selectedNode.data as APINodeData;
    const currentHeaders = data.headers || {};
    const headerEntries = Object.entries(currentHeaders);
    
    if (field === 'enabled') {
      // Skip disabled headers
      return;
    }

    // Update or add the header
    const updatedHeaders = { ...currentHeaders };
    if (field === 'key' && typeof value === 'string') {
      const oldKey = headerEntries[index]?.[0];
      const oldValue = headerEntries[index]?.[1];
      if (oldKey) {
        delete updatedHeaders[oldKey];
      }
      if (value) {
        updatedHeaders[value] = oldValue || '';
      }
    } else if (field === 'value' && typeof value === 'string') {
      const key = headerEntries[index]?.[0];
      if (key) {
        updatedHeaders[key] = value;
      }
    }

    const updatedData: APINodeData = {
      ...data,
      headers: updatedHeaders
    };
    dispatch(updateNodeData({
      nodeId: selectedNode.id,
      data: updatedData
    }));
  }, [selectedNode, dispatch, isHeaderKeyComposing, isHeaderValueComposing]);

  const removeHeader = useCallback((index: number) => {
    if (!selectedNode || selectedNode.type !== 'api') return;
    const data = selectedNode.data as APINodeData;
    const currentHeaders = data.headers || {};
    const headerEntries = Object.entries(currentHeaders);
    const keyToRemove = headerEntries[index]?.[0];
    
    if (keyToRemove) {
      const updatedHeaders = { ...currentHeaders };
      delete updatedHeaders[keyToRemove];

      const updatedData: APINodeData = {
        ...data,
        headers: updatedHeaders
      };
      dispatch(updateNodeData({
        nodeId: selectedNode.id,
        data: updatedData
      }));
    }
  }, [selectedNode, dispatch]);

  const addQueryParam = useCallback(() => {
    if (!selectedNode || selectedNode.type !== 'api') return;
    const apiData = selectedNode.data as APINodeData;
    const currentParams = apiData.queryParams || {};
    const newKey = `param${Object.keys(currentParams).length + 1}`;

    const updatedData: APINodeData = {
      ...apiData,
      queryParams: {
        ...currentParams,
        [newKey]: ''
      }
    };

    dispatch(updateNodeData({
      nodeId: selectedNode.id,
      data: updatedData
    }));
  }, [selectedNode, dispatch]);

  const updateQueryParam = useCallback((index: number, field: keyof KeyValuePair, value: string | boolean) => {
    if (!selectedNode || selectedNode.type !== 'api') return;
    if ((field === 'key' && isParamKeyComposing) || (field === 'value' && isParamValueComposing)) return;

    const data = selectedNode.data as APINodeData;
    const currentParams = data.queryParams || {};
    const paramEntries = Object.entries(currentParams);
    
    if (field === 'enabled') {
      // Skip disabled parameters
      return;
    }

    // Update or add the parameter
    const updatedParams = { ...currentParams };
    if (field === 'key' && typeof value === 'string') {
      const oldKey = paramEntries[index]?.[0];
      const oldValue = paramEntries[index]?.[1];
      if (oldKey) {
        delete updatedParams[oldKey];
      }
      if (value) {
        updatedParams[value as string] = oldValue || '';
      }
    } else if (field === 'value' && typeof value === 'string') {
      const key = paramEntries[index]?.[0];
      if (key) {
        updatedParams[key] = value;
      }
    }

    const updatedData: APINodeData = {
      ...data,
      queryParams: updatedParams
    };
    dispatch(updateNodeData({
      nodeId: selectedNode.id,
      data: updatedData
    }));
  }, [selectedNode, dispatch, isParamKeyComposing, isParamValueComposing]);

  const removeQueryParam = useCallback((index: number) => {
    if (!selectedNode || selectedNode.type !== 'api') return;
    const apiData = selectedNode.data as APINodeData;
    const currentParams = apiData.queryParams || {};
    const paramEntries = Object.entries(currentParams);
    const keyToRemove = paramEntries[index]?.[0];
    
    if (keyToRemove) {
      const updatedParams = { ...currentParams };
      delete updatedParams[keyToRemove];

      const updatedData: APINodeData = {
        ...apiData,
        queryParams: updatedParams
      };

      dispatch(updateNodeData({
        nodeId: selectedNode.id,
        data: updatedData
      }));
    }
  }, [selectedNode, dispatch]);

  const addBearerToken = useCallback(() => {
    if (!selectedNode || selectedNode.type !== 'api') return;
    const data = selectedNode.data as APINodeData;
    const currentHeaders = data.headers || {};

    dispatch(updateNodeData({
      nodeId: selectedNode.id,
      data: {
        ...data,
        headers: {
          ...currentHeaders,
          'Authorization': 'Bearer '
        }
      } as APINodeData
    }));
  }, [selectedNode, dispatch]);

  const handleConfigChange = useCallback((key: string, value: any) => {
    if (!selectedNode || !selectedNodeId) return;
    
    if (selectedNode.type === 'api') {
      dispatch(updateNodeData({
        nodeId: selectedNodeId,
        data: {
          ...selectedNode.data,
          [key]: value
        } as APINodeData
      }));
    } else if (selectedNode.type === 'llm') {
      dispatch(updateNodeData({
        nodeId: selectedNodeId,
        data: {
          ...selectedNode.data,
          [key]: value
        } as LLMNodeData
      }));
    }
  }, [dispatch, selectedNode, selectedNodeId]);

  const handleUrlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedNode || selectedNode.type !== 'api') return;
    
    const newValue = e.target.value;
    setUrlDraft(newValue);
    
    if (!isUrlComposing) {
      const apiData = selectedNode.data as APINodeData;
      dispatch(updateNodeData({
        nodeId: selectedNode.id,
        data: {
          ...apiData,
          url: newValue,
          type: 'api'
        }
      }));
    }
  }, [selectedNode, dispatch, isUrlComposing]);

  const handleUrlCompositionEnd = useCallback((e: React.CompositionEvent<HTMLInputElement>) => {
    if (!selectedNode || selectedNode.type !== 'api') return;
    setIsUrlComposing(false);
    
    const newValue = e.currentTarget.value;
    const apiData = selectedNode.data as APINodeData;
    dispatch(updateNodeData({
      nodeId: selectedNode.id,
      data: {
        ...apiData,
        url: newValue,
        type: 'api'
      }
    }));
  }, [selectedNode, dispatch]);

  const handleHeaderChange = useCallback((index: number, field: keyof KeyValuePair, value: string | boolean) => {
    if (!selectedNode || selectedNode.type !== 'api') return;

    if (field === 'key') {
      setHeaderKeyDrafts(prev => ({ ...prev, [index]: value as string }));
      if (!isHeaderKeyComposing) {
        const apiData = selectedNode.data as APINodeData;
        const currentHeaders = apiData.headers || {};
        const headerEntries = Object.entries(currentHeaders);
        const updatedHeaders = { ...currentHeaders };
        const oldKey = headerEntries[index]?.[0];
        const oldValue = headerEntries[index]?.[1];
        if (oldKey) delete updatedHeaders[oldKey];
        if (value) updatedHeaders[value as string] = oldValue || '';
        
        dispatch(updateNodeData({
          nodeId: selectedNode.id,
          data: {
            ...apiData,
            headers: updatedHeaders
          } as APINodeData
        }));
      }
    } else if (field === 'value') {
      setHeaderValueDrafts(prev => ({ ...prev, [index]: value as string }));
      if (!isHeaderValueComposing) {
        const apiData = selectedNode.data as APINodeData;
        const currentHeaders = apiData.headers || {};
        const headerEntries = Object.entries(currentHeaders);
        const key = headerEntries[index]?.[0];
        if (key) {
          dispatch(updateNodeData({
            nodeId: selectedNode.id,
            data: {
              ...apiData,
              headers: { ...currentHeaders, [key]: value as string }
            } as APINodeData
          }));
        }
      }
    }
  }, [selectedNode, dispatch, isHeaderKeyComposing, isHeaderValueComposing]);

  const handleHeaderBlur = useCallback((index: number, field: keyof KeyValuePair) => {
    if (!selectedNode || selectedNode.type !== 'api') return;

    const apiData = selectedNode.data as APINodeData;
    const currentHeaders = apiData.headers || {};
    const headerEntries = Object.entries(currentHeaders);

    if (field === 'key') {
      const oldKey = headerEntries[index]?.[0];
      const oldValue = headerEntries[index]?.[1];
      const updatedHeaders = { ...currentHeaders };
      if (oldKey) delete updatedHeaders[oldKey];
      const newKey = headerKeyDrafts[index];
      if (newKey) updatedHeaders[newKey] = oldValue || '';

      dispatch(updateNodeData({
        nodeId: selectedNode.id,
        data: {
          ...apiData,
          headers: updatedHeaders
        } as APINodeData
      }));
    } else if (field === 'value') {
      const key = headerEntries[index]?.[0];
      if (key) {
        dispatch(updateNodeData({
          nodeId: selectedNode.id,
          data: {
            ...apiData,
            headers: { ...currentHeaders, [key]: headerValueDrafts[index] || '' }
          } as APINodeData
        }));
      }
    }
  }, [selectedNode, dispatch, headerKeyDrafts, headerValueDrafts]);

  const handleParamChange = useCallback((index: number, field: keyof KeyValuePair, value: string | boolean) => {
    if (!selectedNode || selectedNode.type !== 'api') return;

    if (field === 'key') {
      setParamKeyDrafts(prev => ({ ...prev, [index]: value as string }));
      if (!isParamKeyComposing) {
        const apiData = selectedNode.data as APINodeData;
        const currentParams = apiData.queryParams || {};
        const paramEntries = Object.entries(currentParams);
        const updatedParams = { ...currentParams };
        const oldKey = paramEntries[index]?.[0];
        const oldValue = paramEntries[index]?.[1];
        if (oldKey) delete updatedParams[oldKey];
        if (value) updatedParams[value as string] = oldValue || '';
        
        dispatch(updateNodeData({
          nodeId: selectedNode.id,
          data: {
            ...apiData,
            queryParams: updatedParams
          } as APINodeData
        }));
      }
    } else if (field === 'value') {
      setParamValueDrafts(prev => ({ ...prev, [index]: value as string }));
      if (!isParamValueComposing) {
        const apiData = selectedNode.data as APINodeData;
        const currentParams = apiData.queryParams || {};
        const paramEntries = Object.entries(currentParams);
        const key = paramEntries[index]?.[0];
        if (key) {
          dispatch(updateNodeData({
            nodeId: selectedNode.id,
            data: {
              ...apiData,
              queryParams: { ...currentParams, [key]: value as string }
            } as APINodeData
          }));
        }
      }
    }
  }, [selectedNode, dispatch, isParamKeyComposing, isParamValueComposing]);

  const handleParamBlur = useCallback((index: number, field: keyof KeyValuePair) => {
    if (!selectedNode || selectedNode.type !== 'api') return;

    const apiData = selectedNode.data as APINodeData;
    const currentParams = apiData.queryParams || {};
    const paramEntries = Object.entries(currentParams);

    if (field === 'key') {
      const oldKey = paramEntries[index]?.[0];
      const oldValue = paramEntries[index]?.[1];
      const updatedParams = { ...currentParams };
      if (oldKey) delete updatedParams[oldKey];
      const newKey = paramKeyDrafts[index];
      if (newKey) updatedParams[newKey] = oldValue || '';

      dispatch(updateNodeData({
        nodeId: selectedNode.id,
        data: {
          ...apiData,
          queryParams: updatedParams
        } as APINodeData
      }));
    } else if (field === 'value') {
      const key = paramEntries[index]?.[0];
      if (key) {
        dispatch(updateNodeData({
          nodeId: selectedNode.id,
          data: {
            ...apiData,
            queryParams: { ...currentParams, [key]: paramValueDrafts[index] || '' }
          } as APINodeData
        }));
      }
    }
  }, [selectedNode, dispatch, paramKeyDrafts, paramValueDrafts]);

  if (!selectedNode || !isOpen) return null;

  // Render functions no longer contain hooks
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
      {/* Method Selection */}
      <div>
        <ConfigLabel>Method</ConfigLabel>
        <select
          className="w-full p-2.5 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
          value={data.method}
          onChange={(e) => handleConfigChange('method', e.target.value)}
        >
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="DELETE">DELETE</option>
          <option value="PATCH">PATCH</option>
        </select>
      </div>

      {/* URL Input */}
      <div>
        <ConfigLabel>URL</ConfigLabel>
        <input
          type="text"
          className="w-full p-2.5 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
          value={urlDraft}
          placeholder="Enter API URL"
          onChange={handleUrlChange}
          onCompositionStart={() => setIsUrlComposing(true)}
          onCompositionEnd={handleUrlCompositionEnd}
        />
      </div>

      {/* Headers */}
      <div>
        <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
          <ConfigLabel>Headers</ConfigLabel>
          <div className="flex gap-2 flex-nowrap">
            <button
              className="px-2 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded whitespace-nowrap"
              onClick={addBearerToken}
            >
              Add Bearer Token
            </button>
            <button
              className="px-2 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded whitespace-nowrap"
              onClick={addHeader}
            >
              Add Header
            </button>
          </div>
        </div>
        <div className="space-y-2">
          {Object.entries(data.headers || {}).map(([key, value], index) => (
            <div key={index} className="grid grid-cols-[1fr,1fr,auto] gap-2">
              <input
                type="text"
                className="w-full p-2 bg-white border border-gray-300 rounded"
                value={headerKeyDrafts[index] ?? key}
                placeholder="Key"
                onChange={(e) => handleHeaderChange(index, 'key', e.target.value)}
                onCompositionStart={() => setIsHeaderKeyComposing(true)}
                onCompositionEnd={() => {
                  setIsHeaderKeyComposing(false);
                  handleHeaderChange(index, 'key', headerKeyDrafts[index] ?? key);
                }}
                onBlur={() => handleHeaderBlur(index, 'key')}
              />
              <input
                type="text"
                className="w-full p-2 bg-white border border-gray-300 rounded"
                value={headerValueDrafts[index] ?? value}
                placeholder="Value"
                onChange={(e) => handleHeaderChange(index, 'value', e.target.value)}
                onCompositionStart={() => setIsHeaderValueComposing(true)}
                onCompositionEnd={() => {
                  setIsHeaderValueComposing(false);
                  handleHeaderChange(index, 'value', headerValueDrafts[index] ?? value);
                }}
                onBlur={() => handleHeaderBlur(index, 'value')}
              />
              <button
                className="p-2 text-red-500 hover:text-red-700"
                onClick={() => removeHeader(index)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Query Parameters */}
      {data.method === 'GET' && (
        <div>
          <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
            <ConfigLabel>Query Parameters</ConfigLabel>
            <button
              className="px-2 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded whitespace-nowrap"
              onClick={addQueryParam}
            >
              Add Parameter
            </button>
          </div>
          <div className="space-y-2">
            {Object.entries(data.queryParams || {}).map(([key, value], index) => (
              <div key={index} className="grid grid-cols-[1fr,1fr,auto] gap-2">
                <input
                  type="text"
                  className="w-full p-2 bg-white border border-gray-300 rounded"
                  value={paramKeyDrafts[index] ?? key}
                  placeholder="Key"
                  onChange={(e) => handleParamChange(index, 'key', e.target.value)}
                  onCompositionStart={() => setIsParamKeyComposing(true)}
                  onCompositionEnd={() => {
                    setIsParamKeyComposing(false);
                    handleParamChange(index, 'key', paramKeyDrafts[index] ?? key);
                  }}
                  onBlur={() => handleParamBlur(index, 'key')}
                />
                <input
                  type="text"
                  className="w-full p-2 bg-white border border-gray-300 rounded"
                  value={paramValueDrafts[index] ?? value}
                  placeholder="Value"
                  onChange={(e) => handleParamChange(index, 'value', e.target.value)}
                  onCompositionStart={() => setIsParamValueComposing(true)}
                  onCompositionEnd={() => {
                    setIsParamValueComposing(false);
                    handleParamChange(index, 'value', paramValueDrafts[index] ?? value);
                  }}
                  onBlur={() => handleParamBlur(index, 'value')}
                />
                <button
                  className="p-2 text-red-500 hover:text-red-700"
                  onClick={() => removeQueryParam(index)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
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