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
                : 'border-blue-200 shadow-sm'
            )}
          >
            {viewMode === VIEW_MODES.COMPACT ? (
              <LLMNodeCompactView
                id={id}
                data={data}
                nodeState={nodeState}
                viewMode={viewMode}
                onToggleView={toggleNodeView}
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