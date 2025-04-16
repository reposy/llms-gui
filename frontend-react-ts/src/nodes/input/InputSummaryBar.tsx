import React from 'react';
import clsx from 'clsx';

interface InputSummaryBarProps {
  itemCount: {
    total: number;
    fileCount: number;
    textCount: number;
  };
  processingMode: 'batch' | 'foreach';
  className?: string;
}

export const InputSummaryBar: React.FC<InputSummaryBarProps> = ({
  itemCount,
  processingMode,
  className
}) => {
  // Generate summary text based on item counts
  const getSummaryText = () => {
    if (itemCount.total === 0) {
      return null;
    }
    
    if (itemCount.fileCount > 0 && itemCount.textCount > 0) {
      return `${itemCount.fileCount} file${itemCount.fileCount !== 1 ? 's' : ''} + ${itemCount.textCount} text item${itemCount.textCount !== 1 ? 's' : ''}`;
    } else if (itemCount.fileCount > 0) {
      return `${itemCount.fileCount} file${itemCount.fileCount !== 1 ? 's' : ''}`;
    } else if (itemCount.textCount > 0) {
      return `${itemCount.textCount} text item${itemCount.textCount !== 1 ? 's' : ''}`;
    }
    
    return null;
  };

  const summaryText = getSummaryText();
  
  if (!summaryText) {
    return null;
  }

  return (
    <div 
      className={clsx(
        'flex items-center justify-between py-2 px-3',
        'bg-gray-50 border-t border-gray-200 rounded-b-lg',
        className
      )}
    >
      <span className="text-xs text-gray-500">{summaryText}</span>
      <span 
        className={clsx(
          'text-xs rounded px-2 py-0.5',
          processingMode === 'foreach' 
            ? 'bg-blue-100 text-blue-700'
            : 'bg-gray-100 text-gray-700'
        )}
      >
        {processingMode === 'foreach' ? 'Process each item' : 'Process as batch'}
      </span>
    </div>
  );
}; 