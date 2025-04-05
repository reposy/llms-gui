import React, { useCallback, useEffect, useRef } from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';
import { useDispatch, useSelector } from 'react-redux';
import { setNodeViewMode, getNodeEffectiveViewMode, VIEW_MODES, NodeViewMode } from '../../store/viewModeSlice';
import { LLMNodeData } from '../../types/nodes';
import { useNodeState } from '../../store/flowExecutionStore';
import { RootState } from '../../store/store';
import NodeErrorBoundary from './NodeErrorBoundary';
import clsx from 'clsx';
import { LLMNodeCompactView } from './LLMNodeCompactView';
import { LLMNodeExpandedView } from './LLMNodeExpandedView';
import { LLMNodeViewController } from './LLMNodeViewController';
import { useNodeContent, loadFromReduxNodes } from '../../store/nodeContentStore';

interface Props {
  id: string;
  data: LLMNodeData;
  isConnectable: boolean;
  selected?: boolean;
}

const LLMNode: React.FC<Props> = ({ id, data, isConnectable, selected }) => {
  const dispatch = useDispatch();
  const nodeState = useNodeState(id);
  const viewMode = useSelector((state: RootState) => getNodeEffectiveViewMode(state, id)) as NodeViewMode;
  
  // Get node content from content store
  const { content, isContentDirty, setContent } = useNodeContent(id);
  
  // Use a ref to track our update status and prevent cascading updates
  const updatePerformedRef = useRef(false);
  
  // Load data from Redux to content store on mount and when data changes
  useEffect(() => {
    // Add debug logs
    console.log(`[LLMNode ${id}] useEffect triggered with:`, {
      id,
      dataModel: data.model,
      contentModel: content.model,
      updatePerformed: updatePerformedRef.current
    });
    
    // If we've already performed an update in this render cycle, skip to prevent loops
    if (updatePerformedRef.current) {
      updatePerformedRef.current = false;
      return;
    }
    
    // We need to prevent the infinite update loop
    // Only perform updates when necessary
    
    // 1. Cache the current content model to compare
    const currentContentModel = content.model;
    
    // 2. Only load from Redux if we need to (model mismatch)
    if (data.model !== currentContentModel) {
      console.log(`[LLMNode ${id}] Loading from Redux nodes`);
      loadFromReduxNodes([{ id, data } as any]);
      
      // 3. If data.model exists and doesn't match content, update content
      if (data.model && data.model !== currentContentModel) {
        console.log(`[LLMNode ${id}] Setting content model to ${data.model}`);
        updatePerformedRef.current = true;
        setContent({ model: data.model });
      }
    }
  }, [id, data, setContent]);

  const toggleNodeView = useCallback(() => {
    dispatch(setNodeViewMode({
      nodeId: id,
      mode: viewMode === VIEW_MODES.COMPACT ? VIEW_MODES.EXPANDED : VIEW_MODES.COMPACT
    }));
  }, [dispatch, id, viewMode]);

  return (
    <NodeErrorBoundary nodeId={id}>
      <LLMNodeViewController id={id}>
        <div className="relative w-[350px]">
          <Handle
            type="target"
            position={Position.Left}
            id={`${id}-target`}
            isConnectable={isConnectable}
            style={{
              background: '#3b82f6',
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
              background: '#3b82f6',
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
                ? 'border-blue-500 ring-2 ring-blue-300 ring-offset-1 shadow-lg'
                : 'border-blue-200 shadow-sm',
              isContentDirty ? 'border-l-4 border-l-yellow-400' : '' // Show dirty state visual indicator
            )}
          >
            {viewMode === VIEW_MODES.COMPACT ? (
              <LLMNodeCompactView
                id={id}
                data={data}
                nodeState={nodeState}
                viewMode={viewMode}
                onToggleView={toggleNodeView}
                nodeContent={content}
              />
            ) : (
              <LLMNodeExpandedView
                id={id}
                data={data}
                nodeState={nodeState}
                viewMode={viewMode}
                onToggleView={toggleNodeView}
                nodeContent={content}
              />
            )}
          </div>
        </div>
      </LLMNodeViewController>
    </NodeErrorBoundary>
  );
};

export default LLMNode; 