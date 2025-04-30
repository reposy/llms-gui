// src/components/nodes/ConditionalNode.tsx
import React, { memo, useCallback} from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { ConditionalNodeData, ConditionType } from '../../types/nodes';
import { useNodeState } from '../../store/useNodeStateStore';
import NodeErrorBoundary from './NodeErrorBoundary';
import { NodeHeader } from './shared/NodeHeader';
import { NodeBody } from './shared/NodeBody';
import { NodeFooter } from './shared/NodeFooter';
import clsx from 'clsx';
import { useConditionalNodeData } from '../../hooks/useConditionalNodeData';
import { useFlowStructureStore } from '../../store/useFlowStructureStore';
import { useNodeContentStore } from '../../store/useNodeContentStore';

export const ConditionalNode: React.FC<NodeProps> = memo(({ id, data, selected, isConnectable = true }) => {
  // Cast data to ConditionalNodeData where needed
  const conditionData = data as ConditionalNodeData;
  
  const nodeState = useNodeState(id);

  // Use the Zustand hook
  const {
    conditionType,
    conditionValue,
    label,
    handleConditionTypeChange,
    handleValueChange,
    updateConditionalContent,
  } = useConditionalNodeData({ nodeId: id });

  // Get functions from stores
  const setNodeContent = useNodeContentStore(state => state.setNodeContent);
  const { nodes, setNodes } = useFlowStructureStore(state => ({ nodes: state.nodes, setNodes: state.setNodes }));

  const handleLabelUpdate = useCallback((nodeId: string, newLabel: string) => {
    setNodeContent(nodeId, { label: newLabel });

    const updatedNodes = nodes.map(node =>
      node.id === nodeId
        ? {
            ...node,
            data: {
              ...node.data,
              label: newLabel
            }
          }
        : node
    );
    setNodes(updatedNodes);
    console.log(`[ConditionalNode] Updated label for node ${nodeId} in both stores.`);
  }, [nodes, setNodes, setNodeContent]);

  const handleConditionTypeChangeEvent = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = event.target.value as ConditionType;
    handleConditionTypeChange(newType);
  }, [handleConditionTypeChange]);

  const handleConditionValueChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    handleValueChange(newValue);
  }, [handleValueChange]);

  // Event handler to prevent backspace from deleting nodes
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <NodeErrorBoundary nodeId={id}>
      <div className={clsx("relative flex flex-col rounded-lg border bg-white shadow-lg", selected ? 'border-yellow-500' : 'border-gray-300', 'w-[300px]')}>
        {/* Input Handle */}
        <Handle
          type="target"
          position={Position.Left}
          id="input"
          className="w-3 h-3 !bg-gray-500"
          style={{ top: '50%' }}
          isConnectable={isConnectable}
        />

        <NodeHeader
          nodeId={id}
          label={label || conditionData.label || 'Condition'}
          placeholderLabel="Conditional Node"
          isRootNode={false}
          isRunning={nodeState.status === 'running'}
          viewMode="expanded"
          themeColor="orange"
          onRun={() => {}}
          onLabelUpdate={handleLabelUpdate}
          onToggleView={() => {}}
        />

        {/* Output Handle: True (Right Side) */}
        <Handle
          type="source"
          position={Position.Right} // Position set to Right
          id="trueHandle"
          className="w-3 h-3 !bg-green-500"
          // Style for vertical centering on the right edge
          style={{ top: '50%', right: '-6px', transform: 'translateY(-50%)' }}
          isConnectable={isConnectable}
        />
         {/* Output Handle: False (Bottom Side) */}
        <Handle
          type="source"
          position={Position.Bottom} // Position set to Bottom
          id="falseHandle"
          className="w-3 h-3 !bg-red-500"
          // Style for horizontal centering on the bottom edge
          style={{ bottom: '-6px', left: '50%', transform: 'translateX(-50%)' }}
          isConnectable={isConnectable}
        />

        <NodeBody>
          <div className="space-y-2">
            {/* Condition Type Dropdown */}
            <div>
              <label htmlFor={`condition-type-${id}`} className="block text-xs font-medium text-gray-700 mb-1">Condition Type</label>
              <select
                id={`condition-type-${id}`}
                value={conditionType || conditionData.conditionType || 'contains'}
                onChange={handleConditionTypeChangeEvent}
                className="nodrag block w-full px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-yellow-500 bg-white text-black"
                onKeyDown={handleKeyDown}
              >
                <option value="contains">Contains Substring</option>
                <option value="greater_than">Number Greater Than</option>
                <option value="less_than">Number Less Than</option>
                <option value="equal_to">Equal To</option>
                <option value="json_path">JSON Path Exists/Truthy</option>
              </select>
            </div>
            {/* Value/Path Input */}
            <div>
              <label htmlFor={`condition-value-${id}`} className="block text-xs font-medium text-gray-700 mb-1">Value / Path</label>
              <input
                id={`condition-value-${id}`}
                type="text"
                value={conditionValue || conditionData.conditionValue || ''}
                onChange={handleConditionValueChange}
                className="nodrag block w-full px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-yellow-500 bg-white text-black"
                placeholder={conditionType === 'json_path' ? 'e.g., $.result.score' : 'Value to check'}
                onKeyDown={handleKeyDown}
              />
            </div>

            {/* Display Execution Result */}
            {nodeState.status === 'success' && typeof nodeState.conditionResult === 'boolean' && (
              <div className="mt-2 pt-1 border-t border-gray-200">
                  <p className={clsx(
                      "text-xs font-medium",
                      nodeState.conditionResult ? 'text-green-600' : 'text-red-600'
                  )}>
                      Result: {nodeState.conditionResult ? 'True' : 'False'}
                  </p>
              </div>
            )}
             {/* Display Error */}
             {nodeState.status === 'error' && (
               <p className="text-xs text-red-500 mt-1">Error: {nodeState.error}</p>
             )}
          </div>
        </NodeBody>

        {/* Footer with Handle Labels */}
        <NodeFooter>
           {/* Label for True Handle (Right) */}
          <div className="absolute text-xs text-green-600 pointer-events-none"
               style={{ top: '50%', right: '10px', transform: 'translateY(-50%)' }}>
            True
          </div>
           {/* Label for False Handle (Bottom) */}
          <div className="absolute text-xs text-red-600 pointer-events-none"
               style={{ bottom: '2px', left: '50%', transform: 'translateX(-50%)' }}>
            False
          </div>
        </NodeFooter>
      </div>
    </NodeErrorBoundary>
  );
});

ConditionalNode.displayName = 'ConditionalNode';