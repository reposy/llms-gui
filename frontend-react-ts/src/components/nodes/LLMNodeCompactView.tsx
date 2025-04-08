import React from 'react';
import { LLMNodeData } from '../../types/nodes';
import { NodeState } from '../../types/execution';
import { NodeViewMode } from '../../store/viewModeStore';
import { NodeStatusIndicator } from './shared/NodeStatusIndicator';
import { useLlmNodeData } from '../../hooks/useLlmNodeData';

interface LLMNodeCompactViewProps {
  id: string;
  data: LLMNodeData;
  nodeState: NodeState | null;
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
  // Use the LLM data hook to get content
  const { prompt, model, provider, label } = useLlmNodeData({ nodeId: id });

  // Use compact display with truncated prompt
  const truncatedPrompt = prompt.length > 50
    ? `${prompt.substring(0, 50)}...`
    : prompt;

  // Map the execution state to the status indicator format
  let nodeStatus: 'idle' | 'running' | 'success' | 'error' = 'idle';
  if (nodeState) {
    if (nodeState.status === 'running' || nodeState.status === 'success' || nodeState.status === 'error') {
      nodeStatus = nodeState.status;
    }
  }

  return (
    <div className="flex flex-col space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex-1 text-sm font-medium truncate" onClick={onToggleView}>
          {label || data.label || 'LLM Node'}
        </div>
        <NodeStatusIndicator status={nodeStatus} />
      </div>
      
      <div className="flex items-center text-xs text-gray-600">
        <div className="flex-1 truncate">
          {model || data.model || 'No model set'}
        </div>
        <div className="text-xs text-gray-500">
          {provider || data.provider}
        </div>
      </div>
      
      <div 
        className="text-xs text-gray-600 cursor-pointer hover:text-blue-600"
        onClick={onToggleView}
      >
        {truncatedPrompt || 'No prompt set'}
      </div>
      
      {/* Display a result preview when execution is successful */}
      {nodeState?.status === 'success' && nodeState.result && (
        <div className="text-xs text-gray-700 mt-1 truncate bg-gray-100 p-1 rounded border border-gray-300">
          <span className="font-semibold text-gray-600">Result: </span>
          {typeof nodeState.result === 'string' 
            ? (nodeState.result.length > 60 ? `${nodeState.result.substring(0, 60)}...` : nodeState.result)
            : (JSON.stringify(nodeState.result).length > 60 
              ? `${JSON.stringify(nodeState.result).substring(0, 60)}...` 
              : JSON.stringify(nodeState.result))}
        </div>
      )}
      
      {nodeState?.error && (
        <div className="text-xs text-red-500 mt-1 truncate">
          {nodeState.error}
        </div>
      )}
    </div>
  );
}; 