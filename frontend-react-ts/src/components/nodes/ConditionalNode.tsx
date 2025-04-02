import React, { useCallback } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { useDispatch } from 'react-redux';
import { updateNodeData } from '../../store/flowSlice';
import { ConditionalNodeData, NodeData, ConditionType } from '../../types/nodes';
import NodeErrorBoundary from './NodeErrorBoundary';
import { NodeHeader } from './shared/NodeHeader';
import { NodeBody } from './shared/NodeBody';
import { NodeFooter } from './shared/NodeFooter';
import clsx from 'clsx';

const ConditionalNode: React.FC<NodeProps<ConditionalNodeData>> = ({ id, data, selected }) => {
  const dispatch = useDispatch();

  const handleLabelUpdate = useCallback((newLabel: string) => {
    dispatch(updateNodeData({ nodeId: id, data: { ...data, label: newLabel } }));
  }, [dispatch, id, data]);

  const handleConditionTypeChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = event.target.value as ConditionType;
    dispatch(updateNodeData({ nodeId: id, data: { ...data, conditionType: newType } }));
  }, [dispatch, id, data]);

  const handleConditionValueChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    dispatch(updateNodeData({ nodeId: id, data: { ...data, conditionValue: newValue } }));
  }, [dispatch, id, data]);

  // TODO: Implement evaluation logic (likely triggered externally by the execution engine)

  return (
    <NodeErrorBoundary nodeId={id}>
      <div className={clsx("flex flex-col rounded-lg border bg-white shadow-lg", selected ? 'border-yellow-500' : 'border-gray-300', 'w-[300px]')}> 
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
          label={data.label || 'Condition'} 
          placeholderLabel="Conditional Node"
          isRootNode={false}
          isRunning={data.isExecuting || false}
          viewMode="expanded"
          themeColor="orange"
          onRun={() => {}}
          onLabelUpdate={handleLabelUpdate}
          onToggleView={() => {}}
        />
        <NodeBody>
          <div className="space-y-2">
            <div>
              <label htmlFor={`condition-type-${id}`} className="block text-xs font-medium text-gray-700 mb-1">Condition Type</label>
              <select
                id={`condition-type-${id}`}
                value={data.conditionType || 'contains'} // Default to contains
                onChange={handleConditionTypeChange}
                className="nodrag block w-full px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-yellow-500 bg-white text-black"
              >
                <option value="contains">Contains Substring</option>
                <option value="greater_than">Number Greater Than</option>
                <option value="less_than">Number Less Than</option>
                <option value="equal_to">Number Equal To</option>
                <option value="json_path">JSON Path Evaluation</option>
              </select>
            </div>
            <div>
              <label htmlFor={`condition-value-${id}`} className="block text-xs font-medium text-gray-700 mb-1">Value / Path</label>
              <input
                id={`condition-value-${id}`}
                type="text"
                value={data.conditionValue || ''}
                onChange={handleConditionValueChange}
                className="nodrag block w-full px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-yellow-500 bg-white text-black"
                placeholder={data.conditionType === 'json_path' ? 'e.g., result.score > 0.5' : 'Value to check'}
              />
            </div>
          </div>
        </NodeBody>
        <NodeFooter>
          {/* True Handle - Right Center */}
          <Handle 
            type="source" 
            position={Position.Right} 
            id="true"
            className="w-3 h-3 !bg-green-500"
          style={{ top: '50%', transform: 'translateY(-50%)', right: '-6px' }}
          />

          {/* False Handle - Bottom Center */}
          <Handle 
            type="source" 
            position={Position.Bottom} 
            id="false"
            className="w-3 h-3 !bg-red-500"
          style={{ left: '50%', transform: 'translateX(-50%)', bottom: '-6px' }}
          />
        </NodeFooter>
      </div>
    </NodeErrorBoundary>
  );
};

export default ConditionalNode; 