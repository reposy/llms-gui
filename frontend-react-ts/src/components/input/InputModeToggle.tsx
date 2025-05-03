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
        <label className="text-sm font-medium text-gray-700">Processing Mode:</label>
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
          {iterateEachRow ? 'ForEach' : 'Batch'}
        </button>
      </div>
      
      <div className="flex flex-col space-y-1">
        <label className="text-sm font-medium text-gray-700">Chained Input Behavior:</label>
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
            Common
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
            Element
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
            None
          </button>
        </div>
      </div>
      
      <div className="text-xs text-gray-600 mt-1">
        {
          chainingUpdateMode === 'common' ? 
            '(Chained inputs are automatically added to Common items)' :
          chainingUpdateMode === 'element' ? 
            '(Chained inputs are automatically added to Element items)' :
            '(Chained inputs are not automatically added)'
        }
      </div>
    </div>
  );
}; 