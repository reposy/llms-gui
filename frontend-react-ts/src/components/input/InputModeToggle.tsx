import React from 'react';
import clsx from 'clsx';

interface InputModeProps {
  iterateEachRow: boolean;
  chainingUpdateMode: 'common' | 'element' | 'none';
  onToggleProcessingMode: () => void;
  onUpdateChainingMode: (mode: 'common' | 'element' | 'none') => void;
}

export const InputModeToggle: React.FC<InputModeProps> = ({ 
  iterateEachRow, 
  chainingUpdateMode,
  onToggleProcessingMode,
  onUpdateChainingMode
}) => {
  return (
    <div className="flex flex-col space-y-2 w-full">
      <div className="flex items-center justify-between w-full">
        <label className="text-sm font-medium text-gray-700">실행 모드:</label>
        <button
          type="button"
          onClick={onToggleProcessingMode}
          className={`
            px-3 py-1 text-sm font-medium rounded-md transition-colors
            ${iterateEachRow
              ? 'bg-green-100 text-green-800 hover:bg-green-200'
              : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
            }
          `}
        >
          {iterateEachRow ? 'ForEach 모드' : 'Batch 모드'}
        </button>
      </div>
      
      <div className="flex flex-col space-y-1">
        <label className="text-sm font-medium text-gray-700">자동 입력 추가:</label>
        <div className="flex space-x-2 items-center">
          <button
            type="button"
            onClick={() => onUpdateChainingMode('common')}
            className={`
              px-3 py-1 text-sm font-medium rounded-md transition-colors flex-1
              ${chainingUpdateMode === 'common'
                ? 'bg-purple-100 text-purple-800 hover:bg-purple-200'
                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
              }
            `}
          >
            공통 항목
          </button>
          <button
            type="button"
            onClick={() => onUpdateChainingMode('element')}
            className={`
              px-3 py-1 text-sm font-medium rounded-md transition-colors flex-1
              ${chainingUpdateMode === 'element'
                ? 'bg-orange-100 text-orange-800 hover:bg-orange-200'
                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
              }
            `}
          >
            개별 항목
          </button>
          <button
            type="button"
            onClick={() => onUpdateChainingMode('none')}
            className={`
              px-3 py-1 text-sm font-medium rounded-md transition-colors flex-1
              ${chainingUpdateMode === 'none'
                ? 'bg-gray-400 text-white hover:bg-gray-500'
                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
              }
            `}
          >
            미적용
          </button>
        </div>
      </div>
      
      <div className="text-xs text-gray-600 mt-1">
        {
          chainingUpdateMode === 'common' ? 
            '(이전 노드 출력을 자동으로 공통 항목에 추가)' :
          chainingUpdateMode === 'element' ? 
            '(이전 노드 출력을 자동으로 개별 항목에 추가)' :
            '(이전 노드 출력을 자동으로 추가하지 않음)'
        }
      </div>
    </div>
  );
}; 