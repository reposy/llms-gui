import React, { useCallback } from 'react';
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
import { useNodeContent } from '../../store/nodeContentStore';

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
  const { content, isContentDirty } = useNodeContent(id);
  
  /**
   * NOTE: Previously, there was a useEffect hook here that was synchronizing Redux data with the Zustand store.
   * This hook was causing synchronization issues between the node UI and sidebar:
   * 
   * 1. When a user updated the model in the UI, the Zustand store would update correctly
   * 2. But then, this useEffect would detect a mismatch with Redux data and overwrite the Zustand store
   * 3. This would result in user inputs being ignored or prompt values being reset
   * 
   * We've removed this hook because:
   * - The loadFromReduxNodes function is called when the flow is initially loaded
   * - The useManagedNodeContent hook now properly handles bidirectional sync between Zustand and Redux
   * - State is managed consistently through that hook in both the node UI and sidebar components
   */
  
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
              />
            )}
          </div>
        </div>
      </LLMNodeViewController>
    </NodeErrorBoundary>
  );
};

export default LLMNode; 