import React, { useCallback } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { ConditionalNodeData, NodeData, ConditionType } from '../../types/nodes';
import { useNodeState } from '../../store/flowExecutionStore'; // Make sure this path is correct
import NodeErrorBoundary from './NodeErrorBoundary';
import { NodeHeader } from './shared/NodeHeader';
import { NodeBody } from './shared/NodeBody';
import { NodeFooter } from './shared/NodeFooter';
import clsx from 'clsx';
import { useConditionalNodeData } from '../../hooks/useConditionalNodeData';

const ConditionalNode: React.FC<NodeProps<ConditionalNodeData>> = ({ id, data, selected }) => {
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

  const handleLabelUpdate = useCallback((newLabel: string) => {
    updateConditionalContent({ label: newLabel });
  }, [updateConditionalContent]);

  const handleConditionTypeChangeEvent = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = event.target.value as ConditionType;
    handleConditionTypeChange(newType);
  }, [handleConditionTypeChange]);

  const handleConditionValueChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    handleValueChange(newValue);
  }, [handleValueChange]);

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
        />

        <NodeHeader
          nodeId={id}
          label={label || data.label || 'Condition'}
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
        />
         {/* Output Handle: False (Bottom Side) */}
        <Handle
          type="source"
          position={Position.Bottom} // Position set to Bottom
          id="falseHandle"
          className="w-3 h-3 !bg-red-500"
          // Style for horizontal centering on the bottom edge
          style={{ bottom: '-6px', left: '50%', transform: 'translateX(-50%)' }}
        />

        <NodeBody>
          <div className="space-y-2">
            {/* Condition Type Dropdown */}
            <div>
              <label htmlFor={`condition-type-${id}`} className="block text-xs font-medium text-gray-700 mb-1">Condition Type</label>
              <select
                id={`condition-type-${id}`}
                value={conditionType || data.conditionType || 'contains'}
                onChange={handleConditionTypeChangeEvent}
                className="nodrag block w-full px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-yellow-500 bg-white text-black"
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
                value={conditionValue || data.conditionValue || ''}
                onChange={handleConditionValueChange}
                className="nodrag block w-full px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-yellow-500 bg-white text-black"
                placeholder={conditionType === 'json_path' ? 'e.g., $.result.score' : 'Value to check'}
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
};

export default ConditionalNode;