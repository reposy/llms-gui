// src/components/nodes/APINode.tsx
import React, { useCallback, useEffect, useState } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { VIEW_MODES } from '../../store/viewModeStore';
import { APINodeData, HTTPMethod } from '../../types/nodes';
import { useNodeState } from '../../store/useNodeStateStore';
import { useIsRootNode } from '../../store/useNodeGraphUtils';
import NodeErrorBoundary from './NodeErrorBoundary';
import clsx from 'clsx';
import { NodeHeader } from './shared/NodeHeader';
import { NodeStatusIndicator } from './shared/NodeStatusIndicator';
import { useApiNodeData } from '../../hooks/useApiNodeData';
import { useStore as useViewModeStore } from '../../store/viewModeStore';

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

const APINode: React.FC<Props> = ({ id, data, isConnectable, selected }) => {
  const apiData = data;
  const isRootNode = useIsRootNode(id);
  const nodeState = useNodeState(id);
  const { getZoom } = useReactFlow();
  const viewMode = useViewModeStore(state => state.getNodeEffectiveViewMode(id));
  const globalViewMode = useViewModeStore(state => state.globalViewMode);
  const setNodeViewMode = useViewModeStore(state => state.setNodeViewMode);
  const isCompactMode = viewMode === VIEW_MODES.COMPACT;
  
  const {
    content,
    url,
    method,
    label,
    requestBodyType,
    requestBody,
    requestHeaders,
    response,
    statusCode,
    executionTime,
    errorMessage,
    isRunning,
    isDirty,
    handleUrlChange,
    handleMethodChange,
    handleLabelChange,
    handleRequestBodyTypeChange,
    handleRequestBodyChange,
    handleHeadersChange,
    updateContent,
    setIsRunning,
    executeApiCall
  } = useApiNodeData({ nodeId: id });

  const queryParams = content.queryParams || {};

  const [urlDraft, setUrlDraft] = useState(url || '');
  const [paramDrafts, setParamDrafts] = useState<QueryParamDrafts>({});
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testResponse, setTestResponse] = useState<any>(null);
  const [isComposing, setIsComposing] = useState(false);
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const [isEditingParams, setIsEditingParams] = useState(false);

  const buildParamDrafts = useCallback((params: Record<string, string> = {}) => {
    const drafts: QueryParamDrafts = {};
    Object.entries(params).forEach(([key, value], index) => {
      const draftKey = `param-${index}-${key || 'new'}`;
      drafts[draftKey] = { key, value };
    });
    return drafts;
  }, []);

  const areParamDraftsEqual = useCallback((drafts1: QueryParamDrafts, drafts2: QueryParamDrafts) => {
    const keys1 = Object.keys(drafts1);
    const keys2 = Object.keys(drafts2);
    if (keys1.length !== keys2.length) return false;
    return keys1.every(key => 
        drafts1[key] && drafts2[key] && 
        drafts1[key].key === drafts2[key].key && 
        drafts1[key].value === drafts2[key].value
    );
  }, []);

  useEffect(() => {
    if (!isEditingUrl && !isComposing && urlDraft !== (url || '')) {
      setUrlDraft(url || '');
    }
    if (!isEditingParams) {
      const newDrafts = buildParamDrafts(queryParams);
      if (!areParamDraftsEqual(paramDrafts, newDrafts)) {
        setParamDrafts(newDrafts);
      }
    }
  }, [url, queryParams, isEditingUrl, isEditingParams, isComposing, urlDraft, buildParamDrafts, areParamDraftsEqual, paramDrafts]);

  const handleUrlInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setUrlDraft(e.target.value);
    if (!isComposing) {
      handleUrlChange(e.target.value);
    }
  }, [isComposing, handleUrlChange]);

  const handleUrlCompositionEnd = useCallback((e: React.CompositionEvent<HTMLInputElement>) => {
    setIsComposing(false);
    handleUrlChange(e.currentTarget.value);
    setIsEditingUrl(false);
  }, [handleUrlChange]);

  const handleUrlBlur = useCallback(() => {
    if (!isComposing) {
      handleUrlChange(urlDraft);
      setIsEditingUrl(false);
    }
  }, [isComposing, urlDraft, handleUrlChange]);

  const handleMethodSelectChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    handleMethodChange(e.target.value as HTTPMethod);
  }, [handleMethodChange]);

  const handleAddParam = useCallback(() => {
    const newParams = { ...(queryParams || {}), '': '' };
    updateContent({ queryParams: newParams });
    setIsEditingParams(true);
  }, [queryParams, updateContent]);

  const handleParamDraftChange = useCallback((draftKey: string, field: 'key' | 'value', newValue: string) => {
    setIsEditingParams(true);
    setParamDrafts(prev => ({
      ...prev,
      [draftKey]: { 
        ...(prev[draftKey] || { key: '', value: '' }),
        [field]: newValue 
      }
    }));
  }, []);
  
  const handleParamSave = useCallback(() => {
    setIsEditingParams(false);
    setIsComposing(false);
    const newParams: Record<string, string> = {};
    Object.values(paramDrafts).forEach(draft => {
      if (draft.key) {
        newParams[draft.key] = draft.value;
      }
    });
    updateContent({ queryParams: newParams });
  }, [paramDrafts, updateContent]);

  const handleRemoveParam = useCallback((keyToRemove: string) => {
    const newParams = { ...(queryParams || {}) };
    delete newParams[keyToRemove];
    updateContent({ queryParams: newParams });
    setIsEditingParams(false);
  }, [queryParams, updateContent]);

  const handleApiLabelUpdate = useCallback((passedNodeId: string, newLabel: string) => {
    handleLabelChange(newLabel);
  }, [handleLabelChange]);

  const handleApiRun = useCallback(() => {
    executeApiCall();
  }, [executeApiCall]);

  const handleToggleView = useCallback(() => {
    const nextMode = isCompactMode ? VIEW_MODES.EXPANDED : VIEW_MODES.COMPACT;
    setNodeViewMode({ nodeId: id, mode: nextMode });
  }, [id, isCompactMode, setNodeViewMode]);

  const mapStatus = useCallback((status: string | undefined): 'idle' | 'running' | 'success' | 'error' => {
    switch (status) {
      case 'running': return 'running';
      case 'success': return 'success';
      case 'error': return 'error';
      default: return 'idle';
    }
  }, []);

  const renderCompactView = () => (
    <div className="p-2 space-y-1">
      <div className="flex justify-between items-center text-xs">
        <span className="text-gray-500">Method:</span>
        <span className="font-medium text-gray-700 bg-gray-100 px-1 rounded">{method}</span>
      </div>
      <div className="text-xs text-gray-500 truncate" title={url || 'No URL specified'}>
        URL: {url || '-'}
      </div>
      {queryParams && Object.keys(queryParams).length > 0 && (
        <div className="text-xs text-gray-500">
          Params: {Object.keys(queryParams).length}
        </div>
      )}
      {requestHeaders && Object.keys(requestHeaders).length > 0 && (
        <div className="text-xs text-gray-500">
          Headers: {Object.keys(requestHeaders).length}
        </div>
      )}
      {requestBodyType !== 'none' && requestBody && (
        <div className="text-xs text-gray-500">Body: {requestBodyType}</div>
      )}
      {nodeState.status && nodeState.status !== 'idle' && (
        <div className="text-xs text-gray-500 flex items-center gap-1">
          Status: <NodeStatusIndicator status={mapStatus(nodeState.status)} />
        </div>
      )}
    </div>
  );

  const renderExpandedView = () => (
    <div className="p-3 space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Method</label>
        <select
          value={method}
          onChange={handleMethodSelectChange}
          className="nodrag w-full p-1.5 border border-gray-300 rounded text-sm bg-white text-black focus:outline-none focus:ring-1 focus:ring-purple-500 shadow-sm"
        >
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="DELETE">DELETE</option>
          <option value="PATCH">PATCH</option>
        </select>
      </div>
      
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">URL</label>
        <input
          type="text"
          value={urlDraft}
          onChange={handleUrlInputChange}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={handleUrlCompositionEnd}
          onFocus={() => setIsEditingUrl(true)}
          onBlur={handleUrlBlur}
          placeholder="Enter API URL"
          className="nodrag w-full p-1.5 border border-gray-300 rounded text-sm bg-white text-black focus:outline-none focus:ring-1 focus:ring-purple-500 shadow-sm"
        />
      </div>

      <div>
        <div className="flex justify-between items-center mb-1">
          <label className="block text-xs font-medium text-gray-600">Query Parameters</label>
          <button 
            onClick={handleAddParam}
            className="text-xs px-1.5 py-0.5 bg-gray-100 hover:bg-gray-200 rounded text-gray-700"
          >
            + Add
          </button>
        </div>
        <div className="space-y-1">
          {Object.entries(paramDrafts).map(([draftKey, { key, value }]) => (
            <div key={draftKey} className="grid grid-cols-[1fr,1fr,auto] gap-1 items-center">
              <input
                type="text"
                value={key}
                onChange={(e) => handleParamDraftChange(draftKey, 'key', e.target.value)}
                onFocus={() => setIsEditingParams(true)}
                onBlur={handleParamSave}
                placeholder="Param Key"
                className="nodrag p-1 border border-gray-300 rounded text-xs bg-white text-black focus:outline-none focus:ring-1 focus:ring-purple-500 shadow-sm"
              />
              <input
                type="text"
                value={value}
                onChange={(e) => handleParamDraftChange(draftKey, 'value', e.target.value)}
                onFocus={() => setIsEditingParams(true)}
                onBlur={handleParamSave}
                placeholder="Param Value"
                className="nodrag p-1 border border-gray-300 rounded text-xs bg-white text-black focus:outline-none focus:ring-1 focus:ring-purple-500 shadow-sm"
              />
              <button
                onClick={() => handleRemoveParam(key)}
                className="text-red-500 hover:text-red-700 text-xs p-0.5"
              >
                ✕
              </button>
            </div>
          ))}
          {Object.keys(paramDrafts).length === 0 && (
            <div className="text-xs text-gray-400 italic">No query parameters</div>
          )}
        </div>
      </div>

      {nodeState.status === 'success' && response && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Last Response</label>
          <div className="p-2 bg-gray-50 border border-gray-200 rounded text-xs max-h-24 overflow-auto font-mono">
            {typeof response.data === 'object' ? JSON.stringify(response.data, null, 2) : String(response.data)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Status: {statusCode}, Time: {executionTime}ms
          </div>
        </div>
      )}
      {nodeState.status === 'error' && errorMessage && (
        <div>
          <label className="block text-xs font-medium text-red-600 mb-1">Error</label>
          <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
            {errorMessage}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <NodeErrorBoundary nodeId={id}>
      <div className="relative">
        <Handle 
          type="target" 
          position={Position.Left} 
          id="input"
          isConnectable={isConnectable}
          style={{
            background: '#a855f7',
            border: '1px solid white',
            width: '8px',
            height: '8px',
            top: '50%',
            transform: 'translateY(-50%)',
            left: '-4px',
            zIndex: 50
          }}
        />
        <Handle 
          type="source" 
          position={Position.Right} 
          id="output"
          isConnectable={isConnectable}
          style={{
            background: '#a855f7',
            border: '1px solid white',
            width: '8px',
            height: '8px',
            top: '50%',
            transform: 'translateY(-50%)',
            right: '-4px',
            zIndex: 50
          }}
        />

        <div className={clsx(
          'w-[300px] shadow-md rounded-md bg-white border',
          selected ? 'border-purple-500 ring-2 ring-purple-300 ring-offset-1' : 'border-gray-200',
          isCompactMode && 'w-auto min-w-[150px]'
        )}>
          <NodeHeader
            nodeId={id}
            label={label || 'API Call'} 
            placeholderLabel="API Call Node"
            isRootNode={isRootNode}
            isRunning={isRunning}
            isContentDirty={isDirty}
            viewMode={viewMode}
            themeColor="purple"
            onRun={handleApiRun}
            onLabelUpdate={handleApiLabelUpdate}
            onToggleView={handleToggleView}
          />
          
          {isCompactMode ? renderCompactView() : renderExpandedView()}
          
        </div>
      </div>
    </NodeErrorBoundary>
  );
};

export default APINode; 