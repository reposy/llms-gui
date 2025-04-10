import React, { useState, useEffect } from 'react';
import { Handle, Position } from 'reactflow';
import { MergerNodeData } from '../../types/nodes';
import clsx from 'clsx';
import { NodeHeader } from './shared/NodeHeader';
import { NodeBody } from './shared/NodeBody';
import { NodeFooter } from './shared/NodeFooter';
import { useFlowStructureStore } from '../../store/useFlowStructureStore';
import { AdjustmentsHorizontalIcon } from '@heroicons/react/24/outline';
import { useNodeState } from '../../store/flowExecutionStore';
import { createCompactJsonPreview, createRowByRowPreview, hasMoreItems } from '../../utils/previewUtils';

// Type for props
interface MergerNodeProps {
  id: string;
  data: MergerNodeData;
  isConnectable: boolean;
  selected?: boolean;
}

const MAX_HANDLES = 6; // Maximum number of input handles to display
const MAX_PREVIEW_ITEMS = 20; // Maximum number of rows to display in the preview

const MergerNode: React.FC<MergerNodeProps> = ({ id, data, isConnectable, selected }) => {
  const { setSelectedNodeId } = useFlowStructureStore(state => ({
    setSelectedNodeId: state.setSelectedNodeId
  }));
  
  // Get node execution state to show results
  const nodeState = useNodeState(id);
  const result = nodeState?.result;
  
  // Sync these values only for display purposes
  const [mergeMode, setMergeMode] = useState<'concat' | 'join' | 'object'>(
    data.mergeMode || 'concat'
  );
  const [joinSeparator, setJoinSeparator] = useState<string>(
    data.joinSeparator || ' '
  );
  
  // Update state when props change
  useEffect(() => {
    if (data.mergeMode) setMergeMode(data.mergeMode);
    if (data.joinSeparator) setJoinSeparator(data.joinSeparator);
  }, [data]);

  // Open the config sidebar when the settings button is clicked
  const openConfigSidebar = () => {
    setSelectedNodeId(id);
  };

  // Generate settings summary text
  const getModeSummary = () => {
    if (mergeMode === 'concat') return 'Array concat';
    if (mergeMode === 'join') return `Join with "${joinSeparator}"`;
    if (mergeMode === 'object') return 'Create object';
    return 'Unknown mode';
  };

  // Generate previews for the result
  const jsonPreview = createCompactJsonPreview(result, 3);
  const rowItems = createRowByRowPreview(result, MAX_PREVIEW_ITEMS);
  const hasMoreRows = hasMoreItems(result, MAX_PREVIEW_ITEMS);
  
  // Get full JSON for tooltip
  const fullJson = result ? JSON.stringify(result, null, 2) : '';

  return (
    <div className={clsx(
      "relative flex flex-col rounded-lg border bg-white shadow-lg",
      selected ? 'border-indigo-500' : 'border-indigo-200',
      'w-[300px]'
    )}>
      {/* Input handles - dynamically create based on connections */}
      {Array.from({ length: MAX_HANDLES }).map((_, i) => (
        <Handle
          key={`input-${i}`}
          type="target"
          position={Position.Left}
          id={`${id}-target-${i+1}`}
          style={{ 
            top: `${((i + 1) / (MAX_HANDLES + 1)) * 100}%`, 
            background: '#6366F1', 
            borderColor: '#4F46E5' 
          }}
          isConnectable={isConnectable}
        />
      ))}
      
      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        id={`${id}-source`}
        style={{ top: '50%', background: '#6366F1', borderColor: '#4F46E5' }}
        isConnectable={isConnectable}
      />
      
      <NodeHeader 
        nodeId={id} 
        label={data.label || 'Merger'} 
        placeholderLabel="Merger Node"
        isRootNode={false}
        isRunning={false}
        viewMode="expanded"
        themeColor="purple"
        onRun={() => {}}
        onLabelUpdate={(newLabel) => {}}
        onToggleView={() => {}}
      />
      
      <NodeBody>
        <div className="flex flex-col space-y-2 p-2 w-full">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-sm font-medium text-indigo-700">{getModeSummary()}</div>
              <div className="text-xs text-gray-600">Auto-flattening enabled</div>
            </div>
            <button 
              onClick={openConfigSidebar}
              className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
              title="Open merger settings"
            >
              <AdjustmentsHorizontalIcon className="h-5 w-5" />
            </button>
          </div>
          
          {/* Execution description */}
          <div className="text-xs text-gray-500 italic mt-1">
            {mergeMode === 'concat' && 'Combines inputs into a single array'}
            {mergeMode === 'join' && 'Joins text with separator'}
            {mergeMode === 'object' && 'Creates object with named properties'}
          </div>
          
          {/* Result preview sections */}
          {nodeState?.status === 'success' && result && (
            <div className="mt-2 border-t pt-2 space-y-2">
              {/* JSON Preview */}
              <div>
                <div className="text-xs font-medium text-gray-700">Preview:</div>
                <div 
                  className="text-xs font-mono bg-gray-50 p-1 rounded overflow-hidden overflow-ellipsis whitespace-nowrap cursor-help"
                  title={fullJson.length > 500 ? fullJson.substring(0, 500) + '...' : fullJson}
                >
                  {jsonPreview}
                </div>
              </div>
              
              {/* Row-by-row preview */}
              {Array.isArray(result) && result.length > 0 && (
                <div>
                  <div className="flex justify-between">
                    <div className="text-xs font-medium text-gray-700">Rows:</div>
                    {hasMoreRows && (
                      <span className="text-xs text-gray-500">
                        {result.length} total
                      </span>
                    )}
                  </div>
                  <div className="max-h-32 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent text-xs font-mono bg-gray-50 p-1 rounded">
                    {rowItems.map((row, index) => (
                      <div 
                        key={`row-${index}`} 
                        className="truncate hover:text-indigo-600 hover:bg-gray-100 rounded px-1 py-0.5"
                        title={row}
                      >
                        {row}
                      </div>
                    ))}
                    {hasMoreRows && (
                      <div className="text-xs text-gray-500 italic border-t border-gray-200 pt-1 mt-1">
                        {result.length - MAX_PREVIEW_ITEMS} more items...
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </NodeBody>
      
      <NodeFooter>
        <div className="flex items-center justify-between w-full">
          <span className="text-xs text-gray-500">
            Merges inputs with auto-flattening
          </span>
          {nodeState?.status === 'success' && Array.isArray(result) && (
            <span className="text-xs text-indigo-600 font-medium">
              {result.length} {result.length === 1 ? 'item' : 'items'}
            </span>
          )}
        </div>
      </NodeFooter>
    </div>
  );
};

export default MergerNode; 