import React, { useCallback } from 'react';
import { GroupNodeData } from '../../types/nodes';
import { useNodeState } from '../../store/useNodeStateStore';
import { useGroupNodeData } from '../../hooks/useGroupNodeData';

interface GroupNodeConfigProps {
  nodeId: string;
  data: GroupNodeData;
}

export const GroupNodeConfig: React.FC<GroupNodeConfigProps> = ({ nodeId, data }) => {
  const executionState = useNodeState(nodeId);
  
  // Use the Group data hook
  const {
    label,
    isCollapsed,
    handleLabelChange,
    toggleCollapse
  } = useGroupNodeData({ nodeId });
  
  // Event handler to stop propagation to prevent backspace from deleting nodes
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-4">Group Node Configuration</h3>
      
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Label
        </label>
        <input
          type="text"
          value={label}
          onChange={(e) => handleLabelChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-white text-gray-900 dark:text-gray-900"
          placeholder="Group label"
        />
      </div>
      
      <div className="mb-4">
        <div className="flex items-center">
          <input
            id="toggle-collapse"
            type="checkbox"
            checked={isCollapsed}
            onChange={toggleCollapse}
            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
          />
          <label htmlFor="toggle-collapse" className="ml-2 block text-sm text-gray-700">
            Collapse group content
          </label>
        </div>
      </div>
      
      {executionState?.status === 'error' && (
        <div className="p-3 mt-3 bg-red-50 border border-red-200 rounded text-sm text-red-600">
          <div className="font-semibold">Execution Error</div>
          <div className="mt-1">{executionState.error}</div>
        </div>
      )}
    </div>
  );
}; 