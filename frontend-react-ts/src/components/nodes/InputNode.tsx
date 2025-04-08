import React, { useCallback } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { InputNodeData } from '../../types/nodes';
import NodeErrorBoundary from './NodeErrorBoundary';
import { NodeHeader } from './shared/NodeHeader';
import { NodeBody } from './shared/NodeBody';
import { NodeFooter } from './shared/NodeFooter';
import clsx from 'clsx';
import { executeFlow, useNodeState } from '../../store/flowExecutionStore';
import { useInputNodeData } from '../../hooks/useInputNodeData';
import { InputTextManager } from '../input/InputTextManager';
import { InputFileUploader } from '../input/InputFileUploader';
import { InputItemList } from '../input/InputItemList';
import { InputSummaryBar } from '../input/InputSummaryBar';
import { InputModeToggle } from '../input/InputModeToggle';

const InputNode: React.FC<NodeProps<InputNodeData>> = ({ id, data, selected }) => {
  // Get node execution state
  const nodeState = useNodeState(id);
  const isRunning = nodeState.status === 'running';

  // Use shared input node hook for state and handlers
  const {
    textBuffer,
    itemCounts,
    formattedItems,
    showIterateOption,
    iterateEachRow,
    handleTextChange,
    handleAddText,
    handleFileChange,
    handleDeleteItem,
    handleClearItems,
    handleToggleProcessingMode,
    handleConfigChange
  } = useInputNodeData({ nodeId: id });

  const handleLabelUpdate = useCallback((newLabel: string) => {
    handleConfigChange({ label: newLabel });
  }, [handleConfigChange]);

  // Add handler for running the input node
  const handleRunNode = useCallback(() => {
    executeFlow(id);
  }, [id]);
  
  // Create a footer summary for display
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
      <div className={clsx("relative flex flex-col rounded-lg border bg-white shadow-lg", selected ? 'border-blue-500' : 'border-gray-300', 'w-[350px]')}>
        <NodeHeader 
          nodeId={id} 
          label={data.label || 'Input'} 
          placeholderLabel="Input Node"
          isRootNode={true}
          isRunning={isRunning}
          viewMode="expanded"
          themeColor="gray"
          onRun={handleRunNode}
          onLabelUpdate={handleLabelUpdate}
          onToggleView={() => {}}
        />
        <Handle 
          type="source" 
          position={Position.Right} 
          id="output"
          className="w-3 h-3 !bg-gray-500"
          style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', right: '-6px', zIndex: 50 }}
        />
        <NodeBody>
          {/* Processing Mode toggle button */}
          <div className="mb-3">
            <InputModeToggle 
              iterateEachRow={iterateEachRow}
              onToggle={handleToggleProcessingMode}
              layout="column"
              showDescription={true}
            />
          </div>

          {/* Combined input section */}
          <div className="flex-grow space-y-3">
            {/* Text input */}
            <InputTextManager
              textBuffer={textBuffer}
              onChange={handleTextChange}
              onAdd={handleAddText}
            />
            
            {/* File input */}
            <InputFileUploader
              onUpload={handleFileChange}
              nodeId={id}
            />
            
            {/* Items Summary */}
            <InputSummaryBar
              itemCounts={itemCounts}
              iterateEachRow={iterateEachRow}
            />
            
            {/* Item List Display */}
            <InputItemList
              items={formattedItems}
              onDelete={handleDeleteItem}
              onClear={handleClearItems}
              limit={3}
              totalCount={data.items?.length || 0}
            />
          </div>
        </NodeBody>
        <NodeFooter>
          {footerSummary && (
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-gray-500">{footerSummary}</span>
              <span className="text-xs rounded bg-gray-100 px-2 py-0.5 text-gray-700">
                {iterateEachRow ? 'Foreach mode' : 'Batch mode'}
              </span>
            </div>
          )}
        </NodeFooter>
      </div>
    </NodeErrorBoundary>
  );
};

export default InputNode; 