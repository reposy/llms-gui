import React from 'react';
import { Handle, Position, NodeProps, useReactFlow } from 'reactflow';
import clsx from 'clsx';

// Inline type definitions
interface AINodeData {
  label?: string;
  prompt?: string;
  model?: string;
}

interface NodeState {
  status?: 'idle' | 'running' | 'success' | 'error';
  output?: any;
}

const AINode: React.FC<NodeProps<AINodeData>> = ({ id, data, selected, isConnectable }) => {
  // Simplified state management
  const { setNodes } = useReactFlow();
  const nodeState: NodeState = { status: 'idle' };
  const isRunning = nodeState?.status === 'running';
  const isInViewMode = false;
  const isPreviewMode = false;

  // Simplified prompt and label handling
  const prompt = data.prompt || '';
  const label = data.label || 'AI';
  const model = data.model || 'gpt-3.5-turbo';

  // Simplified run handler
  const handleRun = () => {
    if (!isRunning) {
      console.log(`[AINode] Starting execution for node ${id}`);
      
      try {
        console.log(`[AINode] Executing node ${id}`);
        // AI processing logic would go here
        // In a real implementation, this would call an API
      } catch (error: unknown) {
        console.error(`[AINode] Error executing node ${id}:`, error);
      }
    }
  };

  return (
    <div
      className={clsx(
        'relative',
        'bg-white shadow-lg rounded-lg border-2',
        selected ? 'border-blue-500' : 'border-gray-200',
        'transition-colors duration-200',
        'w-60'
      )}
      data-testid={`ai-node-${id}`}
    >
      {/* Header */}
      <div
        className={clsx(
          'flex items-center justify-between',
          'bg-purple-50 p-2 rounded-t-md',
          'border-b border-gray-200'
        )}
      >
        <div className="flex items-center">
          <div
            className={clsx(
              'rounded-full w-2 h-2 mr-2',
              nodeState?.status === 'success' && 'bg-green-500',
              nodeState?.status === 'error' && 'bg-red-500',
              nodeState?.status === 'running' && 'bg-yellow-500',
              (!nodeState?.status || nodeState.status === 'idle') && 'bg-gray-300'
            )}
          />
          <span className="font-medium text-sm">{label}</span>
        </div>
        
        {!isInViewMode && (
          <button
            onClick={handleRun}
            disabled={isRunning}
            className={clsx(
              'px-2 py-1 text-xs rounded transition-colors',
              'bg-purple-100 text-purple-700 hover:bg-purple-200',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
            title="Execute node"
          >
            {isRunning ? '⏳' : '▶'}
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-3">
        {/* Model Selection */}
        <div className="mb-3">
          <div className="mb-1 text-xs font-medium text-gray-500">Model</div>
          <select
            value={model}
            disabled={isInViewMode || isPreviewMode}
            onChange={(e) => {
              setNodes((nodes) => 
                nodes.map((node) => {
                  if (node.id === id) {
                    return {
                      ...node,
                      data: { 
                        ...node.data, 
                        model: e.target.value 
                      }
                    };
                  }
                  return node;
                })
              );
            }}
            className={clsx(
              'w-full px-2 py-1 text-sm',
              'border rounded',
              'focus:outline-none focus:ring-1 focus:ring-purple-500',
              isInViewMode || isPreviewMode ? 'bg-gray-50' : 'bg-white'
            )}
          >
            <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
            <option value="gpt-4">GPT-4</option>
            <option value="claude-3-opus">Claude 3 Opus</option>
          </select>
        </div>

        {/* Prompt */}
        <div className="mb-1 text-xs font-medium text-gray-500">Prompt</div>
        <div className="flex items-center">
          <textarea
            value={prompt}
            readOnly={isInViewMode || isPreviewMode}
            onChange={(e) => {
              setNodes((nodes) => 
                nodes.map((node) => {
                  if (node.id === id) {
                    return {
                      ...node,
                      data: { 
                        ...node.data, 
                        prompt: e.target.value 
                      }
                    };
                  }
                  return node;
                })
              );
            }}
            className={clsx(
              'w-full px-2 py-1 text-sm',
              'border rounded',
              'focus:outline-none focus:ring-1 focus:ring-purple-500',
              isInViewMode || isPreviewMode ? 'bg-gray-50' : 'bg-white',
              'min-h-[80px] resize-y'
            )}
            placeholder="Enter your prompt here..."
          />
        </div>
      </div>

      {/* Output Preview - only show in certain modes */}
      {(isPreviewMode || nodeState?.status === 'success') && nodeState?.output && (
        <div className="p-3 border-t border-gray-200 bg-gray-50 rounded-b-lg">
          <div className="mb-1 text-xs font-medium text-gray-500">Output Preview</div>
          <div className="overflow-auto max-h-24 text-xs p-1 bg-white border rounded">
            <pre>{typeof nodeState.output === 'string' ? nodeState.output : JSON.stringify(nodeState.output, null, 2)}</pre>
          </div>
        </div>
      )}

      {/* Handles */}
      <Handle
        type="target"
        position={Position.Left}
        id="ai-input"
        className="!w-3 !h-3 !bg-purple-400 !border-2 !border-white"
        isConnectable={isConnectable && !isInViewMode}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="ai-output"
        className="!w-3 !h-3 !bg-purple-400 !border-2 !border-white"
        isConnectable={isConnectable && !isInViewMode}
      />
    </div>
  );
};

export default AINode; 