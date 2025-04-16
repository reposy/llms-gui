import React, { useCallback, useState, useEffect, useMemo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { InputNodeData } from '../../types/nodes';
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

export const InputNode: React.FC<NodeProps<InputNodeData>> = ({ id, data, selected }) => {
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
    registerAllNodeTypes(nodeFactory);
    
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
      <div className={clsx("relative flex flex-col rounded-lg border bg-white shadow-lg", selected ? 'border-blue-500' : 'border-gray-300', 'w-[350px]')}>
        <NodeHeader 
          nodeId={id} 
          label={data.label || 'Input'} 
          placeholderLabel="Input Node"
          isRootNode={true}
          isRunning={isRunning}
          viewMode="expanded"
          themeColor="gray"
          onRun={handleRun}
          onLabelUpdate={handleLabelUpdate}
          onToggleView={() => {}}
        />
        <Handle 
          type="source" 
          position={Position.Right} 
          id="source"
          className="w-3 h-3 !bg-gray-500"
          style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', right: '-6px', zIndex: 50 }}
        />
        <NodeBody>
          {/* Processing Mode toggle button */}
          <div className="mb-3">
            <InputModeToggle 
              iterateEachRow={iterateEachRow}
              onToggle={handleToggleProcessingMode}
            />
          </div>

          {/* Combined input section */}
          <div className="flex-grow space-y-3">
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

// Add these utility functions and hooks to replace the removed functionality

/**
 * Calculate item counts for display
 */
const useItemCounts = (items: string[]) => {
  return useMemo(() => {
    // File count is determined by file extensions
    const fileCount = items.filter(item => {
      return typeof item === 'string' && 
        /\.(jpg|jpeg|png|gif|bmp|txt|pdf|doc|docx)$/i.test(item);
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
const useFormattedItems = (items: string[]) => {
  return useMemo(() => {
    return items.map((item) => {
      // Add file icon for file paths
      if (typeof item === 'string' && 
          /\.(jpg|jpeg|png|gif|bmp|txt|pdf|doc|docx)$/i.test(item)) {
        return `📄 ${item}`;
      }
      return item;
    });
  }, [items]);
};

export default InputNode; 