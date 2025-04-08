import React, { useCallback, useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { APINodeData } from '../../types/nodes';
import { updateNodeData } from '../../store/flowSlice';
// Import our new hook
import { useApiNodeData } from '../../hooks/useApiNodeData';

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
  // Keep Redux dispatch for compatibility
  const dispatch = useDispatch();
  
  // Use our new Zustand hook
  const { 
    url,
    method,
    headers,
    handleUrlChange,
    handleMethodChange,
    handleHeadersChange,
    handleHeaderChange,
    removeHeader,
    addHeader: addNewHeader
  } = useApiNodeData({ nodeId });
  
  // IME composition states
  const [isUrlComposing, setIsUrlComposing] = useState(false);
  const [isHeaderKeyComposing, setIsHeaderKeyComposing] = useState(false);
  const [headerKeyDrafts, setHeaderKeyDrafts] = useState<Record<number, string>>({});
  const [isHeaderValueComposing, setIsHeaderValueComposing] = useState(false);
  const [headerValueDrafts, setHeaderValueDrafts] = useState<Record<number, string>>({});
  
  const [urlDraft, setUrlDraft] = useState(url || '');
  
  // Sync drafts with node data
  useEffect(() => {
    // Initialize header drafts
    const initialHeaderKeyDrafts: Record<number, string> = {};
    const initialHeaderValueDrafts: Record<number, string> = {};
    Object.entries(headers || {}).forEach(([key, value], index) => {
      initialHeaderKeyDrafts[index] = key;
      initialHeaderValueDrafts[index] = value;
    });
    setHeaderKeyDrafts(initialHeaderKeyDrafts);
    setHeaderValueDrafts(initialHeaderValueDrafts);

    if (!isUrlComposing) {
      setUrlDraft(url || '');
    }
  }, [headers, url, isUrlComposing]);

  // Handle config changes - for Redux compatibility
  const handleConfigChange = useCallback((key: keyof APINodeData, value: any) => {
    dispatch(updateNodeData({
      nodeId,
      data: { ...data, [key]: value }
    }));
  }, [dispatch, nodeId, data]);

  // Handle URL changes
  const handleUrlInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    setUrlDraft(newUrl);
    
    if (!isUrlComposing) {
      // Update Zustand
      handleUrlChange(newUrl);
      
      // Update Redux for compatibility
      handleConfigChange('url', newUrl);
    }
  }, [handleConfigChange, isUrlComposing, handleUrlChange]);

  const handleUrlCompositionEnd = useCallback((e: React.CompositionEvent<HTMLInputElement>) => {
    setIsUrlComposing(false);
    const newUrl = e.currentTarget.value;
    setUrlDraft(newUrl);
    
    // Update Zustand
    handleUrlChange(newUrl);
    
    // Update Redux for compatibility
    handleConfigChange('url', newUrl);
  }, [handleConfigChange, handleUrlChange]);

  const handleUrlBlur = useCallback(() => {
    // Always update with latest URL value
    handleUrlChange(urlDraft);
    handleConfigChange('url', urlDraft);
  }, [handleConfigChange, urlDraft, handleUrlChange]);

  // Event handler to prevent backspace from deleting nodes
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
  }, []);

  // Headers management
  const addHeader = useCallback(() => {
    // Update Zustand
    addNewHeader();
    
    // Update Redux for compatibility
    const currentHeaders = headers || {};
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
  }, [nodeId, data, dispatch, headers, addNewHeader]);

  const handleHeaderInputChange = useCallback((index: number, field: 'key' | 'value', value: string) => {
    if ((field === 'key' && isHeaderKeyComposing) || (field === 'value' && isHeaderValueComposing)) {
      // Update drafts during composition
      if (field === 'key') {
        setHeaderKeyDrafts(prev => ({ ...prev, [index]: value }));
      } else {
        setHeaderValueDrafts(prev => ({ ...prev, [index]: value }));
      }
      return;
    }
    
    const currentHeaders = headers || {};
    const headerEntries = Object.entries(currentHeaders);
    
    // Update or add the header
    if (field === 'key') {
      const oldKey = headerEntries[index]?.[0];
      const oldValue = headerEntries[index]?.[1];
      
      // Update Zustand
      handleHeaderChange(value, oldValue, oldKey);
      
      // Update Redux for compatibility
      const updatedHeaders = { ...currentHeaders };
      if (oldKey) {
        delete updatedHeaders[oldKey];
      }
      if (value) {
        updatedHeaders[value] = oldValue || '';
      }
      handleConfigChange('headers', updatedHeaders);
    } else if (field === 'value') {
      const key = headerEntries[index]?.[0];
      if (key) {
        // Update Zustand
        handleHeaderChange(key, value);
        
        // Update Redux for compatibility
        const updatedHeaders = { ...currentHeaders };
        updatedHeaders[key] = value;
        handleConfigChange('headers', updatedHeaders);
      }
    }
  }, [headers, handleConfigChange, isHeaderKeyComposing, isHeaderValueComposing, handleHeaderChange]);

  const handleHeaderBlur = useCallback((index: number, field: 'key' | 'value') => {
    const isDrafting = field === 'key' ? isHeaderKeyComposing : isHeaderValueComposing;
    
    if (!isDrafting) {
      // Apply changes when not in composition mode
      const draftValue = field === 'key' 
        ? headerKeyDrafts[index] 
        : headerValueDrafts[index];
      
      if (draftValue !== undefined) {
        handleHeaderInputChange(index, field, draftValue);
      }
    }
  }, [handleHeaderInputChange, isHeaderKeyComposing, isHeaderValueComposing, headerKeyDrafts, headerValueDrafts]);

  const removeHeaderHandler = useCallback((index: number) => {
    const currentHeaders = headers || {};
    const headerEntries = Object.entries(currentHeaders);
    const keyToRemove = headerEntries[index]?.[0];
    
    if (keyToRemove) {
      // Update Zustand
      removeHeader(keyToRemove);
      
      // Update Redux for compatibility
      const updatedHeaders = { ...currentHeaders };
      delete updatedHeaders[keyToRemove];
      handleConfigChange('headers', updatedHeaders);
    }
  }, [headers, handleConfigChange, removeHeader]);

  // Add bearer token shortcut
  const addBearerToken = useCallback(() => {
    // Update Zustand
    handleHeaderChange('Authorization', 'Bearer ');
    
    // Update Redux for compatibility
    const currentHeaders = headers || {};
    
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
  }, [nodeId, data, dispatch, headers, handleHeaderChange]);
  
  const handleMethodSelectChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const newMethod = e.target.value as APINodeData['method'];
    
    // Update Zustand
    handleMethodChange(newMethod);
    
    // Update Redux for compatibility
    handleConfigChange('method', newMethod);
  }, [handleConfigChange, handleMethodChange]);
  
  return (
    <div className="space-y-4">
      {/* Method Selection */}
      <div>
        <ConfigLabel>Method</ConfigLabel>
        <select
          className="w-full p-2.5 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
          value={method}
          onChange={handleMethodSelectChange}
          onKeyDown={handleKeyDown}
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
          onChange={handleUrlInputChange}
          onCompositionStart={() => {
            setIsUrlComposing(true);
          }}
          onCompositionEnd={handleUrlCompositionEnd}
          onBlur={handleUrlBlur}
          onKeyDown={handleKeyDown}
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
              onKeyDown={handleKeyDown}
            >
              Add Bearer Token
            </button>
            <button
              className="px-2 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded whitespace-nowrap"
              onClick={addHeader}
              onKeyDown={handleKeyDown}
            >
              Add Header
            </button>
          </div>
        </div>
        <div className="space-y-2">
          {Object.entries(headers || {}).map(([key, value], index) => (
            <div key={index} className="grid grid-cols-[1fr,1fr,auto] gap-2">
              <input
                type="text"
                className="w-full p-2 bg-white border border-gray-300 rounded"
                value={headerKeyDrafts[index] ?? key}
                placeholder="Header Name"
                onChange={(e) => {
                  if (!isHeaderKeyComposing) {
                    handleHeaderInputChange(index, 'key', e.target.value);
                  }
                  setHeaderKeyDrafts(prev => ({ ...prev, [index]: e.target.value }));
                }}
                onCompositionStart={() => setIsHeaderKeyComposing(true)}
                onCompositionEnd={() => {
                  setIsHeaderKeyComposing(false);
                  handleHeaderInputChange(index, 'key', headerKeyDrafts[index] || '');
                }}
                onBlur={() => handleHeaderBlur(index, 'key')}
                onKeyDown={handleKeyDown}
              />
              <input
                type="text"
                className="w-full p-2 bg-white border border-gray-300 rounded"
                value={headerValueDrafts[index] ?? value}
                placeholder="Value"
                onChange={(e) => {
                  if (!isHeaderValueComposing) {
                    handleHeaderInputChange(index, 'value', e.target.value);
                  }
                  setHeaderValueDrafts(prev => ({ ...prev, [index]: e.target.value }));
                }}
                onCompositionStart={() => setIsHeaderValueComposing(true)}
                onCompositionEnd={() => {
                  setIsHeaderValueComposing(false);
                  handleHeaderInputChange(index, 'value', headerValueDrafts[index] || '');
                }}
                onBlur={() => handleHeaderBlur(index, 'value')}
                onKeyDown={handleKeyDown}
              />
              <button
                className="p-2 text-gray-600 hover:text-red-500"
                onClick={() => removeHeaderHandler(index)}
                onKeyDown={handleKeyDown}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}; 