// src/components/nodes/LLMNodeCompactView.tsx
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

// Temporary placeholder for isVisionModel logic (same as in LLMConfig.tsx)
// TODO: Move this to a shared utility location (e.g., src/utils/llm/)
const isVisionModel = (provider: 'ollama' | 'openai' | string, model: string): boolean => {
  console.warn('[CompactView] Vision model detection is using a placeholder!');
  if (provider === 'ollama' && model?.includes('vision')) {
      return true;
  }
  if (provider === 'openai' && model?.startsWith('gpt-4-vision')) {
      return true;
  }
  // Add more robust checks based on known model identifiers
  return false;
};

export const LLMNodeCompactView: React.FC<LLMNodeCompactViewProps> = ({
  id,
  data,
  nodeState,
  viewMode,
  onToggleView
}) => {
  // Use the LLM data hook to get content
  const { prompt, model, provider, mode, label } = useLlmNodeData({ nodeId: id });

  // Use the local placeholder function
  const supportsVision = model && isVisionModel(provider, model);

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
        <div className="flex-1 text-sm font-medium truncate">
          {label || data.label || 'LLM Node'}
        </div>
        <NodeStatusIndicator status={nodeStatus} />
      </div>
      
      <div className="flex items-center text-xs text-gray-600">
        <div className="flex-1 truncate flex items-center gap-1">
          {model || data.model || 'No model set'}
          {/* Vision badge */}
          {supportsVision && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
              {mode === 'vision' ? '🖼️ Vision' : '🖼️'}
            </span>
          )}
        </div>
        <div className="text-xs text-gray-500">
          {provider || data.provider}
        </div>
      </div>
      
      <div 
        className="text-xs text-gray-600"
      >
        {truncatedPrompt || 'No prompt set'}
      </div>
      
      {/* Display a result preview when execution is successful */}
      {nodeState?.status === 'success' && nodeState.result && (
        <div className="text-xs text-green-600 truncate">
          Result: {typeof nodeState.result === 'string' 
            ? nodeState.result.substring(0, 40) + (nodeState.result.length > 40 ? '...' : '')
            : JSON.stringify(nodeState.result).substring(0, 40) + '...'}
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