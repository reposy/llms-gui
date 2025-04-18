// src/components/config/APIConfig.tsx
import React, { useCallback, useState, useEffect, useMemo } from 'react';
import { APINodeData, HTTPMethod, RequestBodyType } from '../../types/nodes';
// Import our new hook
import { useApiNodeData } from '../../hooks/useApiNodeData';

interface APIConfigProps {
  nodeId: string;
  // data prop is no longer needed as data is fetched by the hook
  // data: APINodeData;
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

export const APIConfig: React.FC<APIConfigProps> = ({ nodeId }) => {
  // Use our new Zustand hook
  const {
    url,
    method,
    requestHeaders,
    requestBodyType,
    requestBody,
    handleUrlChange,
    handleMethodChange,
    handleHeadersChange,
    handleRequestBodyTypeChange,
    handleRequestBodyChange
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
    const initialHeaderKeyDrafts: Record<number, string> = {};
    const initialHeaderValueDrafts: Record<number, string> = {};
    Object.entries(requestHeaders || {}).forEach(([key, value], index) => {
      initialHeaderKeyDrafts[index] = key;
      initialHeaderValueDrafts[index] = String(value);
    });
    setHeaderKeyDrafts(initialHeaderKeyDrafts);
    setHeaderValueDrafts(initialHeaderValueDrafts);

    if (!isUrlComposing) {
      setUrlDraft(url || '');
    }
  }, [requestHeaders, url, isUrlComposing]);

  // Handle URL changes
  const handleUrlInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    setUrlDraft(newUrl);
    
    if (!isUrlComposing) {
      handleUrlChange(newUrl);
    }
  }, [isUrlComposing, handleUrlChange]);

  const handleUrlCompositionEnd = useCallback((e: React.CompositionEvent<HTMLInputElement>) => {
    setIsUrlComposing(false);
    const newUrl = e.currentTarget.value;
    setUrlDraft(newUrl);
    handleUrlChange(newUrl);
  }, [handleUrlChange]);

  const handleUrlBlur = useCallback(() => {
    handleUrlChange(urlDraft);
  }, [urlDraft, handleUrlChange]);

  // Event handler to prevent backspace from deleting nodes
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
  }, []);

  // Headers management
  const currentHeaderEntries = useMemo(() => Object.entries(requestHeaders || {}), [requestHeaders]);

  const addHeader = useCallback(() => {
    const newHeaders = { ...(requestHeaders || {}), '': '' };
    handleHeadersChange(newHeaders);
  }, [requestHeaders, handleHeadersChange]);

  const handleHeaderInputChange = useCallback((index: number, field: 'key' | 'value', draftValue: string) => {
    const isComposing = (field === 'key' && isHeaderKeyComposing) || (field === 'value' && isHeaderValueComposing);

    // Update drafts regardless of composition state
    if (field === 'key') {
      setHeaderKeyDrafts(prev => ({ ...prev, [index]: draftValue }));
    } else {
      setHeaderValueDrafts(prev => ({ ...prev, [index]: draftValue }));
    }

    // Only update the store if not composing
    if (!isComposing) {
        const currentKey = currentHeaderEntries[index]?.[0];
        const currentValue = currentHeaderEntries[index]?.[1];
        const finalKey = field === 'key' ? draftValue : headerKeyDrafts[index] ?? currentKey ?? '';
        const finalValue = field === 'value' ? draftValue : headerValueDrafts[index] ?? currentValue ?? '';

        const newHeaders = { ...(requestHeaders || {}) };

        if (field === 'key' && currentKey !== undefined && currentKey !== finalKey) {
            // Key changed, remove old entry first
            delete newHeaders[currentKey];
        }

        // Update or add the new entry
        if (finalKey) { // Don't add headers with empty keys
            newHeaders[finalKey] = finalValue;
        }

        // Remove the original entry if the key was empty (effectively deleting the row)
        if (field === 'key' && !finalKey && currentKey !== undefined) {
            delete newHeaders[currentKey];
        }

        handleHeadersChange(newHeaders);
    }
  }, [requestHeaders, handleHeadersChange, isHeaderKeyComposing, isHeaderValueComposing, currentHeaderEntries, headerKeyDrafts, headerValueDrafts]);

  const handleHeaderBlur = useCallback((index: number, field: 'key' | 'value') => {
    const isComposing = field === 'key' ? isHeaderKeyComposing : isHeaderValueComposing;
    if (!isComposing) {
      const draftValue = field === 'key' ? headerKeyDrafts[index] : headerValueDrafts[index];
      if (draftValue !== undefined) {
        // Trigger the input change logic on blur to commit the final draft value
        handleHeaderInputChange(index, field, draftValue);
      }
    }
  }, [handleHeaderInputChange, isHeaderKeyComposing, isHeaderValueComposing, headerKeyDrafts, headerValueDrafts]);

  const removeHeaderHandler = useCallback((index: number) => {
    const keyToRemove = currentHeaderEntries[index]?.[0];
    if (keyToRemove !== undefined) {
      const newHeaders = { ...(requestHeaders || {}) };
      delete newHeaders[keyToRemove];
      handleHeadersChange(newHeaders);
    }
  }, [requestHeaders, handleHeadersChange, currentHeaderEntries]);

  // Add bearer token shortcut
  const addBearerToken = useCallback(() => {
    const newHeaders = { ...(requestHeaders || {}), Authorization: 'Bearer ' };
    handleHeadersChange(newHeaders);
  }, [requestHeaders, handleHeadersChange]);
  
  const handleMethodSelectChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    handleMethodChange(e.target.value as HTTPMethod);
  }, [handleMethodChange]);
  
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
          {currentHeaderEntries.map(([key, value], index) => (
            <div key={index} className="grid grid-cols-[1fr,1fr,auto] gap-2">
              <input
                type="text"
                className="w-full p-2 bg-white border border-gray-300 rounded"
                value={headerKeyDrafts[index] ?? key}
                placeholder="Header Name"
                onChange={(e) => handleHeaderInputChange(index, 'key', e.target.value)}
                onCompositionStart={() => setIsHeaderKeyComposing(true)}
                onCompositionEnd={(e) => {
                  setIsHeaderKeyComposing(false);
                  handleHeaderInputChange(index, 'key', e.currentTarget.value);
                }}
                onBlur={() => handleHeaderBlur(index, 'key')}
                onKeyDown={handleKeyDown}
              />
              <input
                type="text"
                className="w-full p-2 bg-white border border-gray-300 rounded"
                value={headerValueDrafts[index] ?? String(value)}
                placeholder="Header Value"
                onChange={(e) => handleHeaderInputChange(index, 'value', e.target.value)}
                onCompositionStart={() => setIsHeaderValueComposing(true)}
                onCompositionEnd={(e) => {
                  setIsHeaderValueComposing(false);
                  handleHeaderInputChange(index, 'value', e.currentTarget.value);
                }}
                onBlur={() => handleHeaderBlur(index, 'value')}
                onKeyDown={handleKeyDown}
              />
              <button
                className="px-2 py-1 text-red-500 hover:text-red-700"
                onClick={() => removeHeaderHandler(index)}
                onKeyDown={handleKeyDown}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}; 