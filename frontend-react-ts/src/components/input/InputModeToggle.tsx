import React from 'react';
import clsx from 'clsx';

interface InputModeProps {
  iterateEachRow: boolean;
  chainingUpdateMode: 'common' | 'element' | 'none' | 'replaceCommon';
  onToggleProcessingMode: () => void;
  onUpdateChainingMode: (mode: 'common' | 'element' | 'none' | 'replaceCommon') => void;
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
            className={clsx(
              `px-2 py-1 text-xs font-medium rounded-md transition-colors flex-1 whitespace-nowrap`,
              chainingUpdateMode === 'common'
                ? 'bg-purple-100 text-purple-800 hover:bg-purple-200'
                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
            )}
            title="Append chained input to Common Items"
          >
            Common (Append)
          </button>
          <button
            type="button"
            onClick={() => onUpdateChainingMode('replaceCommon')}
            className={clsx(
              `px-2 py-1 text-xs font-medium rounded-md transition-colors flex-1 whitespace-nowrap`,
              chainingUpdateMode === 'replaceCommon' 
                ? 'bg-purple-400 text-white hover:bg-purple-500' 
                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
            )}
            title="Replace Common Items with chained input"
          >
            Common (Replace)
          </button>
          <button
            type="button"
            onClick={() => onUpdateChainingMode('element')}
            className={clsx(
              `px-2 py-1 text-xs font-medium rounded-md transition-colors flex-1 whitespace-nowrap`,
              chainingUpdateMode === 'element'
                ? 'bg-orange-100 text-orange-800 hover:bg-orange-200'
                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
            )}
            title="Append chained input to Element Items"
          >
            Element
          </button>
          <button
            type="button"
            onClick={() => onUpdateChainingMode('none')}
            className={clsx(
              `px-2 py-1 text-xs font-medium rounded-md transition-colors flex-1 whitespace-nowrap`,
              chainingUpdateMode === 'none'
                ? 'bg-gray-400 text-white hover:bg-gray-500'
                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
            )}
            title="Do not automatically add chained input"
          >
            None
          </button>
        </div>
      </div>
      
      <div className="text-xs text-gray-600 mt-1">
        {
          chainingUpdateMode === 'common' ? 
            '(Chained inputs are automatically added to Common items)' :
          chainingUpdateMode === 'replaceCommon' ?
            '(Common items are REPLACED by chained inputs)' :
          chainingUpdateMode === 'element' ? 
            '(Chained inputs are automatically added to Element items)' :
            '(Chained inputs are not automatically added)'
        }
      </div>
    </div>
  );
}; 