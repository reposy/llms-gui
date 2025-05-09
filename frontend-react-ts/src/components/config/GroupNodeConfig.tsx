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
  
  // Group node data hook에서 모든 데이터 가져오기
  const {
    label,
    isCollapsed,
    items, // NodeContent에서 직접 items 사용
    handleLabelChange,
    toggleCollapse
  } = useGroupNodeData({ nodeId });
  
  // Event handler to stop propagation to prevent backspace from deleting nodes
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
  }, []);

  // 결과 항목의 표시 형식을 결정하는 함수
  const formatResultItem = (item: any, index: number) => {
    if (item === undefined) return 'undefined';
    if (item === null) return 'null';
    
    if (typeof item === 'object') {
      try {
        const stringified = JSON.stringify(item);
        return stringified.length > 100 ? stringified.substring(0, 100) + '...' : stringified;
      } catch (e) {
        return `[Object] (${Object.keys(item).length} keys)`;
      }
    }
    
    return String(item);
  };

  // Results are considered valid for display if the items array exists and has entries,
  // even if those entries are undefined or null.
  const hasResultsToDisplay = Array.isArray(items) && items.length > 0;

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
          onChange={(e) => handleLabelChange(nodeId, e.target.value)}
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
      
      {/* 실행 결과 표시 섹션 */}
      <div className="mt-6">
        <h4 className="font-medium text-sm text-gray-700 mb-2">Results</h4>
        <div className="border border-gray-200 rounded-md overflow-hidden">
          {hasResultsToDisplay ? (
            <div className="max-h-60 overflow-y-auto">
              <ul className="divide-y divide-gray-200">
                {items.map((item, index) => (
                  <li key={index} className="p-2 text-sm hover:bg-gray-50">
                    <div className="flex">
                      <span className="font-medium min-w-20">Item {index + 1}:</span>
                      <span className="ml-2 break-all">{formatResultItem(item, index)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="p-3 text-sm text-gray-500 text-center">
              {executionState?.status === 'success' 
                ? 'No results generated' 
                : 'Execute to see results'}
            </div>
          )}
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