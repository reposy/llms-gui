import React, { useCallback, useEffect, useState } from 'react';
import { Handle, Position } from 'reactflow';
import { useDispatch } from 'react-redux';
import { updateNodeData } from '../../store/flowSlice';
import { APINodeData } from '../../types/nodes';

interface KeyValuePair {
  key: string;
  value: string;
  enabled: boolean;
}

const APINode: React.FC<{ data: APINodeData; id: string }> = ({ data, id }) => {
  const dispatch = useDispatch();
  
  // IME composition states and drafts
  const [isComposing, setIsComposing] = useState(false);
  const [isKeyComposing, setIsKeyComposing] = useState(false);
  const [keyDrafts, setKeyDrafts] = useState<Record<number, string>>({});
  const [isValueComposing, setIsValueComposing] = useState(false);
  const [valueDrafts, setValueDrafts] = useState<Record<number, string>>({});
  const [urlDraft, setUrlDraft] = useState(data.url ?? '');

  // Update draft when data.url changes externally
  React.useEffect(() => {
    if (!isComposing) {
      setUrlDraft(data.url ?? '');
    }
  }, [data.url, isComposing]);

  // Parse URL and extract query parameters without forcing https://
  const parseUrlAndQueryParams = useCallback((urlString: string) => {
    try {
      const hasProtocol = /^[a-zA-Z]+:\/\//.test(urlString);
      const url = new URL(hasProtocol ? urlString : `http://${urlString}`);
      const params: KeyValuePair[] = [];
      url.searchParams.forEach((value, key) => {
        params.push({ key, value: decodeURIComponent(String(value)), enabled: true });
      });
      return {
        baseUrl: hasProtocol ? `${url.protocol}//${url.host}${url.pathname}` : url.host + url.pathname,
        queryParams: params
      };
    } catch (error) {
      return { baseUrl: urlString, queryParams: [] };
    }
  }, []);

  // Update URL when query parameters change
  const updateUrlFromQueryParams = useCallback((baseUrl: string, params: KeyValuePair[]) => {
    try {
      // Only try to parse as URL if it contains a protocol
      const hasProtocol = /^[a-zA-Z]+:\/\//.test(baseUrl);
      const url = new URL(hasProtocol ? baseUrl : `http://${baseUrl}`);
      url.search = '';
      params.forEach(param => {
        if (param.enabled && param.key) {
          url.searchParams.set(param.key, encodeURIComponent(param.value));
        }
      });
      return hasProtocol ? url.toString() : url.host + url.pathname + url.search;
    } catch (error) {
      return baseUrl;
    }
  }, []);

  // Sync drafts with data changes
  useEffect(() => {
    const initialKeyDrafts: Record<number, string> = {};
    const initialValueDrafts: Record<number, string> = {};
    if (data.queryParams) {
      Object.entries(data.queryParams).forEach(([key, value], index) => {
        initialKeyDrafts[index] = key;
        initialValueDrafts[index] = String(value);
      });
    }
    setKeyDrafts(initialKeyDrafts);
    setValueDrafts(initialValueDrafts);
  }, [data]);

  // Handle URL input change
  const handleUrlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setUrlDraft(newValue);
    
    if (!isComposing) {
      const { baseUrl, queryParams: newParams } = parseUrlAndQueryParams(newValue);
      dispatch(updateNodeData({
        nodeId: id,
        data: {
          ...data,
          url: newValue,
          queryParams: newParams.reduce((acc, param) => ({
            ...acc,
            [param.key]: param.value
          }), {})
        } as APINodeData
      }));
    }
  }, [dispatch, id, data, parseUrlAndQueryParams, isComposing]);

  // Handle URL composition end
  const handleUrlCompositionEnd = useCallback((e: React.CompositionEvent<HTMLInputElement>) => {
    setIsComposing(false);
    const newValue = e.currentTarget.value;
    const { baseUrl, queryParams: newParams } = parseUrlAndQueryParams(newValue);
    
    dispatch(updateNodeData({
      nodeId: id,
      data: {
        ...data,
        url: newValue,
        queryParams: newParams.reduce((acc, param) => ({
          ...acc,
          [param.key]: param.value
        }), {})
      } as APINodeData
    }));
  }, [dispatch, id, data, parseUrlAndQueryParams]);

  // Handle query parameter changes
  const handleQueryParamChange = useCallback((index: number, field: keyof KeyValuePair, value: string | boolean) => {
    if (field === 'key') {
      setKeyDrafts(prev => ({ ...prev, [index]: value as string }));
      if (!isKeyComposing) {
        const queryParams = Object.entries(data.queryParams || {}).map(([key, val], i) => ({
          key: i === index ? value as string : key,
          value: val,
          enabled: true
        }));
        
        const { baseUrl } = parseUrlAndQueryParams(data.url || '');
        const newUrl = updateUrlFromQueryParams(baseUrl, queryParams);
        
        dispatch(updateNodeData({
          nodeId: id,
          data: {
            ...data,
            url: newUrl,
            queryParams: queryParams.reduce((acc, param) => ({
              ...acc,
              [param.key]: param.value
            }), {})
          } as APINodeData
        }));
      }
    } else if (field === 'value') {
      setValueDrafts(prev => ({ ...prev, [index]: value as string }));
      if (!isValueComposing) {
        const queryParams = Object.entries(data.queryParams || {}).map(([key, val], i) => ({
          key,
          value: i === index ? value as string : val,
          enabled: true
        }));
        
        const { baseUrl } = parseUrlAndQueryParams(data.url || '');
        const newUrl = updateUrlFromQueryParams(baseUrl, queryParams);
        
        dispatch(updateNodeData({
          nodeId: id,
          data: {
            ...data,
            url: newUrl,
            queryParams: queryParams.reduce((acc, param) => ({
              ...acc,
              [param.key]: param.value
            }), {})
          } as APINodeData
        }));
      }
    } else if (field === 'enabled') {
      const queryParams = Object.entries(data.queryParams || {}).map(([key, val], i) => ({
        key,
        value: val,
        enabled: i === index ? value as boolean : true
      }));
      
      const { baseUrl } = parseUrlAndQueryParams(data.url || '');
      const newUrl = updateUrlFromQueryParams(baseUrl, queryParams);
      
      dispatch(updateNodeData({
        nodeId: id,
        data: {
          ...data,
          url: newUrl,
          queryParams: queryParams.reduce((acc, param) => ({
            ...acc,
            [param.key]: param.value
          }), {})
        } as APINodeData
      }));
    }
  }, [dispatch, id, data, parseUrlAndQueryParams, updateUrlFromQueryParams, isKeyComposing, isValueComposing]);

  const handleQueryParamBlur = useCallback((index: number, field: keyof KeyValuePair) => {
    const queryParams = Object.entries(data.queryParams || {}).map(([key, val], i) => ({
      key: field === 'key' && i === index ? keyDrafts[index] || key : key,
      value: field === 'value' && i === index ? valueDrafts[index] || val : val,
      enabled: true
    }));
    
    const { baseUrl } = parseUrlAndQueryParams(data.url || '');
    const newUrl = updateUrlFromQueryParams(baseUrl, queryParams);
    
    dispatch(updateNodeData({
      nodeId: id,
      data: {
        ...data,
        url: newUrl,
        queryParams: queryParams.reduce((acc, param) => ({
          ...acc,
          [param.key]: param.value
        }), {})
      } as APINodeData
    }));
  }, [dispatch, id, data, keyDrafts, valueDrafts, parseUrlAndQueryParams, updateUrlFromQueryParams]);

  return (
    <div className="relative px-4 py-3 rounded-lg border-2 border-gray-200 bg-white shadow-sm min-w-[300px] max-w-[600px]">
      <Handle 
        type="target" 
        position={Position.Left} 
        className="w-2 h-2 !bg-gray-400 rounded-full border-2 border-white"
        style={{ 
          position: 'absolute',
          left: '-6px',
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 50
        }}
      />
      
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className={`shrink-0 px-2 py-1 text-xs font-medium rounded ${
            data.method === 'GET' ? 'bg-blue-100 text-blue-700' :
            data.method === 'POST' ? 'bg-green-100 text-green-700' :
            data.method === 'PUT' ? 'bg-yellow-100 text-yellow-700' :
            data.method === 'DELETE' ? 'bg-red-100 text-red-700' :
            'bg-purple-100 text-purple-700'
          }`}>
            {data.method}
          </span>
          <input
            type="text"
            value={urlDraft}
            onChange={handleUrlChange}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={handleUrlCompositionEnd}
            placeholder="Enter URL (e.g., api.example.com/endpoint)"
            className="flex-1 min-w-0 p-2 text-sm bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {data.method === 'GET' && data.queryParams && Object.keys(data.queryParams).length > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium text-gray-500">Query Parameters</span>
            </div>
            <div className="space-y-2">
              {Object.entries(data.queryParams).map(([key, value], index) => (
                <div key={index} className="grid grid-cols-[auto,1fr,auto,1fr,auto] items-center gap-2">
                  <input
                    type="checkbox"
                    checked={true}
                    onChange={(e) => handleQueryParamChange(index, 'enabled', e.target.checked)}
                    className="w-3 h-3"
                  />
                  <input
                    type="text"
                    value={keyDrafts[index] ?? key}
                    onChange={(e) => handleQueryParamChange(index, 'key', e.target.value)}
                    onCompositionStart={() => setIsKeyComposing(true)}
                    onCompositionEnd={() => {
                      setIsKeyComposing(false);
                      handleQueryParamChange(index, 'key', keyDrafts[index] ?? key);
                    }}
                    onBlur={() => handleQueryParamBlur(index, 'key')}
                    placeholder="key"
                    className="w-full min-w-0 px-2 py-1 text-xs bg-white border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <span className="text-gray-400 justify-self-center">=</span>
                  <input
                    type="text"
                    value={valueDrafts[index] ?? value}
                    onChange={(e) => handleQueryParamChange(index, 'value', e.target.value)}
                    onCompositionStart={() => setIsValueComposing(true)}
                    onCompositionEnd={() => {
                      setIsValueComposing(false);
                      handleQueryParamChange(index, 'value', valueDrafts[index] ?? value);
                    }}
                    onBlur={() => handleQueryParamBlur(index, 'value')}
                    placeholder="value"
                    className="w-full min-w-0 px-2 py-1 text-xs bg-white border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {data.method !== 'GET' && (
          <div className="text-xs text-gray-500">
            {data.contentType || 'application/json'}
          </div>
        )}
      </div>

      <Handle 
        type="source" 
        position={Position.Right} 
        className="w-2 h-2 !bg-gray-400 rounded-full border-2 border-white"
        style={{ 
          position: 'absolute',
          right: '-6px',
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 50
        }}
      />
    </div>
  );
};

export default APINode; 