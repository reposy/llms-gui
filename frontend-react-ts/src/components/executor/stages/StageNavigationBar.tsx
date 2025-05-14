import React from 'react';
import { ExecutorStage } from '../../../store/useExecutorStateStore'; // Adjust path as needed

interface StageNavigationBarProps {
  currentStage: ExecutorStage;
  onStageChange: (newStage: ExecutorStage) => void;
  canSetInput: boolean; // True if flowChain.length > 0
  canViewResults: boolean; // True if there's a selected flow with results
}

const StageNavigationBar: React.FC<StageNavigationBarProps> = ({
  currentStage,
  onStageChange,
  canSetInput,
  canViewResults,
}) => {
  return (
    <div className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-center">
          {/* Upload Flow Button */}
          <button
            className={`${
              currentStage === 'upload' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            } py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
            onClick={() => onStageChange('upload')}
          >
            <span className={`${
                currentStage === 'upload' ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-200 text-gray-600'
            } w-6 h-6 rounded-full flex items-center justify-center mr-2`}>1</span>
            Upload Flow
          </button>

          {/* Set Input Button */}
          <button
            className={`${
              currentStage === 'input' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            } py-4 px-1 border-b-2 font-medium text-sm mx-8 flex items-center ${
              !canSetInput ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            onClick={() => canSetInput && onStageChange('input')}
            disabled={!canSetInput}
          >
            <span className={`${
              currentStage === 'input' ? 'bg-indigo-100 text-indigo-600' :
              !canSetInput ? 'bg-gray-100 text-gray-400' : 'bg-gray-200 text-gray-600'
            } w-6 h-6 rounded-full flex items-center justify-center mr-2`}>2</span>
            Set Input
          </button>

          {/* View Results Button */}
          <button
            className={`${
              currentStage === 'result' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            } py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
              !canViewResults ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            onClick={() => canViewResults && onStageChange('result')}
            disabled={!canViewResults}
          >
            <span className={`${
              currentStage === 'result' ? 'bg-indigo-100 text-indigo-600' :
              !canViewResults ? 'bg-gray-100 text-gray-400' : 'bg-gray-200 text-gray-600'
            } w-6 h-6 rounded-full flex items-center justify-center mr-2`}>3</span>
            View Results
          </button>
        </div>
      </div>
    </div>
  );
};

export default StageNavigationBar; 