import React, { useCallback, useEffect, useState, useRef } from 'react';
import { Handle, Position, useReactFlow, NodeProps } from 'reactflow';
import { VIEW_MODES } from '../../store/viewModeStore';
import { APINodeData } from '../../types/nodes';
import { useNodeState } from '../../store/useNodeStateStore';
import { useIsRootNode } from '../../store/useNodeGraphUtils';
import axios from 'axios';
import NodeErrorBoundary from './NodeErrorBoundary';
import clsx from 'clsx';
import { NodeHeader } from './shared/NodeHeader';
import { NodeStatusIndicator } from './shared/NodeStatusIndicator';
import { useManagedNodeContent } from '../../hooks/useManagedNodeContent';
import { useApiNodeData } from '../../hooks/useApiNodeData';
import { useStore as useViewModeStore } from '../../store/viewModeStore';
import { EditableNodeLabel } from './shared/EditableNodeLabel';
import { APINodeContent } from '../../store/useNodeContentStore';
import { useExecutionController } from '../../store/useExecutionController';
import { getNodeContent, setNodeContent } from '../../store/useNodeContentStore';
import { useTemplateParser } from '../../hooks/useTemplateParser';
import { isEmpty, isEqual } from 'lodash';
import { useFlowStructureStore } from '../../store/useFlowStructureStore';
import { v4 as uuidv4 } from 'uuid';
import { FlowExecutionContext } from '../../core/FlowExecutionContext';
import { NodeFactory } from '../../core/NodeFactory';
import { registerAllNodeTypes } from '../../core/NodeRegistry';
import { buildExecutionGraphFromFlow, getExecutionGraph } from '../../store/useExecutionGraphStore';

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
  const isRootNode = useIsRootNode(id);
  const nodeState = useNodeState(id);
  const { getZoom } = useReactFlow();
  const viewMode = useViewModeStore(state => state.getNodeEffectiveViewMode(id));
  const globalViewMode = useViewModeStore(state => state.globalViewMode);
  const setNodeViewMode = useViewModeStore(state => state.setNodeViewMode);
  const isCompactMode = viewMode === VIEW_MODES.COMPACT;
  
  const { 
    content, 
    isDirty, 
    updateContent, 
    saveContent
  } = useManagedNodeContent(id, data);

  const {
    url,
    method,
    queryParams,
    handleUrlChange: setUrl,
    handleMethodChange: setMethod,
    handleQueryParamsChange: setQueryParams,
    updateApiContent,
    isDirty: apiIsDirty
  } = useApiNodeData({ nodeId: id });

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
      const draftKey = `param-${index}-${key}`; 
      drafts[draftKey] = { key, value };
    });
    return drafts;
  }, []);

  const areParamDraftsEqual = useCallback((drafts1: QueryParamDrafts, drafts2: QueryParamDrafts) => {
    const keys1 = Object.keys(drafts1);
    const keys2 = Object.keys(drafts2);
    if (keys1.length !== keys2.length) return false;
    
    return keys1.every(key => {
      const draft1 = drafts1[key];
      const draft2 = drafts2[key];
      return draft1.key === draft2.key && draft1.value === draft2.value;
    });
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

  const handleUrlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    setUrlDraft(newUrl);
    
    if (newUrl !== url) {
      setUrl(newUrl);
    }
  }, [url, setUrl]);

  const handleUrlSave = useCallback(() => {
    setIsEditingUrl(false);
    setIsComposing(false);
    
    saveContent();
  }, [saveContent]);

  const handleMethodChange = useCallback((newMethod: APINodeData['method']) => {
    setMethod(newMethod);
    
    updateContent({ method: newMethod });
    saveContent();
  }, [updateContent, saveContent, setMethod]);

  const handleAddParam = useCallback(() => {
    const currentParams = queryParams || {};
    const newKey = `param${Object.keys(currentParams).length + 1}`;
    const newParams = { ...currentParams, [newKey]: '' };
    
    setQueryParams(newParams);
    
    setParamDrafts(prev => ({
        ...prev,
        [`param-${Object.keys(prev).length}-${newKey}`]: { key: newKey, value: '' } 
    }));
  }, [queryParams, setQueryParams]);

  const handleParamDraftChange = useCallback((draftKey: string, field: 'key' | 'value', newValue: string) => {
    setIsEditingParams(true);
    setParamDrafts(prev => ({
      ...prev,
      [draftKey]: { 
        ...(prev[draftKey] || {}),
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
    
    setQueryParams(newParams);
    
    updateContent({ queryParams: newParams });
    saveContent();
  }, [paramDrafts, updateContent, saveContent, setQueryParams]);

  const handleRemoveParam = useCallback((keyToRemove: string) => {
    const currentParams = queryParams || {};
    const newParams = { ...currentParams };
    delete newParams[keyToRemove];
    
    setQueryParams(newParams);
    
    updateContent({ queryParams: newParams });
    saveContent();

    setParamDrafts(prev => {
      const nextDrafts = { ...prev };
      const draftKeyToRemove = Object.keys(nextDrafts).find(dk => nextDrafts[dk].key === keyToRemove);
      if (draftKeyToRemove) {
          delete nextDrafts[draftKeyToRemove];
      }
      return nextDrafts;
    });

  }, [queryParams, updateContent, saveContent, setQueryParams]);

  const handleLabelUpdate = useCallback((nodeId: string, newLabel: string) => {
    updateApiContent({ label: newLabel });
    
    updateContent({ label: newLabel });
    saveContent();
  }, [updateApiContent, updateContent, saveContent]);

  const handleRun = useCallback(() => {
    // Get flow structure
    const { nodes, edges } = useFlowStructureStore.getState();
    
    // Create execution context
    const executionId = `exec-${uuidv4()}`;
    const executionContext = new FlowExecutionContext(executionId);
    
    // Set trigger node
    executionContext.setTriggerNode(id);
    
    console.log(`[APINode] Starting execution for node ${id}`);
    
    // Build execution graph
    buildExecutionGraphFromFlow(nodes, edges);
    const executionGraph = getExecutionGraph();
    
    // Create node factory
    const nodeFactory = new NodeFactory();
    registerAllNodeTypes();
    
    // Find the node data
    const node = nodes.find(n => n.id === id);
    if (!node) {
      console.error(`[APINode] Node ${id} not found.`);
      return;
    }
    
    // Create the node instance
    const nodeInstance = nodeFactory.create(
      id,
      node.type as string,
      node.data,
      executionContext
    );
    
    // Attach graph structure reference to the node property
    nodeInstance.property = {
      ...nodeInstance.property,
      nodes,
      edges,
      nodeFactory,
      executionGraph
    };
    
    // Execute the node
    nodeInstance.process({}).catch(error => {
      console.error(`[APINode] Error executing node ${id}:`, error);
    });
  }, [id]);

  const executeRequest = useCallback(async (input: any) => {
    if (!url) {
        throw new Error("API URL is not set");
    }
    try {
      const urlObj = new URL(url);
      if (queryParams) {
        Object.entries(queryParams).forEach(([key, value]) => {
          urlObj.searchParams.append(key, value as string);
        });
      }

      const apiContent = content as APINodeContent;
      let requestBody: RequestBody | string = apiContent.body || {};
      if (input && typeof input === 'object') {
        requestBody = { ...(typeof apiContent.body === 'object' ? apiContent.body : {}), ...input };
      } else if (input && typeof input === 'string') {
        requestBody = input;
      }

      const headers: Record<string, string> = {
        'Content-Type': apiContent.contentType || 'application/json',
        ...(apiContent.headers || {})
      };

      const response = await axios({
        method: (method || 'get').toLowerCase(),
        url: urlObj.toString(),
        headers,
        data: requestBody,
      });

      return response.data;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }, [url, method, queryParams, content]);

  const handleTest = useCallback(async () => {
    setTestStatus('testing');
    setTestResponse(null);
    try {
      const testInput = !isRootNode ? { text: "Test input" } : undefined;
      const result = await executeRequest(testInput);
      setTestStatus('success');
      setTestResponse(result);
    } catch (error) {
      setTestStatus('error');
      setTestResponse(error);
    }
  }, [executeRequest, isRootNode]);

  const toggleNodeView = useCallback(() => {
    setNodeViewMode({
      nodeId: id,
      mode: viewMode === VIEW_MODES.COMPACT ? VIEW_MODES.EXPANDED : VIEW_MODES.COMPACT
    });
  }, [id, viewMode, setNodeViewMode]);

  useEffect(() => {
    if (globalViewMode === 'auto') {
      const zoom = getZoom();
      const shouldBeCompact = zoom < 0.7;
      const newMode = shouldBeCompact ? VIEW_MODES.COMPACT : VIEW_MODES.EXPANDED;
      
      if (viewMode !== newMode) {
        setNodeViewMode({ 
          nodeId: id, 
          mode: newMode
        });
      }
    }
  }, [globalViewMode, getZoom, id, setNodeViewMode, viewMode]);

  const mapStatus = (status: string | undefined): 'idle' | 'running' | 'success' | 'error' => {
    if (!status) return 'idle';
    if (status === 'skipped') return 'idle';
    return status as 'idle' | 'running' | 'success' | 'error';
  };

  const renderCompactView = () => (
    <>
      <NodeHeader
        nodeId={id}
        label={content.label || 'API'}
        placeholderLabel="API"
        isRootNode={isRootNode}
        isRunning={nodeState?.status === 'running'}
        viewMode={viewMode}
        themeColor="green"
        isContentDirty={isDirty}
        onRun={handleRun}
        onLabelUpdate={handleLabelUpdate}
        onToggleView={toggleNodeView}
      />

      <div className="text-sm text-gray-600 truncate">
        {method || 'GET'} | {url || 'No URL set'}
      </div>

      <NodeStatusIndicator status={mapStatus(nodeState?.status)} error={nodeState?.error} />
    </>
  );

  const renderExpandedView = () => (
    <>
      <NodeHeader
        nodeId={id}
        label={content.label || 'API'}
        placeholderLabel="API"
        isRootNode={isRootNode}
        isRunning={nodeState?.status === 'running'}
        viewMode={viewMode}
        themeColor="green"
        isContentDirty={isDirty}
        onRun={handleRun}
        onLabelUpdate={handleLabelUpdate}
        onToggleView={toggleNodeView}
      />

      <div className="space-y-2">
        <div className="flex gap-2">
          <select
            value={method || 'GET'}
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
            onFocus={() => setIsEditingUrl(true)}
            onBlur={handleUrlSave}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={handleUrlSave}
            onKeyDown={(e) => e.key === 'Enter' && handleUrlSave()}
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
            {Object.entries(paramDrafts).map(([draftKey, draft]) => (
              <div key={draftKey} className="flex gap-1">
                <input
                  type="text"
                  value={draft.key}
                  onChange={(e) => handleParamDraftChange(draftKey, 'key', e.target.value)}
                  onFocus={() => setIsEditingParams(true)}
                  onBlur={handleParamSave}
                  onCompositionStart={() => setIsComposing(true)}
                  onCompositionEnd={() => setIsComposing(false)}
                  placeholder="Key"
                  className="flex-1 px-2 py-1 text-xs bg-white border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <input
                  type="text"
                  value={draft.value}
                  onChange={(e) => handleParamDraftChange(draftKey, 'value', e.target.value)}
                  onFocus={() => setIsEditingParams(true)}
                  onBlur={handleParamSave}
                  onCompositionStart={() => setIsComposing(true)}
                  onCompositionEnd={() => setIsComposing(false)}
                  placeholder="Value"
                  className="flex-1 px-2 py-1 text-xs bg-white border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <button
                  onClick={() => handleRemoveParam(draft.key)}
                  className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
                >
                  ×
                </button>
              </div>
            ))}
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

        <NodeStatusIndicator status={mapStatus(nodeState?.status)} error={nodeState?.error} />
      </div>
    </>
  );

  return (
    <NodeErrorBoundary nodeId={id}>
      <div className="relative w-[350px]">
        <Handle
          type="target"
          position={Position.Left}
          id="target"
          isConnectable={isConnectable}
          style={{
            background: '#22c55e',
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
          id="source"
          isConnectable={isConnectable}
          style={{
            background: '#22c55e',
            border: '1px solid white',
            width: '8px',
            height: '8px',
            top: '50%',
            transform: 'translateY(-50%)',
            right: '-4px',
            zIndex: 50
          }}
        />

        <div
          className={clsx(
            'px-4 py-2 shadow-md rounded-md bg-white',
            'border',
            selected
              ? 'border-green-500 ring-2 ring-green-300 ring-offset-1 shadow-lg'
              : 'border-green-200 shadow-sm'
          )}
        >
          {viewMode === VIEW_MODES.COMPACT ? renderCompactView() : renderExpandedView()}
        </div>
      </div>
    </NodeErrorBoundary>
  );
};

export default APINode; 