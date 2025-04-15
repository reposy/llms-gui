import React from 'react';
import { Handle, Position, NodeProps, useReactFlow } from 'reactflow';
import clsx from 'clsx';
import NodeErrorBoundary from './NodeErrorBoundary';
import { NodeHeader } from './shared/NodeHeader';
import { NodeBody } from './shared/NodeBody';
import { NodeFooter } from './shared/NodeFooter';
import { InputTextManager } from './input/InputTextManager';
import { InputFileUploader } from './input/InputFileUploader';
import { InputItemList } from './input/InputItemList';
import { InputSummaryBar } from './input/InputSummaryBar';
import { InputModeToggle } from './input/InputModeToggle';
import { v4 as uuidv4 } from 'uuid';

// Inline type definitions
interface InputNodeData {
  label?: string;
  items?: InputItem[];
  iterateEachRow?: boolean;
}

interface InputItem {
  id: string;
  type: 'file' | 'text';
  name?: string;
  content?: string;
  size?: number;
}

interface NodeState {
  status?: 'idle' | 'running' | 'success' | 'error';
  output?: any;
}

interface ItemCounts {
  total: number;
  fileCount: number;
  textCount: number;
}

const InputNode: React.FC<NodeProps<InputNodeData>> = ({ id, data, selected, isConnectable }) => {
  // Simplified state management
  const { setNodes } = useReactFlow();
  const nodeState: NodeState = { status: 'idle' };
  const isRunning = nodeState?.status === 'running';
  
  // Simplified data
  const textBuffer = '';
  const label = data.label || 'Input';
  const iterateEachRow = data.iterateEachRow || false;
  const items = data.items || [];
  
  // Calculate item counts
  const itemCounts: ItemCounts = React.useMemo(() => {
    const fileItems = items.filter(item => item.type === 'file').length;
    const textItems = items.filter(item => item.type === 'text').length;
    return {
      total: items.length,
      fileCount: fileItems,
      textCount: textItems
    };
  }, [items]);

  // Simplified handlers
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    // In a real implementation, this would update a local state
  };

  const handleAddText = () => {
    if (!textBuffer.trim()) return;
    
    // Update node data with new text item
    setNodes((nodes) => 
      nodes.map((node) => {
        if (node.id === id) {
          const newItems = [...(node.data.items || []), { 
            id: `item-${Date.now()}`,
            type: 'text',
            content: textBuffer
          }];
          
          return {
            ...node,
            data: { 
              ...node.data, 
              items: newItems
            }
          };
        }
        return node;
      })
    );
  };

  const handleFileChange = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    // Update node data with new file items
    setNodes((nodes) => 
      nodes.map((node) => {
        if (node.id === id) {
          const newItems = [...(node.data.items || [])];
          
          for (let i = 0; i < files.length; i++) {
            newItems.push({
              id: `item-${Date.now()}-${i}`,
              type: 'file',
              name: files[i].name,
              size: files[i].size,
              // In a real implementation, file content would be handled differently
            });
          }
          
          return {
            ...node,
            data: { 
              ...node.data, 
              items: newItems
            }
          };
        }
        return node;
      })
    );
  };

  const handleDeleteItem = (itemId: string) => {
    // Update node data by removing the item
    setNodes((nodes) => 
      nodes.map((node) => {
        if (node.id === id) {
          return {
            ...node,
            data: { 
              ...node.data, 
              items: (node.data.items || []).filter((item: InputItem) => item.id !== itemId)
            }
          };
        }
        return node;
      })
    );
  };

  const handleClearItems = () => {
    // Update node data by clearing all items
    setNodes((nodes) => 
      nodes.map((node) => {
        if (node.id === id) {
          return {
            ...node,
            data: { 
              ...node.data, 
              items: []
            }
          };
        }
        return node;
      })
    );
  };

  const handleToggleProcessingMode = () => {
    // Toggle between batch and foreach mode
    setNodes((nodes) => 
      nodes.map((node) => {
        if (node.id === id) {
          return {
            ...node,
            data: { 
              ...node.data, 
              iterateEachRow: !(node.data.iterateEachRow || false)
            }
          };
        }
        return node;
      })
    );
  };

  // Simplified run handler
  const handleRun = () => {
    if (!isRunning) {
      console.log(`[InputNode] Starting execution for node ${id}`);
      
      try {
        console.log(`[InputNode] Executing node ${id}`);
        // Input node execution logic would go here
      } catch (error: unknown) {
        console.error(`[InputNode] Error executing node ${id}:`, error);
      }
    }
  };

  // Footer summary
  const footerSummary = React.useMemo(() => {
    if (!itemCounts.total) return null;
    
    if (itemCounts.fileCount > 0 && itemCounts.textCount > 0) {
      return `${itemCounts.fileCount} file${itemCounts.fileCount !== 1 ? 's' : ''} + ${itemCounts.textCount} text row${itemCounts.textCount !== 1 ? 's' : ''}`;
    } else if (itemCounts.fileCount > 0) {
      return `${itemCounts.fileCount} file${itemCounts.fileCount !== 1 ? 's' : ''}`;
    } else if (itemCounts.textCount > 0) {
      return `${itemCounts.textCount} text row${itemCounts.textCount !== 1 ? 's' : ''}`;
    }
    
    return null;
  }, [itemCounts]);

  return (
    <NodeErrorBoundary nodeId={id}>
      <div
        className={clsx(
          'relative',
          'bg-white shadow-lg rounded-lg border-2',
          selected ? 'border-blue-500' : 'border-gray-200',
          'transition-colors duration-200',
          'w-72'
        )}
        data-testid={`input-node-${id}`}
      >
        {/* Header */}
        <div
          className={clsx(
            'flex items-center justify-between',
            'bg-gray-50 p-2 rounded-t-md',
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
          
          <button
            onClick={handleRun}
            disabled={isRunning}
            className={clsx(
              'px-2 py-1 text-xs rounded transition-colors',
              'bg-gray-100 text-gray-700 hover:bg-gray-200',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
            title="Execute node"
          >
            {isRunning ? '⏳' : '▶'}
          </button>
        </div>

        {/* Content */}
        <div className="p-3 space-y-3">
          {/* Processing Mode Toggle */}
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-gray-700">Processing Mode:</span>
            <button
              onClick={handleToggleProcessingMode}
              className={clsx(
                'px-2 py-1 rounded text-xs font-medium',
                iterateEachRow 
                  ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              )}
            >
              {iterateEachRow ? 'Process Each Item' : 'Process As Batch'}
            </button>
          </div>

          {/* Text Input */}
          <div>
            <div className="mb-1 text-xs font-medium text-gray-500">Add Text</div>
            <div className="flex flex-col space-y-2">
              <textarea
                value={textBuffer}
                onChange={handleTextChange}
                className={clsx(
                  'w-full px-2 py-1 text-sm',
                  'border rounded',
                  'focus:outline-none focus:ring-1 focus:ring-gray-500',
                  'min-h-[60px] resize-y'
                )}
                placeholder="Enter text here..."
              />
              <button
                onClick={handleAddText}
                className={clsx(
                  'px-2 py-1 text-xs rounded transition-colors self-end',
                  'bg-gray-100 text-gray-700 hover:bg-gray-200'
                )}
              >
                Add Text
              </button>
            </div>
          </div>

          {/* File Input */}
          <div>
            <div className="mb-1 text-xs font-medium text-gray-500">Add Files</div>
            <div className="flex flex-col space-y-2">
              <input
                type="file"
                onChange={(e) => handleFileChange(e.target.files)}
                className="text-xs"
                multiple
              />
            </div>
          </div>

          {/* Items Summary */}
          {items.length > 0 && (
            <div className="flex justify-between items-center text-xs">
              <span className="font-medium text-gray-700">{items.length} item{items.length !== 1 ? 's' : ''}</span>
              <button
                onClick={handleClearItems}
                className={clsx(
                  'px-2 py-1 rounded transition-colors',
                  'bg-red-50 text-red-600 hover:bg-red-100 text-xs'
                )}
              >
                Clear All
              </button>
            </div>
          )}

          {/* Item List (Preview) */}
          <div className="items-container">
            {items.length > 0 && (
              <div className="items-preview">
                <InputItemList 
                  items={items.map((item: InputItem) => 
                    item.type === 'file' ? `📄 ${item.name || ''}` : (item.content || '')
                  )} 
                  onDelete={(index: number) => handleDeleteItem(items[index].id)}
                  showClear={items.length > 0}
                  onClear={handleClearItems}
                  limit={10}
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        {footerSummary && (
          <div className="p-2 border-t border-gray-200 bg-gray-50 rounded-b-lg">
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-gray-500">{footerSummary}</span>
              <span className="text-xs rounded bg-gray-100 px-2 py-0.5 text-gray-700">
                {iterateEachRow ? 'Foreach mode' : 'Batch mode'}
              </span>
            </div>
          </div>
        )}

        {/* Handle */}
        <Handle
          type="source"
          position={Position.Right}
          id="output"
          className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white"
          isConnectable={isConnectable}
        />
      </div>
    </NodeErrorBoundary>
  );
};

export default InputNode; 