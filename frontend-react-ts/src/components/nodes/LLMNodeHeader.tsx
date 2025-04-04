import React, { useCallback, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { updateNodeData } from '../../store/flowSlice';
import { NodeViewMode, VIEW_MODES } from '../../store/viewModeSlice';
import { useIsRootNode, useNodeState, executeFlow } from '../../store/flowExecutionStore';
import { NodeHeader } from './shared/NodeHeader';
import { LLMNodeData } from '../../types/nodes';

interface LLMNodeHeaderProps {
  id: string;
  data: LLMNodeData;
  viewMode: NodeViewMode;
  onToggleView: () => void;
  isContentDirty?: boolean;
}

export const LLMNodeHeader: React.FC<LLMNodeHeaderProps> = ({ 
  id, 
  data, 
  viewMode, 
  onToggleView,
  isContentDirty
}) => {
  const dispatch = useDispatch();
  const isRootNode = useIsRootNode(id);
  const nodeState = useNodeState(id);
  
  const handleLabelUpdate = useCallback((nodeId: string, newLabel: string) => {
    dispatch(updateNodeData({ nodeId, data: { ...data, label: newLabel } }));
  }, [dispatch, data]);

  const handleRun = useCallback(() => {
    const isGroupRootNode = isRootNode || !!document.querySelector(`[data-id="${id}"]`)?.closest('[data-type="group"]');
    if (isGroupRootNode) {
      executeFlow(id);
    }
  }, [id, isRootNode]);

  return (
    <NodeHeader
      nodeId={id}
      label={data.label || 'LLM'}
      placeholderLabel="LLM"
      isRootNode={isRootNode}
      isRunning={nodeState?.status === 'running'}
      viewMode={viewMode}
      themeColor="blue"
      isContentDirty={isContentDirty}
      onRun={handleRun}
      onLabelUpdate={handleLabelUpdate}
      onToggleView={onToggleView}
    />
  );
}; 