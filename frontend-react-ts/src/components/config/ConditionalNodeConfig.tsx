import React from 'react';
import { ConditionalNodeData } from '../../types/nodes';
import { useConditionalNodeData } from '../../hooks/useConditionalNodeData';

interface ConditionalNodeConfigProps {
  nodeId: string;
  data: ConditionalNodeData;
}

export const ConditionalNodeConfig: React.FC<ConditionalNodeConfigProps> = ({ 
  nodeId,
  data  // Keep for compatibility with Redux
}) => {
  // Use Zustand hook for state management
  const {
    conditionType,
    conditionValue,
    handleConditionTypeChange,
    handleValueChange,
  } = useConditionalNodeData({ nodeId });

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Condition Type
        </label>
        <select
          value={conditionType}
          onChange={(e) => handleConditionTypeChange(e.target.value as any)}
          className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-yellow-500 focus:border-yellow-500 sm:text-sm"
        >
          <option value="contains">Contains Substring</option>
          <option value="greater_than">Number Greater Than</option>
          <option value="less_than">Number Less Than</option>
          <option value="equal_to">Equal To</option>
          <option value="json_path">JSON Path Exists/Truthy</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Value / Path
        </label>
        <input
          type="text"
          value={conditionValue}
          onChange={(e) => handleValueChange(e.target.value)}
          placeholder={conditionType === 'json_path' ? 'e.g., $.result.score' : 'Value to check'}
          className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-yellow-500 focus:border-yellow-500 sm:text-sm"
        />
      </div>

      <div className="bg-yellow-50 border border-yellow-100 rounded p-3">
        <h4 className="text-sm font-medium text-yellow-800">How Conditions Work</h4>
        <ul className="mt-1 text-xs text-yellow-700 space-y-1 list-disc list-inside">
          <li>Contains: Checks if input contains this substring</li>
          <li>Greater/Less Than: Compares numbers (converts strings to numbers)</li>
          <li>Equal To: Exact match comparison</li>
          <li>JSON Path: Evaluates if the path exists and is truthy</li>
        </ul>
      </div>
    </div>
  );
}; 