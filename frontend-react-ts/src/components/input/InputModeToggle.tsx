import React from 'react';

interface InputModeToggleProps {
  iterateEachRow: boolean;
  onToggle: () => void;
  showLabel?: boolean;
  size?: 'sm' | 'md';
  layout?: 'row' | 'column';
  showDescription?: boolean;
}

export const InputModeToggle: React.FC<InputModeToggleProps> = ({
  iterateEachRow,
  onToggle,
  showLabel = true,
  size = 'sm',
  layout = 'row',
  showDescription = true
}) => {
  const sizeClasses = {
    sm: 'px-3 py-1 text-xs',
    md: 'px-4 py-1.5 text-sm'
  };

  const description = iterateEachRow 
    ? "Each item will be sent separately to downstream nodes" 
    : "Process all items together";

  // For column layout
  if (layout === 'column') {
    return (
      <div className="space-y-1">
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
            title={description}
          >
            {iterateEachRow ? 'Foreach Mode' : 'Batch Mode'}
          </button>
        </div>
        
        {/* Description as separate row */}
        {showDescription && (
          <div className="ml-0 text-xs text-gray-500">
            {description}
          </div>
        )}
      </div>
    );
  }

  // For row layout (original)
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
      {showLabel && showDescription && (
        <span className="text-xs text-gray-500 ml-2">
          {description}
        </span>
      )}
    </div>
  );
}; 