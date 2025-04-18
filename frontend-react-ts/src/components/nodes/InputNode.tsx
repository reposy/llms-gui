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

export const InputNode: React.FC<NodeProps<InputNodeData>> = ({ id, data, selected, isConnectable = true }) => {
  // Get node execution state
  const nodeState = useNodeState(id);
  const isRunning = nodeState.status === 'running';
  
  // Get flow structure
  const { nodes, edges } = useFlowStructureStore();

  // Use shared input node hook for state and handlers
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
    setContent
  } = useInputNodeData({ nodeId: id });
  
  // Use the local hooks for the removed functionality
  const itemCounts = useItemCounts(items);
  const formattedItems = useFormattedItems(items);
  const showIterateOption = true; // This was a constant value in the original
  
  // Add a simplified handleConfigChange function
  const handleConfigChange = (updates: any) => {
    setContent(updates);
  };

  const handleLabelUpdate = useCallback((newLabel: string) => {
    handleConfigChange({ label: newLabel });
  }, [handleConfigChange]);

  // Add handler for running the input node
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

  // Fix the updateFlow function call that's causing the linter error
  const updateFlow = useCallback(() => {
    if (data.nodes && data.edges) {
      buildExecutionGraphFromFlow(data.nodes, data.edges);
    }
  }, [data.nodes, data.edges]);

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
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <button
                onClick={handleRun}
                className={clsx(
                  'relative shrink-0 px-2 py-1 text-xs font-medium rounded transition-colors',
                  'bg-gray-100 text-gray-700 hover:bg-gray-200'
                )}
                title="Run input node"
              >
                {isRunning ? '⏳' : '▶'} Run
              </button>
              <span className="font-bold text-gray-700">
                {data.label || 'Input'}
              </span>
            </div>
          </div>

          {/* Node Content */}
          <div className="flex flex-col space-y-3">
            {/* Processing Mode toggle button */}
            <div className="mb-1">
              <InputModeToggle 
                iterateEachRow={iterateEachRow}
                onToggle={handleToggleProcessingMode}
              />
            </div>
            
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
              totalCount={data.items?.length || 0}
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

// Add these utility functions and hooks to replace the removed functionality

/**
 * Calculate item counts for display
 */
const useItemCounts = (items: (string | FileLikeObject)[]) => {
  return useMemo(() => {
    // File count is determined by file extensions (for string) or by FileLikeObject type
    const fileCount = items.filter(item => {
      if (typeof item === 'string') {
        return /\.(jpg|jpeg|png|gif|bmp|txt|pdf|doc|docx)$/i.test(item);
      }
      // If FileLikeObject, treat as file
      if (item && typeof item === 'object' && 'name' in item) {
        return true;
      }
      return false;
    }).length;
    const textCount = items.length - fileCount;
    return {
      fileCount,
      textCount,
      total: items.length
    };
  }, [items]);
};

/**
 * Format items for display
 */
const useFormattedItems = (items: (string | FileLikeObject)[]) => {
  return useMemo(() => {
    return items.map((item) => {
      if (typeof item === 'string') {
        if (/\.(jpg|jpeg|png|gif|bmp|txt|pdf|doc|docx)$/i.test(item)) {
          return `📄 ${item}`;
        }
        return item;
      }
      if (item && typeof item === 'object' && 'name' in item) {
        return `📄 ${(item as any).name}`;
      }
      return '';
    });
  }, [items]);
};

export default InputNode; 