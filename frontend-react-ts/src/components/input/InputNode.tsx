import React, { useCallback, useMemo, useRef } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { InputNodeContent } from '../../types/nodes';
import clsx from 'clsx';
import NodeErrorBoundary from './NodeErrorBoundary';
import { NodeHeader } from './shared/NodeHeader';
import { useNodeState } from '../../store/useNodeStateStore';
import { useInputNodeData } from '../../hooks/useInputNodeData';
import { useFlowStructureStore, setNodes } from '../../store/useFlowStructureStore';
import { useNodeContentStore, useNodeContent } from '../../store/useNodeContentStore';
import { useNodeConnections } from '../../hooks/useNodeConnections';
import { VIEW_MODES } from '../../store/viewModeStore';
import { TrashIcon, PhotoIcon, XCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/20/solid';
import { formatItemsForDisplay } from '../../utils/ui/formatInputItems';
import { runSingleNodeExecution } from '../../core/executionUtils';

// Node component
export const InputNode: React.FC<NodeProps> = ({ id, data, selected, isConnectable = true }) => {
  const nodeState = useNodeState(id);
  const isRunning = nodeState.status === 'running';
  const setZustandNodeContent = useNodeContentStore(state => state.setNodeContent);
  const { incoming } = useNodeConnections(id);
  const isRootNode = incoming.length === 0;
  const currentNodes = useFlowStructureStore(state => state.nodes); 
  const { content: nodeContent } = useNodeContent<InputNodeContent>(id, 'input');

  // Use the consolidated input node hook with all functionalities
  const {
    chainingItems,
    commonItems,
    items,
    textBuffer,
    chainingUpdateMode,
    handleTextChange,
    handleAddText,
    handleFileChange,
    handleClearItems,
    label,
    fileProcessing,
    resetError,
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
  }, [currentNodes, setZustandNodeContent]);

  // Run handler - Simplified
  const handleRun = useCallback(() => {
    console.log(`[InputNode] Triggering single execution for node ${id}`);
    // Call the centralized execution utility
    runSingleNodeExecution(id).catch(error => {
      console.error(`[InputNode] Error during single execution:`, error);
      // Optionally, update node state to show error feedback to the user here
    });
  }, [id]); // Dependency is only the node id now

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
             label={label || 'Input'} 
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
            {/* Processing Mode Display */}
            <div className="flex items-center justify-between w-full px-4 pt-2">
              <label className="text-sm font-medium text-gray-700">Processing Mode:</label>
              <span 
                className={`px-3 py-1 text-sm font-medium rounded-md 
                  ${nodeContent?.iterateEachRow ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}
              >
                {nodeContent?.iterateEachRow ? 'ForEach' : 'Batch'}
              </span>
            </div>
            
            {/* Chained Input Behavior Display */}
            <div className="flex items-center justify-between w-full px-4 pt-2 border-t border-gray-200">
              <label className="text-sm font-medium text-gray-700">Chained Input:</label>
              <span className="text-sm font-medium text-gray-800 bg-gray-100 px-2 py-0.5 rounded">
                {/* Map mode value to display text */}
                {{
                  'common': 'Common (App)',
                  'replaceCommon': 'Common (Rep)',
                  'element': 'Element (App)',
                  'replaceElement': 'Element (Rep)',
                  'none': 'None'
                }[chainingUpdateMode || 'element'] /* Default to element if undefined */}
              </span>
            </div>

            {/* Accumulation Mode Display - Added */}
            <div className="flex items-center justify-between w-full px-4 pt-2 border-t border-gray-200">
              <label className="text-sm font-medium text-gray-700">Accumulation:</label>
              <span 
                className={clsx(
                  `px-2 py-0.5 text-sm font-medium rounded-md`,
                  nodeContent?.accumulationMode === 'always' || !nodeContent?.accumulationMode ? 'bg-blue-100 text-blue-800' :
                  nodeContent?.accumulationMode === 'oncePerContext' ? 'bg-green-100 text-green-800' :
                  nodeContent?.accumulationMode === 'none' ? 'bg-gray-100 text-gray-800' : 'bg-gray-100 text-gray-800' // Default/fallback style
                )}
              >
                {/* Map mode value to display text */}
                {{
                  'always': 'Always',
                  'oncePerContext': 'Once',
                  'none': 'None'
                }[nodeContent?.accumulationMode || 'always'] /* Default to Always if undefined */}
              </span>
            </div>
            
            {/* Manual Text Input */}
            <div className="px-4 py-2 border-t border-gray-200">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                 Add Text:
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
                  >Common</button>
                  <button
                    onClick={() => handleAddText('element')}
                    disabled={!textBuffer.trim()}
                    className={`px-2 py-1 text-xs font-medium rounded ${!textBuffer.trim() ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-100 text-orange-800 hover:bg-orange-200'}`}
                  >Element</button>
                </div>
              </div>
            </div>
            
            {/* File Input Area */} 
            <div className="px-4 py-2 border-t border-gray-200">
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-medium text-gray-500">
                  Add Files (Images only, max 10MB):
                </label>
                <div className="flex space-x-1">
                  <input
                    type="file"
                    id={`common-file-input-${id}`}
                    onChange={(e) => handleFileChange(e, 'common')}
                    className="hidden"
                    accept="image/*"
                    multiple
                  />
                  <input
                    type="file"
                    id={`element-file-input-${id}`}
                    onChange={(e) => handleFileChange(e, 'element')}
                    className="hidden"
                    accept="image/*"
                    multiple
                  />
                  <label
                    htmlFor={`common-file-input-${id}`}
                    className="cursor-pointer px-2 py-1 text-xs font-medium rounded bg-purple-100 text-purple-800 hover:bg-purple-200 flex items-center"
                  >
                    <PhotoIcon className="h-3 w-3 mr-1" />
                    Common
                  </label>
                  <label
                    htmlFor={`element-file-input-${id}`}
                    className="cursor-pointer px-2 py-1 text-xs font-medium rounded bg-orange-100 text-orange-800 hover:bg-orange-200 flex items-center"
                  >
                    <PhotoIcon className="h-3 w-3 mr-1" />
                    Element
                  </label>
                </div>
              </div>
              
              {/* 새로고침 경고 메시지 */}
              <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
                <div className="flex items-start">
                  <ExclamationTriangleIcon className="h-4 w-4 text-yellow-500 mr-1" />
                  <p className="text-xs text-yellow-700 flex-grow">
                    페이지 새로 고침 시 추가된 파일이 손실됩니다. 실행 전 작업을 완료하세요.
                  </p>
                </div>
              </div>
              
              {/* File Processing Status */}
              {fileProcessing.uploading && (
                <div className="mt-2">
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className="bg-blue-600 h-2.5 rounded-full" 
                      style={{ width: `${fileProcessing.progress}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Uploading... {fileProcessing.progress}%</p>
                </div>
              )}
              
              {/* File Processing Error */}
              {fileProcessing.error && (
                <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-md">
                  <div className="flex items-start">
                    <p className="text-xs text-red-600 flex-grow">{fileProcessing.error}</p>
                    <button 
                      onClick={resetError}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <XCircleIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
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
          </div>
        </div>
      </div>
    </NodeErrorBoundary>
  );
};

export default InputNode; 