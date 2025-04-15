import React from 'react';
import { Handle, Position, NodeProps, useReactFlow } from 'reactflow';
import clsx from 'clsx';

// Inline type definitions
interface JSONExtractorNodeData {
  label?: string;
  path?: string;
}

interface NodeState {
  status?: 'idle' | 'running' | 'success' | 'error';
  output?: any;
}

const JSONExtractorNode: React.FC<NodeProps<JSONExtractorNodeData>> = ({ id, data, selected, isConnectable }) => {
  // Simplified state management
  const { setNodes } = useReactFlow();
  const nodeState: NodeState = { status: 'idle' };
  const isRunning = nodeState?.status === 'running';
  const isInViewMode = false;
  const isPreviewMode = false;

  // Simplified path and label handling
  const path = data.path || '';
  const label = data.label || 'JSON Extractor';

  // Simplified run handler
  const handleRun = () => {
    if (!isRunning) {
      console.log(`[JSONExtractorNode] Starting execution for node ${id}`);
      
      try {
        console.log(`[JSONExtractorNode] Executing node ${id}`);
        // Add your JSON extraction logic here
      } catch (error: unknown) {
        console.error(`[JSONExtractorNode] Error executing node ${id}:`, error);
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
      data-testid={`json-extractor-node-${id}`}
    >
      {/* Header */}
      <div
        className={clsx(
          'flex items-center justify-between',
          'bg-blue-50 p-2 rounded-t-md',
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
              'bg-blue-100 text-blue-700 hover:bg-blue-200',
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
        <div className="mb-1 text-xs font-medium text-gray-500">JSON Path</div>
        <div className="flex items-center">
          <input
            type="text"
            value={path}
            readOnly={isInViewMode || isPreviewMode}
            onChange={(e) => {
              // Example update function
              setNodes((nodes) => 
                nodes.map((node) => {
                  if (node.id === id) {
                    return {
                      ...node,
                      data: { 
                        ...node.data, 
                        path: e.target.value 
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
              'focus:outline-none focus:ring-1 focus:ring-blue-500',
              isInViewMode || isPreviewMode ? 'bg-gray-50' : 'bg-white'
            )}
            placeholder="$.data.items[0].name"
          />
        </div>
      </div>

      {/* Output Preview - only show in certain modes */}
      {(isPreviewMode || nodeState?.status === 'success') && nodeState?.output && (
        <div className="p-3 border-t border-gray-200 bg-gray-50 rounded-b-lg">
          <div className="mb-1 text-xs font-medium text-gray-500">Output Preview</div>
          <div className="overflow-auto max-h-24 text-xs p-1 bg-white border rounded">
            <pre>{JSON.stringify(nodeState.output, null, 2)}</pre>
          </div>
        </div>
      )}

      {/* Handles */}
      <Handle
        type="target"
        position={Position.Left}
        id="json-input"
        className="!w-3 !h-3 !bg-blue-400 !border-2 !border-white"
        isConnectable={isConnectable && !isInViewMode}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="extracted-output"
        className="!w-3 !h-3 !bg-blue-400 !border-2 !border-white"
        isConnectable={isConnectable && !isInViewMode}
      />
    </div>
  );
};

export default JSONExtractorNode; 