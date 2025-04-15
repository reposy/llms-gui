import React from 'react';

interface ItemCounts {
  fileCount: number;
  textCount: number;
  total: number;
}

interface InputSummaryBarProps {
  itemCounts: ItemCounts;
  iterateEachRow: boolean;
}

export const InputSummaryBar: React.FC<InputSummaryBarProps> = ({
  itemCounts,
  iterateEachRow
}) => {
  if (itemCounts.total === 0) {
    return null;
  }

  return (
    <div className="flex items-center justify-between text-xs bg-gray-50 p-2 rounded-md">
      <span className="font-medium">
        {itemCounts.fileCount > 0 && itemCounts.textCount > 0 
          ? `${itemCounts.fileCount} file${itemCounts.fileCount !== 1 ? 's' : ''} + ${itemCounts.textCount} text row${itemCounts.textCount !== 1 ? 's' : ''}`
          : itemCounts.fileCount > 0 
            ? `${itemCounts.fileCount} file${itemCounts.fileCount !== 1 ? 's' : ''}`
            : `${itemCounts.textCount} text row${itemCounts.textCount !== 1 ? 's' : ''}`
        }
      </span>
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
        iterateEachRow 
          ? 'bg-blue-100 text-blue-800' 
          : 'bg-gray-200 text-gray-800'
      }`}>
        {iterateEachRow ? 'Foreach' : 'Batch'}
      </span>
    </div>
  );
}; 