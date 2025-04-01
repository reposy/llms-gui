import React, { useCallback, useEffect, useState } from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';
import { useDispatch, useSelector } from 'react-redux';
import { updateNodeData, setNodeViewMode, getNodeEffectiveViewMode, VIEW_MODES } from '../../store/flowSlice';
import { APINodeData } from '../../types/nodes';
import { useIsRootNode, useNodeState, executeFlow } from '../../store/flowExecutionStore';
import { RootState } from '../../store/store';
import axios from 'axios';
import NodeErrorBoundary from './NodeErrorBoundary';
import clsx from 'clsx';

interface Props {
  id: string;
  data: APINodeData;
  isConnectable: boolean;
  selected?: boolean;
}

interface QueryParamDrafts {
  [key: string]: {
    key: string;
    value: string;
  };
}

interface RequestBody {
  [key: string]: any;
}

const APINode: React.FC<Props> = ({ id, data, isConnectable, selected }) => {
  const dispatch = useDispatch();
  const isRootNode = useIsRootNode(id);
  const nodeState = useNodeState(id);
  const { getZoom } = useReactFlow();
  const viewMode = useSelector((state: RootState) => getNodeEffectiveViewMode(state, id));
  const globalViewMode = useSelector((state: RootState) => state.flow.globalViewMode);
  const isCompactMode = viewMode === 'compact';
  const [urlDraft, setUrlDraft] = useState(data.url || '');
  const [isComposing, setIsComposing] = useState(false);
  const [paramDrafts, setParamDrafts] = useState<QueryParamDrafts>({});
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testResponse, setTestResponse] = useState<any>(null);
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState(data.label || 'API');

  // Update drafts when data changes externally
  useEffect(() => {
    if (!isComposing) {
      setUrlDraft(data.url || '');
      const newDrafts: QueryParamDrafts = {};
      Object.entries(data.queryParams || {}).forEach(([key, value]) => {
        newDrafts[key] = { key, value };
      });
      setParamDrafts(newDrafts);
    }
  }, [data.url, data.queryParams, isComposing]);

  // Update label draft when data changes externally
  useEffect(() => {
    setLabelDraft(data.label || 'API');
  }, [data.label]);

  const handleUrlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    setUrlDraft(newUrl);
    
    if (!isComposing) {
      dispatch(updateNodeData({
        nodeId: id,
        data: { ...data, url: newUrl }
      }));
    }
  }, [dispatch, id, data, isComposing]);

  const handleUrlCompositionEnd = useCallback((e: React.CompositionEvent<HTMLInputElement>) => {
    setIsComposing(false);
    const newUrl = e.currentTarget.value;
    
    dispatch(updateNodeData({
      nodeId: id,
      data: { ...data, url: newUrl }
    }));
  }, [dispatch, id, data]);

  const handleMethodChange = useCallback((method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH') => {
    dispatch(updateNodeData({
      nodeId: id,
      data: { ...data, method }
    }));
  }, [dispatch, id, data]);

  const handleAddParam = useCallback(() => {
    const params = data.queryParams || {};
    const newKey = `param${Object.keys(params).length + 1}`;
    
    dispatch(updateNodeData({
      nodeId: id,
      data: {
        ...data,
        queryParams: {
          ...params,
          [newKey]: ''
        }
      }
    }));

    setParamDrafts(prev => ({
      ...prev,
      [newKey]: { key: newKey, value: '' }
    }));
  }, [dispatch, id, data]);

  const handleParamChange = useCallback((paramKey: string, field: 'key' | 'value', newValue: string) => {
    setParamDrafts(prev => ({
      ...prev,
      [paramKey]: {
        ...prev[paramKey],
        [field]: newValue
      }
    }));

    if (!isComposing) {
      const params = { ...data.queryParams };
      if (field === 'key' && paramKey !== newValue) {
        // If key changed, remove old key and add new one
        delete params[paramKey];
        params[newValue] = paramDrafts[paramKey]?.value || '';
      } else if (field === 'value') {
        // If value changed, update existing key
        params[paramKey] = newValue;
      }

      dispatch(updateNodeData({
        nodeId: id,
        data: {
          ...data,
          queryParams: params
        }
      }));
    }
  }, [dispatch, id, data, isComposing, paramDrafts]);

  const handleRemoveParam = useCallback((keyToRemove: string) => {
    const newParams = { ...data.queryParams };
    delete newParams[keyToRemove];
    
    dispatch(updateNodeData({
      nodeId: id,
      data: {
        ...data,
        queryParams: newParams
      }
    }));

    setParamDrafts(prev => {
      const newDrafts = { ...prev };
      delete newDrafts[keyToRemove];
      return newDrafts;
    });
  }, [dispatch, id, data]);

  const handleLabelChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLabelDraft(e.target.value);
  }, []);

  const handleLabelBlur = useCallback(() => {
    setIsEditingLabel(false);
    if (labelDraft.trim() !== data.label) {
      dispatch(updateNodeData({
        nodeId: id,
        data: { ...data, label: labelDraft.trim() || 'API' }
      }));
    }
  }, [dispatch, id, data, labelDraft]);

  const handleLabelKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      setIsEditingLabel(false);
      setLabelDraft(data.label || 'API');
    }
  }, [data.label]);

  // Run full flow
  const handleRun = useCallback(() => {
    executeFlow(id);
  }, [id]);

  // Execute API request with input data
  const executeRequest = useCallback(async (input: any) => {
    try {
      const url = new URL(data.url);
      // Add query parameters
      if (data.queryParams) {
        Object.entries(data.queryParams).forEach(([key, value]) => {
          url.searchParams.append(key, value);
        });
      }

      // Prepare request body based on input
      let requestBody: RequestBody | string = data.body || {};
      if (input && typeof input === 'object') {
        // If input is an object, merge it with the body
        requestBody = { ...(typeof data.body === 'object' ? data.body : {}), ...input };
      } else if (input && typeof input === 'string') {
        // If input is a string, use it as the body
        requestBody = input;
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(data.headers || {})
      };

      const response = await axios({
        method: data.method.toLowerCase(),
        url: url.toString(),
        headers,
        data: requestBody,
      });

      return response.data;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }, [data]);

  // Test API endpoint
  const handleTest = useCallback(async () => {
    setTestStatus('testing');
    setTestResponse(null);

    try {
      // For testing, use a sample input if this is not a root node
      const testInput = !isRootNode ? { text: "Test input" } : undefined;
      const result = await executeRequest(testInput);
      setTestStatus('success');
      setTestResponse(result);
    } catch (error) {
      setTestStatus('error');
      setTestResponse(error);
    }
  }, [executeRequest, isRootNode]);

  const toggleNodeView = () => {
    dispatch(setNodeViewMode({
      nodeId: id,
      mode: isCompactMode ? 'expanded' : 'compact'
    }));
  };

  // Auto-collapse based on zoom level if in auto mode
  useEffect(() => {
    if (globalViewMode === 'auto') {
      const zoom = getZoom();
      const shouldBeCompact = zoom < 0.7;
      dispatch(setNodeViewMode({ 
        nodeId: id, 
        mode: shouldBeCompact ? 'compact' : 'expanded' 
      }));
    }
  }, [globalViewMode, getZoom, id, dispatch]);

  const renderCompactView = () => (
    <>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {isRootNode ? (
            <button
              onClick={handleRun}
              className="shrink-0 px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
              title="Run full flow from this node"
            >
              {nodeState?.status === 'running' ? '⏳' : '▶'} Run
            </button>
          ) : (
            <div 
              className="shrink-0 px-2 py-1 text-xs font-medium bg-gray-100 text-gray-400 rounded cursor-not-allowed"
              title="Only root nodes can be executed"
            >
              ▶
            </div>
          )}
          
          {isEditingLabel ? (
            <input
              type="text"
              value={labelDraft}
              onChange={handleLabelChange}
              onBlur={handleLabelBlur}
              onKeyDown={handleLabelKeyDown}
              className="px-1 py-0.5 text-sm font-bold text-green-500 border border-green-200 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
              autoFocus
              style={{ width: `${Math.max(labelDraft.length * 8, 60)}px` }}
            />
          ) : (
            <div
              onClick={() => setIsEditingLabel(true)}
              className="font-bold text-green-500 cursor-text hover:bg-green-50 px-1 py-0.5 rounded"
              title="Click to edit node name"
            >
              {data.label || 'API'}
            </div>
          )}

          <button
            onClick={toggleNodeView}
            className="shrink-0 w-6 h-6 flex items-center justify-center text-xs text-gray-400 hover:text-gray-600 transition-colors rounded hover:bg-gray-100"
            title={viewMode === VIEW_MODES.COMPACT ? 'Show more details' : 'Show less details'}
          >
            {viewMode === VIEW_MODES.COMPACT ? '⌄' : '⌃'}
          </button>
        </div>
      </div>

      <div className="text-sm text-gray-600">
        {data.method} | {data.url || 'No URL set'}
      </div>
      {nodeState?.status !== 'idle' && (
        <div className="flex items-center gap-1 text-xs py-1">
          {nodeState.status === 'running' && (
            <span className="text-yellow-600">⏳ Running...</span>
          )}
          {nodeState.status === 'success' && (
            <span className="text-green-600">✅ Success</span>
          )}
          {nodeState.status === 'error' && (
            <span className="text-red-600" title={nodeState.error ?? undefined}>❌ Error</span>
          )}
        </div>
      )}
    </>
  );

  const renderExpandedView = () => (
    <>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {isRootNode ? (
            <button
              onClick={handleRun}
              className="shrink-0 px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
              title="Run full flow from this node"
            >
              {nodeState?.status === 'running' ? '⏳' : '▶'} Run
            </button>
          ) : (
            <div 
              className="shrink-0 px-2 py-1 text-xs font-medium bg-gray-100 text-gray-400 rounded cursor-not-allowed"
              title="Only root nodes can be executed"
            >
              ▶
            </div>
          )}
          
          {isEditingLabel ? (
            <input
              type="text"
              value={labelDraft}
              onChange={handleLabelChange}
              onBlur={handleLabelBlur}
              onKeyDown={handleLabelKeyDown}
              className="px-1 py-0.5 text-sm font-bold text-green-500 border border-green-200 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
              autoFocus
              style={{ width: `${Math.max(labelDraft.length * 8, 60)}px` }}
            />
          ) : (
            <div
              onClick={() => setIsEditingLabel(true)}
              className="font-bold text-green-500 cursor-text hover:bg-green-50 px-1 py-0.5 rounded"
              title="Click to edit node name"
            >
              {data.label || 'API'}
            </div>
          )}

          <button
            onClick={toggleNodeView}
            className="shrink-0 w-6 h-6 flex items-center justify-center text-xs text-gray-400 hover:text-gray-600 transition-colors rounded hover:bg-gray-100"
            title={viewMode === VIEW_MODES.COMPACT ? 'Show more details' : 'Show less details'}
          >
            {viewMode === VIEW_MODES.COMPACT ? '⌄' : '⌃'}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex gap-2">
          <select
            value={data.method}
            onChange={(e) => handleMethodChange(e.target.value as any)}
            className="shrink-0 px-2 py-1 text-sm bg-white border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="DELETE">DELETE</option>
            <option value="PATCH">PATCH</option>
          </select>

          <input
            type="text"
            value={urlDraft}
            onChange={handleUrlChange}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={handleUrlCompositionEnd}
            placeholder="Enter API URL"
            className="flex-1 px-2 py-1 text-sm bg-white border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-gray-600">Query Parameters</div>
            <button
              onClick={handleAddParam}
              className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
            >
              + Add
            </button>
          </div>
          <div className="space-y-1">
            {Object.entries(data.queryParams || {}).map(([key, value]) => {
              const draft = paramDrafts[key] || { key, value };
              return (
                <div key={key} className="flex gap-1">
                  <input
                    type="text"
                    value={draft.key}
                    onChange={(e) => handleParamChange(key, 'key', e.target.value)}
                    onCompositionStart={() => setIsComposing(true)}
                    onCompositionEnd={() => setIsComposing(false)}
                    placeholder="Key"
                    className="flex-1 px-2 py-1 text-xs bg-white border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <input
                    type="text"
                    value={draft.value}
                    onChange={(e) => handleParamChange(key, 'value', e.target.value)}
                    onCompositionStart={() => setIsComposing(true)}
                    onCompositionEnd={() => setIsComposing(false)}
                    placeholder="Value"
                    className="flex-1 px-2 py-1 text-xs bg-white border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <button
                    onClick={() => handleRemoveParam(key)}
                    className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <button
          onClick={handleTest}
          disabled={testStatus === 'testing'}
          className={`w-full px-2 py-1 text-xs font-medium rounded transition-colors ${
            testStatus === 'testing'
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : testStatus === 'success'
              ? 'bg-green-100 text-green-700 hover:bg-green-200'
              : testStatus === 'error'
              ? 'bg-red-100 text-red-700 hover:bg-red-200'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {testStatus === 'testing' ? '⏳ Testing...' :
           testStatus === 'success' ? '✅ Test Passed' :
           testStatus === 'error' ? '❌ Test Failed' :
           '🔍 Test API'}
        </button>

        {testStatus !== 'idle' && testResponse && (
          <div className="space-y-1">
            <div className="text-xs font-medium text-gray-600">Test Response</div>
            <pre className="p-2 text-xs font-mono bg-gray-50 rounded border border-gray-200 max-h-[100px] overflow-auto">
              {typeof testResponse === 'string' 
                ? testResponse 
                : JSON.stringify(testResponse, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </>
  );

  return (
    <NodeErrorBoundary nodeId={id}>
      <div className="relative overflow-visible">
        {/* Input handle */}
        <Handle
          type="target"
          position={Position.Left}
          id="input"
          style={{
            position: 'absolute',
            width: '8px',
            height: '8px',
            left: '-6px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: '#22c55e',
            borderRadius: '50%',
            border: '1px solid white',
            zIndex: 50,
            pointerEvents: 'auto',
          }}
          isConnectable={isConnectable}
        />

        {/* Output handle */}
        <Handle
          type="source"
          position={Position.Right}
          id="output"
          style={{
            position: 'absolute',
            width: '8px',
            height: '8px',
            right: '-6px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: '#22c55e',
            borderRadius: '50%',
            border: '1px solid white',
            zIndex: 50,
            pointerEvents: 'auto',
          }}
          isConnectable={isConnectable}
        />

        {/* Node content box */}
        <div className={clsx(
          'w-[350px] px-4 py-2 bg-white rounded-md',
          'ring-1 ring-green-100',
          selected ? [
            'ring-2 ring-green-500',
            'shadow-[0_0_0_1px_rgba(34,197,94,0.5)]'
          ] : [
            'shadow-sm'
          ]
        )}>
          {isCompactMode ? renderCompactView() : renderExpandedView()}
        </div>
      </div>
    </NodeErrorBoundary>
  );
};

export default APINode; 