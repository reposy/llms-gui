import React from 'react';
import clsx from 'clsx';

// Define the expected item structure
export interface FormattedItem {
  id: string;
  index: number; // Original index
  display: string; // Text to show
  type: string; // e.g., 'text', 'image/jpeg'
  isFile: boolean;
  originalItem: any; // Keep original for potential future use
}

interface InputItemListProps {
  // Expect an array of FormattedItem objects
  items: FormattedItem[]; 
  onDelete: (index: number) => void; // Pass original index back
  limit?: number;
  showClear?: boolean;
  onClear?: () => void;
  totalCount?: number;
}

export const InputItemList: React.FC<InputItemListProps> = ({
  items,
  onDelete,
  limit,
  showClear = true,
  onClear,
  totalCount
}) => {
  if (items.length === 0) {
    return (
      <div className="text-sm text-gray-500 py-2 text-center border border-dashed border-gray-300 rounded-md">
        Add text or files to begin
      </div>
    );
  }

  // Limit items if specified
  const displayItems = limit ? items.slice(-limit) : items;
  const hasMore = typeof totalCount === 'number' && totalCount > displayItems.length;
  // Removed isFile check as items are now objects with an isFile property

  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs font-medium text-gray-700">
          {limit && items.length > 1 ? `Last ${limit} items` : items.length > 1 ? 'Items' : 'Item'}
        </span>
        {showClear && items.length > 0 && onClear && (
          <button
            onClick={onClear}
            className="text-xs text-red-500 hover:text-red-700"
            title="Clear all items"
          >
            Clear All
          </button>
        )}
      </div>
      <div className="space-y-1 mb-1">
        {displayItems.map((item) => (
          <div 
            key={item.id} // Use the unique id from FormattedItem
            className={clsx(
              "text-sm p-2 border border-gray-200 rounded flex items-center justify-between",
              item.isFile ? "bg-blue-50" : "bg-gray-50" // Use item.isFile
            )}
          >
            <span className="truncate block flex-grow" title={item.display}>
              {/* Use item.display for content */}
              {item.isFile ? '📄 ' : '📝 '}{item.display}
            </span>
            <button
              // Pass the original index from the item for deletion
              onClick={() => onDelete(item.index)} 
              className="text-red-500 hover:text-red-700 ml-2 p-1 text-xs"
              title="Remove item"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      {hasMore && (
        <div className="text-xs font-medium text-gray-500 mt-1">
          +{totalCount - displayItems.length} more items (see sidebar)
        </div>
      )}
    </div>
  );
}; 