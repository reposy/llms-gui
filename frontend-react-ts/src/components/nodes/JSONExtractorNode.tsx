import React, { useCallback, useEffect, useState } from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';
import { JSONExtractorNodeData } from '../../types/nodes';
import { useIsRootNode, useNodeState, executeFlow } from '../../store/flowExecutionStore';
import { VIEW_MODES } from '../../store/viewModeStore';
import clsx from 'clsx';
import NodeErrorBoundary from './NodeErrorBoundary';
import { NodeHeader } from './shared/NodeHeader';
import { NodeStatusIndicator } from './shared/NodeStatusIndicator';
import { useStore as useViewModeStore, useNodeViewMode } from '../../store/viewModeStore';
import { useFlowStructureStore } from '../../store/useFlowStructureStore';

interface Props {
  id: string;
  data: JSONExtractorNodeData;
  isConnectable: boolean;
  selected?: boolean;
}

const JSONExtractorNode: React.FC<Props> = ({ id, data, isConnectable, selected }) => {
  // Use updateNode from Zustand store
  const { updateNode } = useFlowStructureStore(state => ({
    updateNode: state.updateNode
  }));
  
  const isRootNode = useIsRootNode(id);
  const nodeState = useNodeState(id);
  const { getZoom } = useReactFlow();
  
  // Get from Zustand store instead of Redux
  const viewMode = useNodeViewMode(id);
  const globalViewMode = useViewModeStore(state => state.globalViewMode);
  const setNodeViewMode = useViewModeStore(state => state.setNodeViewMode);
  
  const [pathDraft, setPathDraft] = useState(data.path || '');
  const [isComposing, setIsComposing] = useState(false);

  // Update drafts when data changes externally
  useEffect(() => {
    if (!isComposing) {
      setPathDraft(data.path || '');
    }
  }, [data.path, isComposing]);

  const handlePathChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newPath = e.target.value;
    setPathDraft(newPath);
    
    if (!isComposing) {
      // Use updateNode from Zustand instead of dispatch
      updateNode(id, (node) => ({
        ...node,
        data: { ...data, path: newPath }
      }));
    }
  }, [id, data, isComposing, updateNode]);

  // Encapsulate label update logic
  const handleLabelUpdate = useCallback((nodeId: string, newLabel: string) => {
    // Use updateNode from Zustand instead of dispatch
    updateNode(nodeId, (node) => ({
      ...node,
      data: { ...data, label: newLabel }
    }));
  }, [data, updateNode]);

  const handleRun = useCallback(() => {
    executeFlow(id);
  }, [id]);

  const toggleNodeView = () => {
    setNodeViewMode({ 
      nodeId: id,
      mode: viewMode === VIEW_MODES.COMPACT ? VIEW_MODES.EXPANDED : VIEW_MODES.COMPACT
    });
  };

  // Auto-collapse based on zoom level if in auto mode
  useEffect(() => {
    if (globalViewMode === VIEW_MODES.AUTO) {
      const zoom = getZoom();
      const shouldBeCompact = zoom < 0.7;
      setNodeViewMode({ 
        nodeId: id, 
        mode: shouldBeCompact ? VIEW_MODES.COMPACT : VIEW_MODES.EXPANDED 
      });
    }
  }, [globalViewMode, getZoom, id, setNodeViewMode]);

  // Safe access to node state status - converting to a type that NodeStatusIndicator accepts
  const nodeStatus = nodeState?.status === 'skipped' 
    ? 'idle' // Map 'skipped' to 'idle' as it's not in the accepted types
    : (nodeState?.status || 'idle');

  return (
    <NodeErrorBoundary nodeId={id}>
      <div className="relative w-[350px]">
        <Handle
          type="target"
          position={Position.Left}
          id={`${id}-target`}
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
          id={`${id}-source`}
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

        <div
          className={clsx(
            'px-4 py-2 shadow-md rounded-md bg-white',
            'border',
            selected
              ? 'border-gray-500 ring-2 ring-gray-300 ring-offset-1 shadow-lg'
              : 'border-gray-200 shadow-sm'
          )}
        >
          <NodeHeader
            nodeId={id}
            label={data.label || 'JSON Extractor'}
            placeholderLabel="JSON Extractor"
            isRootNode={isRootNode}
            isRunning={nodeStatus === 'running'}
            viewMode={viewMode}
            themeColor="purple"
            onRun={handleRun}
            onLabelUpdate={handleLabelUpdate}
            onToggleView={toggleNodeView}
          />

          <div className={`space-y-2 transition-all duration-300 ${
            viewMode === VIEW_MODES.COMPACT ? 'max-h-[100px]' : 'max-h-[500px]'
          } overflow-hidden`}>
            {viewMode === VIEW_MODES.COMPACT ? (
              <>
                <div className="text-sm text-gray-600">
                  Extract: {data.path || 'No path set'}
                </div>
                <NodeStatusIndicator status={nodeStatus} error={nodeState?.error} />
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

                <NodeStatusIndicator status={nodeStatus} error={nodeState?.error} />

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
        </div>
      </div>
    </NodeErrorBoundary>
  );
};

export default JSONExtractorNode; 