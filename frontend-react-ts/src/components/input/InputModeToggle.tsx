import React from 'react';

interface InputModeToggleProps {
  iterateEachRow: boolean;
  onToggle: () => void;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

export const InputModeToggle: React.FC<InputModeToggleProps> = ({
  iterateEachRow,
  onToggle,
  showLabel = true,
  size = 'sm'
}) => {
  const sizeClasses = {
    sm: 'px-3 py-1 text-xs',
    md: 'px-4 py-1.5 text-sm'
  };

  return (
    <div className="flex items-center">
      {showLabel && (
        <span className="text-sm font-medium text-gray-700 mr-2">Processing Mode:</span>
      )}
      <button
        onClick={onToggle}
        className={`${sizeClasses[size]} font-medium rounded-md ${
          iterateEachRow
            ? 'bg-blue-100 text-blue-800 hover:bg-blue-200'
            : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
        }`}
        title="Toggle between Batch and Foreach modes"
      >
        {iterateEachRow ? 'Foreach Mode' : 'Batch Mode'}
      </button>
      {showLabel && (
        <span className="text-xs text-gray-500 ml-2">
          {iterateEachRow 
            ? "Process each item separately" 
            : "Process all items together"}
        </span>
      )}
    </div>
  );
}; 