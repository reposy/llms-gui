import React from 'react';
import clsx from 'clsx';

interface InputModeToggleProps {
  iterateEachRow: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export const InputModeToggle: React.FC<InputModeToggleProps> = ({
  iterateEachRow,
  onToggle,
  disabled = false
}) => {
  return (
    <div className="mb-4 border rounded-lg p-3 bg-gray-50">
      <p className="text-sm font-medium mb-2">Execution Mode</p>
      
      <div className="flex">
        <button
          type="button"
          onClick={onToggle}
          disabled={disabled || !iterateEachRow}
          className={clsx(
            'flex-1 px-3 py-1.5 text-xs transition rounded-l-md',
            !iterateEachRow 
              ? 'bg-blue-500 text-white font-medium' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          )}
        >
          Batch
        </button>
        <button
          type="button"
          onClick={onToggle}
          disabled={disabled || iterateEachRow}
          className={clsx(
            'flex-1 px-3 py-1.5 text-xs transition rounded-r-md',
            iterateEachRow 
              ? 'bg-blue-500 text-white font-medium' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          )}
        >
          For Each
        </button>
      </div>
      
      <div className="mt-2 text-xs text-gray-600">
        {iterateEachRow ? (
          <div className="flex">
            <div className="w-5 text-blue-500 mr-1">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
            </div>
            <p>
              <strong>For Each</strong>: Process each row individually, running downstream nodes once per row.
              Each row is passed as <code className="bg-gray-200 px-1 rounded">{"{{input}}"}</code> to connected nodes.
            </p>
          </div>
        ) : (
          <div className="flex">
            <div className="w-5 text-blue-500 mr-1">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 7a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 13a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <p>
              <strong>Batch</strong>: Process all rows at once, passing the entire content as 
              <code className="bg-gray-200 px-1 rounded ml-1">{"{{input}}"}</code> to connected nodes.
            </p>
          </div>
        )}
      </div>
      
      {iterateEachRow && (
        <div className="mt-2 bg-blue-50 p-2 rounded text-xs">
          <div className="font-medium text-blue-700 mb-1">Execution Tracking</div>
          <p className="text-blue-600">
            Each input row will be processed separately. Results will include metadata to track which row produced which output.
          </p>
        </div>
      )}
    </div>
  );
}; 