import React from 'react';
import type { ExecutionMode } from '../../../services/flowExecutionService';

interface ExecutionModeSectionProps {
  executionMode: ExecutionMode;
  onExecutionModeChange: (mode: ExecutionMode) => void;
  editMode: boolean;
}

const ExecutionModeSection: React.FC<ExecutionModeSectionProps> = ({
  executionMode,
  onExecutionModeChange,
  editMode
}) => {
  return (
    <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-white">
      <div className="mb-4">
        <h3 className="text-md font-medium text-gray-800 mb-3">Execution Mode</h3>
        <div className="flex gap-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="executionMode"
              value="batch"
              checked={executionMode === 'batch'}
              onChange={(e) => editMode && onExecutionModeChange(e.target.value as ExecutionMode)}
              disabled={!editMode}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 focus:ring-2"
            />
            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-900">Batch Mode</span>
              <span className="text-xs text-gray-500">모든 입력을 한 번에 처리</span>
            </div>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="executionMode"
              value="forEach"
              checked={executionMode === 'forEach'}
              onChange={(e) => editMode && onExecutionModeChange(e.target.value as ExecutionMode)}
              disabled={!editMode}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 focus:ring-2"
            />
            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-900">ForEach Mode</span>
              <span className="text-xs text-gray-500">각 아이템을 순차적으로 처리</span>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
};

export default ExecutionModeSection; 