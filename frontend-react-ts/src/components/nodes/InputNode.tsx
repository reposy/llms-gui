import React, { useCallback, useState, useEffect, useMemo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { InputNodeData, FileLikeObject } from '../../types/nodes';
import clsx from 'clsx';
import NodeErrorBoundary from './NodeErrorBoundary';
import { NodeHeader } from './shared/NodeHeader';
import { NodeBody } from './shared/NodeBody';
import { NodeFooter } from './shared/NodeFooter';
import { useNodeState } from '../../store/useNodeStateStore';
import { useInputNodeData } from '../../hooks/useInputNodeData';
import { InputTextManagerSidebar } from '../input/InputTextManagerSidebar';
import { InputFileUploader } from '../input/InputFileUploader';
import { InputItemList } from '../input/InputItemList';
import { InputSummaryBar } from '../input/InputSummaryBar';
import { InputModeToggle } from '../input/InputModeToggle';
import { useFlowStructureStore } from '../../store/useFlowStructureStore';
import { v4 as uuidv4 } from 'uuid';
import { FlowExecutionContext } from '../../core/FlowExecutionContext';
import { NodeFactory } from '../../core/NodeFactory';
import { registerAllNodeTypes } from '../../core/NodeRegistry';
import { buildExecutionGraphFromFlow, getExecutionGraph } from '../../store/useExecutionGraphStore';
import { useNodeContentStore } from '../../store/useNodeContentStore';

// Utility function to calculate item counts (moved from deleted hook)
const calculateItemCounts = (items: (string | FileLikeObject)[]) => {
  if (!items) return { fileCount: 0, textCount: 0, total: 0 };
  
  const fileCount = items.filter(item => typeof item !== 'string').length;
  const textCount = items.filter(item => typeof item === 'string').length;
  
  return {
    fileCount,
    textCount,
    total: items.length
  };
};

// Utility function to format items for display (moved from deleted hook)
const formatItemsForDisplay = (items: (string | FileLikeObject)[]) => {
  if (!items) return [];
  
  return items.map((item, index) => {
    if (typeof item === 'string') {
      return {
        id: `item-${index}`,
        index,
        display: item,
        type: 'text',
        isFile: false,
        originalItem: item
      };
    } else {
      return {
        id: `file-${index}`,
        index,
        display: item.file || 'Unnamed file',
        type: item.type,
        isFile: true,
        originalItem: item
      };
    }
  });
};

export const InputNode: React.FC<NodeProps<InputNodeData>> = ({ id, data, selected, isConnectable = true }) => {
  // Get node execution state
  const nodeState = useNodeState(id);
  const isRunning = nodeState.status === 'running';
  
  // Get flow structure
  const { nodes, edges } = useFlowStructureStore();
  const setNodeContent = useNodeContentStore(state => state.setNodeContent);

  // Use the consolidated input node hook
  const {
    items,
    textBuffer,
    iterateEachRow,
    handleTextChange,
    handleAddText,
    handleFileChange,
    handleDeleteItem,
    handleClearItems,
    handleToggleProcessingMode,
  } = useInputNodeData({ nodeId: id });
  
  // Calculate derived UI state using useMemo
  const itemCounts = useMemo(() => calculateItemCounts(items), [items]);
  const formattedItems = useMemo(() => formatItemsForDisplay(items), [items]);
  const showIterateOption = items.length > 1;

  // Handle label update via NodeHeader (or similar component)
  const handleLabelUpdate = useCallback((newLabel: string) => {
    // Use setNodeContent directly as the consolidated hook doesn't expose it by default
    setNodeContent(id, { label: newLabel }); 
  }, [id, setNodeContent]);

  // Handle running the input node
  const handleRun = useCallback(() => {
    // Create execution context
    const executionId = `exec-${uuidv4()}`;
    const executionContext = new FlowExecutionContext(executionId);
    
    // Set trigger node
    executionContext.setTriggerNode(id);
    
    console.log(`[InputNode] Starting execution for node ${id}`);
    
    // Build execution graph
    buildExecutionGraphFromFlow(nodes, edges);
    const executionGraph = getExecutionGraph();
    
    // Create node factory
    const nodeFactory = new NodeFactory();
    registerAllNodeTypes();
    
    // Find the node data
    const node = nodes.find(n => n.id === id);
    if (!node) {
      console.error(`[InputNode] Node ${id} not found.`);
      return;
    }
    
    // Create the node instance
    const nodeInstance = nodeFactory.create(
      id,
      node.type as string,
      node.data,
      executionContext
    );
    
    // Attach graph structure reference to the node property
    nodeInstance.property = {
      ...nodeInstance.property,
      nodes,
      edges,
      nodeFactory,
      executionGraph
    };
    
    // Execute the node
    nodeInstance.process({}).catch((error: Error) => {
      console.error(`[InputNode] Error executing node ${id}:`, error);
    });
  }, [id, nodes, edges]);
  
  // Create a footer summary for display
  const footerSummary = useMemo(() => {
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
      <div className="relative w-[350px]">
        {/* Source Handle - positioned at right with consistent styling */}
        <Handle 
          type="source" 
          position={Position.Right} 
          id="source"
          isConnectable={isConnectable}
          style={{
            background: '#6b7280', // gray color for input node
            border: '1px solid white',
            width: '8px',
            height: '8px',
            top: '50%',
            transform: 'translateY(-50%)',
            right: '-4px',
            zIndex: 50
          }}
        />

        {/* Node content box with consistent styling */}
        <div className={clsx(
          'px-4 py-2 shadow-md rounded-md bg-white',
          'border',
          selected
            ? 'border-blue-500 ring-2 ring-blue-300 ring-offset-1 shadow-lg'
            : 'border-gray-200 shadow-sm'
        )}>
          {/* Node Header */}
          <NodeHeader 
             nodeId={id} 
             label={data.label || 'Input'} 
             isRunning={isRunning}
             onRun={handleRun}
             onLabelUpdate={handleLabelUpdate} 
          />

          {/* Node Content */}
          <div className="flex flex-col space-y-3">
            {/* Processing Mode toggle button */}
            {showIterateOption && (
              <div className="mb-1">
                <InputModeToggle 
                  iterateEachRow={iterateEachRow}
                  onToggle={handleToggleProcessingMode}
                />
              </div>
            )}
            
            {/* Text input */}
            <InputTextManagerSidebar
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
              totalCount={itemCounts.total}
            />
          </div>

          {/* Node Footer */}
          {footerSummary && (
            <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between w-full">
              <span className="text-xs text-gray-500">{footerSummary}</span>
              <span className="text-xs rounded bg-gray-100 px-2 py-0.5 text-gray-700">
                {iterateEachRow ? 'Foreach mode' : 'Batch mode'}
              </span>
            </div>
          )}
        </div>
      </div>
    </NodeErrorBoundary>
  );
};

export default InputNode; 