import React from 'react';
import clsx from 'clsx';

// Optional backwards compatibility type
export interface FormattedItem {
  id: string;
  index: number;
  display: string;
  type: string;
  isFile: boolean;
}

interface InputItemListProps {
  items: string[];
  onDelete: (index: number) => void;
  showClear?: boolean;
  onClear?: () => void;
  limit?: number;
}

export const InputItemList: React.FC<InputItemListProps> = ({
  items,
  onDelete,
  showClear = false,
  onClear,
  limit
}) => {
  // Limit the number of items to display if limit is provided
  const displayItems = limit && items.length > limit 
    ? [...items.slice(0, limit), `... and ${items.length - limit} more`] 
    : items;

  // Generate a truncated display name for long items
  const getDisplayName = (item: string) => {
    // If it's a file path
    if (item.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp|txt|md|csv|json|js|ts|html|css|xml|yml|yaml)$/i)) {
      // Get just the filename
      const fileName = item.split('/').pop() || item;
      return fileName.length > 40 ? fileName.substring(0, 37) + '...' : fileName;
    }
    
    // For text content
    return item.length > 40 ? item.substring(0, 37) + '...' : item;
  };

  // Get item type icon
  const getItemIcon = (item: string) => {
    // For image files
    if (item.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i)) {
      return '🖼️';
    }
    // For text files
    if (item.match(/\.(txt|md|csv|json|js|ts|html|css|xml|yml|yaml)$/i)) {
      return '📄';
    }
    // For raw text content
    return '📝';
  };

  return (
    <div className="space-y-1">
      {displayItems.map((item, index) => {
        // Display differently if it's the "and X more" item
        const isMoreIndicator = limit && index === limit && items.length > limit;
        
        return (
          <div 
            key={index}
            className={clsx(
              'group flex items-center justify-between',
              'py-1 px-2 rounded text-xs',
              isMoreIndicator 
                ? 'bg-gray-100 text-gray-500 italic' 
                : 'bg-gray-50 hover:bg-gray-100 border border-gray-200'
            )}
          >
            <div className="flex items-center overflow-hidden">
              {!isMoreIndicator && (
                <span className="mr-1 flex-shrink-0">{getItemIcon(item)}</span>
              )}
              <span className="truncate">{isMoreIndicator ? item : getDisplayName(item)}</span>
            </div>
            
            {!isMoreIndicator && (
              <button
                onClick={() => onDelete(index)}
                className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 ml-2 transition-opacity"
                title="Delete item"
              >
                ✕
              </button>
            )}
          </div>
        );
      })}

      {showClear && items.length > 0 && onClear && (
        <button
          onClick={onClear}
          className={clsx(
            'text-xs text-red-500 hover:text-red-700',
            'mt-2 transition-colors'
          )}
        >
          Clear All Items
        </button>
      )}
    </div>
  );
}; 