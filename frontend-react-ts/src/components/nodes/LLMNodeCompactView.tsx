import React, { useMemo } from 'react';
import { LLMNodeData } from '../../types/nodes';
import { NodeState } from '../../types/execution';
import { NodeStatusIndicator } from './shared/NodeStatusIndicator';
import { LLMNodeHeader } from './LLMNodeHeader';
import { NodeViewMode } from '../../store/viewModeSlice';

interface LLMNodeCompactViewProps {
  id: string;
  data: LLMNodeData;
  nodeState: NodeState | undefined;
  viewMode: NodeViewMode;
  onToggleView: () => void;
}

export const LLMNodeCompactView: React.FC<LLMNodeCompactViewProps> = ({
  id,
  data,
  nodeState,
  viewMode,
  onToggleView
}) => {
  // Map the execution state to the status indicator format
  const nodeStatus = useMemo(() => {
    if (!nodeState) return 'idle';
    
    // Map 'skipped' to 'idle' for the NodeStatusIndicator
    return nodeState.status === 'skipped' 
      ? 'idle' 
      : nodeState.status === 'running' || nodeState.status === 'success' || nodeState.status === 'error'
        ? nodeState.status
        : 'idle';
  }, [nodeState]);

  return (
    <>
      <LLMNodeHeader
        id={id}
        data={data}
        viewMode={viewMode}
        onToggleView={onToggleView}
      />
      
      {/* Compact content */}
      <div className="text-sm text-gray-600">
        {data.provider} | {data.model}
        {data.temperature && ` | ${data.temperature}`}
      </div>
      <div className="text-sm text-gray-600 line-clamp-2">
        {data.prompt || 'No prompt set'}
      </div>

      <NodeStatusIndicator status={nodeStatus} error={nodeState?.error} />
    </>
  );
}; 