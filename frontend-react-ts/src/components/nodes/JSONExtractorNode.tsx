import React, { useCallback, useEffect, useState } from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';
import { useDispatch, useSelector } from 'react-redux';
import { updateNodeData, setNodeViewMode, getNodeEffectiveViewMode } from '../../store/flowSlice';
import { JSONExtractorNodeData } from '../../types/nodes';
import { useIsRootNode, useNodeState, executeFlow } from '../../store/flowExecutionStore';
import { RootState } from '../../store/store';

interface Props {
  id: string;
  data: JSONExtractorNodeData;
}

const JSONExtractorNode: React.FC<Props> = ({ id, data }) => {
  const dispatch = useDispatch();
  const isRootNode = useIsRootNode(id);
  const nodeState = useNodeState(id);
  const { getZoom } = useReactFlow();
  const viewMode = useSelector((state: RootState) => getNodeEffectiveViewMode(state, id));
  const globalViewMode = useSelector((state: RootState) => state.flow.globalViewMode);
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState(data.label || 'JSON Extractor');
  const [pathDraft, setPathDraft] = useState(data.path || '');
  const [isComposing, setIsComposing] = useState(false);

  // Update drafts when data changes externally
  useEffect(() => {
    if (!isComposing) {
      setPathDraft(data.path || '');
    }
  }, [data.path, isComposing]);

  // Update label draft when data changes externally
  useEffect(() => {
    setLabelDraft(data.label || 'JSON Extractor');
  }, [data.label]);

  const handlePathChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newPath = e.target.value;
    setPathDraft(newPath);
    
    if (!isComposing) {
      dispatch(updateNodeData({
        nodeId: id,
        data: { ...data, path: newPath }
      }));
    }
  }, [dispatch, id, data, isComposing]);

  const handleLabelChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLabelDraft(e.target.value);
  }, []);

  const handleLabelBlur = useCallback(() => {
    setIsEditingLabel(false);
    if (labelDraft.trim() !== data.label) {
      dispatch(updateNodeData({
        nodeId: id,
        data: { ...data, label: labelDraft.trim() || 'JSON Extractor' }
      }));
    }
  }, [dispatch, id, data, labelDraft]);

  const handleLabelKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      setIsEditingLabel(false);
      setLabelDraft(data.label || 'JSON Extractor');
    }
  }, [data.label]);

  const handleRun = useCallback(() => {
    executeFlow(id);
  }, [id]);

  const toggleNodeView = () => {
    dispatch(setNodeViewMode({
      nodeId: id,
      mode: viewMode === 'compact' ? 'expanded' : 'compact'
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

  return (
    <div className="px-4 py-2 shadow-md rounded-md bg-white border-2 border-purple-500 w-[350px]">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {isRootNode ? (
            <button
              onClick={handleRun}
              className="shrink-0 px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors"
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
              className="px-1 py-0.5 text-sm font-bold text-purple-500 border border-purple-200 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
              autoFocus
              style={{ width: `${Math.max(labelDraft.length * 8, 60)}px` }}
            />
          ) : (
            <div
              onClick={() => setIsEditingLabel(true)}
              className="font-bold text-purple-500 cursor-text hover:bg-purple-50 px-1 py-0.5 rounded"
              title="Click to edit node name"
            >
              {data.label || 'JSON Extractor'}
            </div>
          )}

          <button
            onClick={toggleNodeView}
            className="shrink-0 w-6 h-6 flex items-center justify-center text-xs text-gray-400 hover:text-gray-600 transition-colors rounded hover:bg-gray-100"
            title={viewMode === 'compact' ? 'Show more details' : 'Show less details'}
          >
            {viewMode === 'compact' ? '⌄' : '⌃'}
          </button>
        </div>
      </div>

      <div className={`space-y-2 transition-all duration-300 ${
        viewMode === 'compact' ? 'max-h-[100px]' : 'max-h-[500px]'
      } overflow-hidden`}>
        {viewMode === 'compact' ? (
          <>
            <div className="text-sm text-gray-600">
              Extract: {data.path || 'No path set'}
            </div>
            {/* Status in compact view */}
            {nodeState?.status !== 'idle' && (
              <div className="flex items-center gap-1 text-xs py-1">
                {nodeState.status === 'running' && (
                  <span className="text-yellow-600">⏳ Running...</span>
                )}
                {nodeState.status === 'success' && (
                  <span className="text-green-600">✅ Success</span>
                )}
                {nodeState.status === 'error' && (
                  <span className="text-red-600" title={nodeState.error}>❌ Error</span>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="space-y-2">
            <div className="space-y-1">
              <div className="text-xs font-medium text-gray-600">JSON Path</div>
              <input
                type="text"
                value={pathDraft}
                onChange={handlePathChange}
                onCompositionStart={() => setIsComposing(true)}
                onCompositionEnd={() => setIsComposing(false)}
                placeholder="Enter path (e.g., data.items[0].name)"
                className="w-full px-2 py-1 text-sm bg-white border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <div className="text-xs text-gray-500">
                Use dot notation to access nested fields (e.g., response.data.token)
              </div>
            </div>

            {/* Execution Status */}
            {nodeState?.status !== 'idle' && (
              <div className="flex items-center gap-1 text-xs">
                {nodeState.status === 'running' && (
                  <span className="text-yellow-600">⏳ Running...</span>
                )}
                {nodeState.status === 'success' && (
                  <span className="text-green-600">✅ Success</span>
                )}
                {nodeState.status === 'error' && (
                  <span className="text-red-600" title={nodeState.error}>❌ Error</span>
                )}
              </div>
            )}

            {/* Result Preview */}
            {nodeState?.result && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-gray-600">Extracted Value</div>
                <div className="p-2 text-xs font-mono bg-gray-50 rounded border border-gray-200 max-h-[100px] overflow-auto">
                  {typeof nodeState.result === 'string' 
                    ? nodeState.result 
                    : JSON.stringify(nodeState.result, null, 2)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <Handle
        type="target"
        position={Position.Left}
        className="w-2 h-2 !bg-purple-400 rounded-full border-2 border-white"
        style={{ left: '-6px' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-2 h-2 !bg-purple-400 rounded-full border-2 border-white"
        style={{ right: '-6px' }}
      />
    </div>
  );
};

export default JSONExtractorNode; 