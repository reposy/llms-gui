// src/components/nodes/InputNode.tsx
import React, { useCallback, useEffect, useMemo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { InputNodeData } from '../../types/nodes';
import clsx from 'clsx';
import NodeErrorBoundary from './NodeErrorBoundary';
import { NodeHeader } from './shared/NodeHeader';
import { useNodeState } from '../../store/useNodeStateStore';
import { useInputNodeData } from '../../hooks/useInputNodeData';
import { InputItemList } from '../input/InputItemList';
import { InputModeToggle } from '../input/InputModeToggle';
import { useFlowStructureStore, setNodes } from '../../store/useFlowStructureStore';
import { FlowExecutionContext } from '../../core/FlowExecutionContext';
import { NodeFactory } from '../../core/NodeFactory';
import { registerAllNodeTypes } from '../../core/NodeRegistry';
import { buildExecutionGraphFromFlow, getExecutionGraph } from '../../store/useExecutionGraphStore';
import { useNodeContentStore } from '../../store/useNodeContentStore';
import { useNodeConnections } from '../../hooks/useNodeConnections';
import { VIEW_MODES } from '../../store/viewModeStore';
import { v4 as uuidv4 } from 'uuid';
import { TrashIcon } from '@heroicons/react/20/solid';
import { FiFile, FiType } from 'react-icons/fi';

// Helper to format raw data into displayable item structure
const formatItemsForDisplay = (rawItems: (string | File)[], itemType: 'chaining' | 'common' | 'element') => {
  if (!rawItems) return [];
  
  return rawItems.map((item, index) => {
    const id = `${itemType}-${index}-${typeof item === 'string' ? 'text' : item.name}`;
    let display = '';
    let fullContent = '';
    const isFile = typeof item !== 'string';
    let fileType = 'text';

    if (isFile) {
      const file = item as File;
      display = file.name || 'Unnamed file';
      fullContent = `${display} (${file.type}, ${Math.round(file.size / 1024)} KB)`;
      fileType = file.type;
    } else {
      fullContent = item as string;
      // Show first 2 lines or 50 chars for display
      const lines = fullContent.split('\n');
      if (lines.length > 2) {
        display = lines.slice(0, 2).join('\n');
      } else if (fullContent.length > 50) {
        display = fullContent.substring(0, 50);
      } else {
        display = fullContent;
      }
    }
    
    return {
      id,
      originalIndex: index,
      display,
      fullContent,
      type: fileType,
      isFile,
      isEditing: false // Default, will be handled by hook state
    };
  });
};

// Node component
export const InputNode: React.FC<NodeProps> = ({ id, data, selected, isConnectable = true }) => {
  const inputData = data as InputNodeData;
  const nodeState = useNodeState(id);
  const isRunning = nodeState.status === 'running';
  const { nodes, edges } = useFlowStructureStore();
  const setZustandNodeContent = useNodeContentStore(state => state.setNodeContent);
  const { incomingConnections } = useNodeConnections(id);
  const isRootNode = incomingConnections.length === 0;
  const currentNodes = useFlowStructureStore(state => state.nodes); 

  // Use the consolidated input node hook with all functionalities
  const {
    chainingItems,
    commonItems,
    items,
    textBuffer,
    iterateEachRow,
    chainingUpdateMode,
    editingItemId,
    editingText,
    handleTextChange,
    handleAddText,
    handleFileChange,
    handleDeleteItem,
    handleClearItems,
    handleToggleProcessingMode,
    handleUpdateChainingMode: handleChainingModeChange,
    handleMoveChainingItem,
    handleStartEditingTextItem,
    handleEditingTextChange,
    handleFinishEditingTextItem,
    handleCancelEditingTextItem,
  } = useInputNodeData({ nodeId: id });
  
  // Format items for display
  const formattedChainingItems = useMemo(() => formatItemsForDisplay(chainingItems, 'chaining'), [chainingItems]);
  const formattedCommonItems = useMemo(() => formatItemsForDisplay(commonItems, 'common'), [commonItems]);
  const formattedItems = useMemo(() => formatItemsForDisplay(items, 'element'), [items]);

  // Label update handler
  const handleLabelUpdate = useCallback((updatedNodeId: string, newLabel: string) => {
    setZustandNodeContent(updatedNodeId, { label: newLabel });
    const updatedNodes = currentNodes.map(node => 
      node.id === updatedNodeId ? { ...node, data: { ...node.data, label: newLabel } } : node
    );
    setNodes(updatedNodes);
  }, [currentNodes, setZustandNodeContent, setNodes]);

  // Run handler
  const handleRun = useCallback(() => {
    const executionId = `exec-${uuidv4()}`;
    const executionContext = new FlowExecutionContext(executionId);
    executionContext.setTriggerNode(id);
    buildExecutionGraphFromFlow(nodes, edges);
    const executionGraph = getExecutionGraph();
    const nodeFactory = new NodeFactory();
    registerAllNodeTypes();
    const node = nodes.find(n => n.id === id);
    if (!node) return;
    const nodeInstance = nodeFactory.create(id, node.type as string, node.data, executionContext);
    nodeInstance.property = { ...nodeInstance.property, nodes, edges, nodeFactory, executionGraph };
    nodeInstance.process({}).catch(error => console.error(`[InputNode] Error:`, error));
  }, [id, nodes, edges]);

  // Prevent keydown events from bubbling up to React Flow
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
  }, []);

  // Render preview items for node body
  const renderPreviewList = (previewItems: any[], type: 'chaining' | 'common' | 'element') => (
    <ul className="text-xs list-disc list-inside pl-1">
      {previewItems.slice(0, 2).map((item, idx) => (
        <li key={`${type}-preview-${idx}`} className="truncate text-gray-600">
           {item.isFile ? `📄 ${item.display}` : `# ${item.display}`}
        </li>
      ))}
      {previewItems.length > 2 && <li className="text-gray-400">... (+{previewItems.length - 2} more)</li>}
    </ul>
  );

  return (
    <NodeErrorBoundary nodeId={id}>
      <div className="relative w-[350px]">
        {/* Target Handle (Left) */}
        <Handle 
          type="target" 
          position={Position.Left} 
          id="target" 
          isConnectable={isConnectable} 
          style={{ background: '#6b7280', border: '1px solid white', width: '8px', height: '8px', top: '50%', transform: 'translateY(-50%)', left: '-4px', zIndex: 50 }} 
        />

        {/* Source Handle (Right) */}
        <Handle 
          type="source" 
          position={Position.Right} 
          id="source" 
          isConnectable={isConnectable} 
          style={{ background: '#6b7280', border: '1px solid white', width: '8px', height: '8px', top: '50%', transform: 'translateY(-50%)', right: '-4px', zIndex: 50 }} 
        />

        {/* Node Body */}
        <div className={clsx('px-4 py-2 shadow-md rounded-md bg-white border', selected ? 'border-blue-500 ring-2 ring-blue-300 ring-offset-1 shadow-lg' : 'border-gray-200 shadow-sm')}>
          {/* Node Header */} 
          <NodeHeader 
             nodeId={id} 
             label={inputData.label || 'Input'} 
             placeholderLabel="Input"
             isRootNode={isRootNode}
             isRunning={isRunning}
             viewMode={VIEW_MODES.EXPANDED} // Input node usually expanded
             themeColor="gray"
             onRun={handleRun}
             onLabelUpdate={handleLabelUpdate} 
             onToggleView={() => { /* Input node doesn't toggle view */ }}
          />

          {/* Node Content */} 
          <div className="flex flex-col space-y-3 mt-2">
            {/* Mode Toggles */} 
            <InputModeToggle 
              iterateEachRow={iterateEachRow}
              chainingUpdateMode={chainingUpdateMode}
              onToggleProcessingMode={handleToggleProcessingMode}
              onUpdateChainingMode={handleChainingModeChange}
            />
            
            {/* Manual Text Input */}
            <div className="px-4 py-2 border-t border-gray-200">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                텍스트 추가:
              </label>
              <div className="flex items-center space-x-2">
                <textarea
                  value={textBuffer}
                  onChange={handleTextChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Enter text..."
                  className="nodrag nowheel flex-grow p-2 border border-gray-300 rounded text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                  rows={3}
                />
                <div className="flex flex-col space-y-1">
                  <button
                    onClick={() => handleAddText('common')}
                    disabled={!textBuffer.trim()}
                    className={`px-2 py-1 text-xs font-medium rounded ${!textBuffer.trim() ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-purple-100 text-purple-800 hover:bg-purple-200'}`}
                  >공통</button>
                  <button
                    onClick={() => handleAddText('element')}
                    disabled={!textBuffer.trim()}
                    className={`px-2 py-1 text-xs font-medium rounded ${!textBuffer.trim() ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-100 text-orange-800 hover:bg-orange-200'}`}
                  >개별</button>
                </div>
              </div>
            </div>
            
            {/* File Input Area */} 
            <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-gray-700">파일 추가:</label>
                <div className="flex space-x-1">
                  <label className={`px-2 py-1 text-xs font-medium rounded cursor-pointer bg-purple-100 text-purple-800 hover:bg-purple-200`}>공통<input type="file" className="hidden" onChange={(e) => handleFileChange(e, 'common')} multiple /></label>
                  <label className={`px-2 py-1 text-xs font-medium rounded cursor-pointer bg-orange-100 text-orange-800 hover:bg-orange-200`}>개별<input type="file" className="hidden" onChange={(e) => handleFileChange(e, 'element')} multiple /></label>
                </div>
            </div>
            
            {/* Item Previews in Node Body */} 
            <div className="space-y-2 border-t pt-2 mt-2">
              {formattedChainingItems.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-gray-500 flex justify-between items-center">
                    <span>Chaining Items ({formattedChainingItems.length})</span>
                    <button onClick={() => handleClearItems('chaining')} className="p-0.5 text-gray-400 hover:text-red-500" title="Clear Chaining Items"><TrashIcon className="h-3 w-3"/></button>
                  </div>
                  {renderPreviewList(formattedChainingItems, 'chaining')}
                </div>
              )}
               {formattedCommonItems.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-purple-700 flex justify-between items-center">
                    <span>Common Items ({formattedCommonItems.length})</span>
                     <button onClick={() => handleClearItems('common')} className="p-0.5 text-purple-400 hover:text-red-500" title="Clear Common Items"><TrashIcon className="h-3 w-3"/></button>
                  </div>
                  {renderPreviewList(formattedCommonItems, 'common')}
                </div>
              )}
              {formattedItems.length > 0 && (
                <div>
                   <div className="text-xs font-medium text-orange-700 flex justify-between items-center">
                     <span>Individual Items ({formattedItems.length})</span>
                     <button onClick={() => handleClearItems('element')} className="p-0.5 text-orange-400 hover:text-red-500" title="Clear Individual Items"><TrashIcon className="h-3 w-3"/></button>
                  </div>
                  {renderPreviewList(formattedItems, 'element')}
                </div>
              )}
              {formattedChainingItems.length === 0 && formattedCommonItems.length === 0 && formattedItems.length === 0 && (
                 <div className="text-xs text-center text-gray-400 py-2">No items added</div>
              )}
               {(formattedChainingItems.length > 0 || formattedCommonItems.length > 0 || formattedItems.length > 0) && (
                 <div className="text-right mt-1">
                     <button onClick={() => handleClearItems('all')} className="text-xs text-red-500 hover:text-red-700">Clear All Items</button>
                 </div>
               )}
            </div>

            {/* Note: The full item list (InputItemList) is intended for the sidebar */}
            {/* We pass necessary props here if needed, but rendering is likely in a sidebar component */} 
            {/* Example of passing props (actual rendering might differ): */}
            {/* 
            <InputItemList 
              chainingItems={formattedChainingItems}
              commonItems={formattedCommonItems}
              items={formattedItems}
              onDeleteItem={handleDeleteItem}
              onMoveItem={handleMoveChainingItem}
              onStartEditing={handleStartEditingTextItem}
              onFinishEditing={handleFinishEditingTextItem}
              onCancelEditing={handleCancelEditingTextItem}
              onEditingTextChange={handleEditingTextChange}
              editingItemId={editingItemId}
              editingText={editingText}
              disabled={isRunning}
            />
            */}
          </div>
        </div>
      </div>
    </NodeErrorBoundary>
  );
};

export default InputNode; 