import React, { useCallback, useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { APINodeData } from '../../types/nodes';
import { updateNodeData } from '../../store/flowSlice';
import { useNodeState } from '../../store/flowExecutionStore';

interface APIConfigProps {
  nodeId: string;
  data: APINodeData;
}

interface KeyValuePair {
  key: string;
  value: string;
  enabled: boolean;
}

// Reusable label component
const ConfigLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label className="block text-sm font-medium text-gray-700 mb-1">
    {children}
  </label>
);

export const APIConfig: React.FC<APIConfigProps> = ({ nodeId, data }) => {
  const dispatch = useDispatch();
  const executionState = useNodeState(nodeId);
  
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
  
  const [urlDraft, setUrlDraft] = useState(data.url || '');
  
  // Sync drafts with node data
  useEffect(() => {
    // Initialize header drafts
    const initialHeaderKeyDrafts: Record<number, string> = {};
    const initialHeaderValueDrafts: Record<number, string> = {};
    Object.entries(data.headers || {}).forEach(([key, value], index) => {
      initialHeaderKeyDrafts[index] = key;
      initialHeaderValueDrafts[index] = value;
    });
    setHeaderKeyDrafts(initialHeaderKeyDrafts);
    setHeaderValueDrafts(initialHeaderValueDrafts);

    // Initialize param drafts
    const initialParamKeyDrafts: Record<number, string> = {};
    const initialParamValueDrafts: Record<number, string> = {};
    Object.entries(data.queryParams || {}).forEach(([key, value], index) => {
      initialParamKeyDrafts[index] = key;
      initialParamValueDrafts[index] = value;
    });
    setParamKeyDrafts(initialParamKeyDrafts);
    setParamValueDrafts(initialParamValueDrafts);

    if (!isUrlComposing) {
      setUrlDraft(data.url || '');
    }
  }, [data, isUrlComposing]);

  // Handle config changes
  const handleConfigChange = useCallback((key: keyof APINodeData, value: any) => {
    dispatch(updateNodeData({
      nodeId,
      data: { ...data, [key]: value }
    }));
  }, [dispatch, nodeId, data]);

  // Handle URL changes
  const handleUrlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    setUrlDraft(newUrl);
    
    if (!isUrlComposing) {
      handleConfigChange('url', newUrl);
    }
  }, [handleConfigChange, isUrlComposing]);

  const handleUrlCompositionEnd = useCallback((e: React.CompositionEvent<HTMLInputElement>) => {
    setIsUrlComposing(false);
    const newUrl = e.currentTarget.value;
    setUrlDraft(newUrl);
    handleConfigChange('url', newUrl);
  }, [handleConfigChange]);

  // Headers management
  const addHeader = useCallback(() => {
    const currentHeaders = data.headers || {};
    const newKey = `header${Object.keys(currentHeaders).length + 1}`;

    const updatedData: APINodeData = {
      ...data,
      headers: {
        ...currentHeaders,
        [newKey]: ''
      }
    };

    dispatch(updateNodeData({
      nodeId,
      data: updatedData
    }));
  }, [nodeId, data, dispatch]);

  const handleHeaderChange = useCallback((index: number, field: 'key' | 'value', value: string) => {
    if ((field === 'key' && isHeaderKeyComposing) || (field === 'value' && isHeaderValueComposing)) {
      // Update drafts during composition
      if (field === 'key') {
        setHeaderKeyDrafts(prev => ({ ...prev, [index]: value }));
      } else {
        setHeaderValueDrafts(prev => ({ ...prev, [index]: value }));
      }
      return;
    }
    
    const currentHeaders = data.headers || {};
    const headerEntries = Object.entries(currentHeaders);
    
    // Update or add the header
    const updatedHeaders = { ...currentHeaders };
    if (field === 'key') {
      const oldKey = headerEntries[index]?.[0];
      const oldValue = headerEntries[index]?.[1];
      if (oldKey) {
        delete updatedHeaders[oldKey];
      }
      if (value) {
        updatedHeaders[value] = oldValue || '';
      }
    } else if (field === 'value') {
      const key = headerEntries[index]?.[0];
      if (key) {
        updatedHeaders[key] = value;
      }
    }

    handleConfigChange('headers', updatedHeaders);
  }, [data, handleConfigChange, isHeaderKeyComposing, isHeaderValueComposing]);

  const handleHeaderBlur = useCallback((index: number, field: 'key' | 'value') => {
    const isDrafting = field === 'key' ? isHeaderKeyComposing : isHeaderValueComposing;
    
    if (!isDrafting) {
      // Apply changes when not in composition mode
      const draftValue = field === 'key' 
        ? headerKeyDrafts[index] 
        : headerValueDrafts[index];
      
      if (draftValue !== undefined) {
        handleHeaderChange(index, field, draftValue);
      }
    }
  }, [handleHeaderChange, isHeaderKeyComposing, isHeaderValueComposing, headerKeyDrafts, headerValueDrafts]);

  const removeHeader = useCallback((index: number) => {
    const currentHeaders = data.headers || {};
    const headerEntries = Object.entries(currentHeaders);
    const keyToRemove = headerEntries[index]?.[0];
    
    if (keyToRemove) {
      const updatedHeaders = { ...currentHeaders };
      delete updatedHeaders[keyToRemove];

      handleConfigChange('headers', updatedHeaders);
    }
  }, [data, handleConfigChange]);

  // Add bearer token shortcut
  const addBearerToken = useCallback(() => {
    const currentHeaders = data.headers || {};
    
    dispatch(updateNodeData({
      nodeId,
      data: {
        ...data,
        headers: {
          ...currentHeaders,
          'Authorization': 'Bearer '
        }
      }
    }));
  }, [nodeId, data, dispatch]);
  
  return (
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
    </div>
  );
}; 