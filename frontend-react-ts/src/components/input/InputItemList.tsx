import React, { useState, useCallback } from 'react';
import clsx from 'clsx';
import { TrashIcon, PencilIcon, ArrowRightIcon, CheckIcon, XMarkIcon } from '@heroicons/react/20/solid'; // 아이콘 임포트
import { ItemDisplay, adaptDisplayableItem } from '../../utils/ui/adaptDisplayableItem';

// 리스트 섹션 렌더링을 위한 props
interface ItemListSectionProps {
  title: string;
  itemType: 'chaining' | 'common' | 'element';
  items: ItemDisplay[];
  colorClass: string; // 섹션별 색상 구분 (e.g., 'purple', 'blue', 'gray')
  onDeleteItem: (index: number, type: 'chaining' | 'common' | 'element') => void;
  onMoveItem?: (index: number, targetType: 'common' | 'element') => void; // Chaining 전용
  onStartEditing?: (originalIndex: number, itemType: 'common' | 'element') => void; // Common, Element 전용
  onFinishEditing?: () => void; // Common, Element 전용
  onCancelEditing?: () => void; // Common, Element 전용
  onEditingTextChange?: (event: React.ChangeEvent<HTMLTextAreaElement>) => void; // Common, Element 전용
  editingItemId?: string | null; // 현재 편집 중인 아이템 ID
  editingText?: string; // 현재 편집 중인 텍스트
  disabled?: boolean;
  onClear?: () => void; // Add clear handler prop for the section
}

// 개별 리스트 아이템 렌더링 컴포넌트
const ListItem: React.FC<{ 
  item: ItemDisplay; 
  itemType: 'chaining' | 'common' | 'element';
  colorClass: string; 
  isEditing: boolean;
} & Omit<ItemListSectionProps, 'items' | 'title'>> = ({ 
  item,
  itemType,
  colorClass,
  isEditing,
  onDeleteItem,
  onMoveItem,
  onStartEditing,
  onFinishEditing,
  onCancelEditing,
  onEditingTextChange,
  editingText,
  disabled
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // 이벤트 버블링 방지
    if (onStartEditing && (itemType === 'common' || itemType === 'element') && !item.isFile) {
      onStartEditing(item.originalIndex, itemType);
    }
  };

  const handleSaveEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onFinishEditing) onFinishEditing();
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onCancelEditing) onCancelEditing();
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
     e.stopPropagation();
     onDeleteItem(item.originalIndex, itemType);
  };

  const handleMoveClick = (e: React.MouseEvent, targetType: 'common' | 'element') => {
    e.stopPropagation();
    if (onMoveItem) {
      onMoveItem(item.originalIndex, targetType);
    }
  };
  
  const renderFileIcon = (fileType: string): string => {
    if (fileType.startsWith('image/')) return '🖼️';
    if (fileType.startsWith('audio/')) return '🎵';
    if (fileType.startsWith('video/')) return '🎬';
    return '📄';
  };

  const bgColor = isEditing ? `bg-${colorClass}-100` : (itemType === 'chaining' ? `bg-gray-50` : `bg-${colorClass}-50`);
  const borderColor = `border-${colorClass}-200`;

  return (
    <li 
      className={clsx(
        `relative flex flex-col p-2 rounded-md border text-sm`,
        bgColor,
        borderColor,
        disabled && 'opacity-60 cursor-not-allowed'
      )}
    >
      <div className="flex items-center justify-between w-full cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        {/* Item Content Summary */} 
        <div className="flex-grow min-w-0 truncate flex items-center">
          {item.isFile ? (
            <span className="mr-1 text-base">{renderFileIcon(item.type)}</span>
          ) : (
             <span className="mr-1 text-gray-400">#</span> // Text indicator
          )}
          <span 
             className={clsx("truncate", isEditing ? 'hidden' : 'block')} 
             title={item.fullContent} // Show full content on hover
           >
             {item.display} {item.display !== item.fullContent && '...'} 
           </span>
        </div>

        {/* Action Buttons */} 
        {!isEditing && (
          <div className="flex-shrink-0 flex items-center space-x-1 ml-2">
            {/* Move buttons (only for chaining items) */} 
            {itemType === 'chaining' && onMoveItem && (
              <>
                <button 
                  onClick={(e) => handleMoveClick(e, 'common')} 
                  disabled={disabled} 
                  className="p-1 text-purple-500 hover:text-purple-700 disabled:text-gray-300"
                  title="Move to Common Items"
                 >
                   <ArrowRightIcon className="h-4 w-4" />
                 </button>
                 <button 
                   onClick={(e) => handleMoveClick(e, 'element')} 
                   disabled={disabled} 
                   className="p-1 text-orange-500 hover:text-orange-700 disabled:text-gray-300"
                   title="Move to Individual Items"
                 >
                   <ArrowRightIcon className="h-4 w-4" />
                 </button>
              </>
            )}
            {/* Edit button (only for text common/element items) */} 
            {(itemType === 'common' || itemType === 'element') && !item.isFile && onStartEditing && (
              <button 
                 onClick={handleEditClick} 
                 disabled={disabled} 
                 className="p-1 text-blue-500 hover:text-blue-700 disabled:text-gray-300"
                 title="Edit Text"
               >
                 <PencilIcon className="h-4 w-4" />
               </button>
            )}
            {/* Delete button */} 
            <button 
               onClick={handleDeleteClick} 
               disabled={disabled} 
               className="p-1 text-red-500 hover:text-red-700 disabled:text-gray-300"
               title="Delete Item"
             >
               <TrashIcon className="h-4 w-4" />
             </button>
          </div>
        )}
      </div>

      {/* Expanded/Editing View */} 
      {(isExpanded || isEditing) && (
         <div className="mt-2 pt-2 border-t border-gray-200 w-full">
           {isEditing && onEditingTextChange ? (
             <div className="flex flex-col space-y-1">
                <textarea
                  value={editingText}
                  onChange={onEditingTextChange}
                  className="w-full p-1 border border-blue-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  rows={3}
                  autoFocus
                />
                <div className="flex justify-end space-x-1">
                  <button onClick={handleCancelEdit} className="p-1 text-gray-500 hover:text-gray-700" title="Cancel"><XMarkIcon className="h-4 w-4"/></button>
                  <button onClick={handleSaveEdit} className="p-1 text-green-500 hover:text-green-700" title="Save"><CheckIcon className="h-4 w-4"/></button>
                </div>
             </div>
           ) : (
              <div>
                {item.isFile && item.objectUrl && item.type?.startsWith('image/') ? (
                  <div className="text-center">
                    <img 
                      src={item.objectUrl} 
                      alt={item.display} 
                      className="max-w-full h-auto max-h-40 mx-auto rounded"
                    />
                    <p className="text-xs text-gray-600 mt-1">
                      {item.fullContent}
                    </p>
                  </div>
                ) : (
                  <pre className="text-xs text-gray-600 whitespace-pre-wrap break-words">
                    {item.fullContent}
                  </pre>
                )}
              </div>
           )}
         </div>
       )}
    </li>
  );
};

// Main component to render all sections
interface InputItemListProps extends Omit<ItemListSectionProps, 'items' | 'title' | 'itemType' | 'colorClass' | 'onClear'> {
  chainingItems: ItemDisplay[];
  commonItems: ItemDisplay[];
  items: ItemDisplay[];
  onClearChaining?: () => void; // Specific clear handler for Chaining items
  onClearCommon?: () => void;   // Specific clear handler for Common items
  onClearElement?: () => void;  // Specific clear handler for Element items
}

export const InputItemList: React.FC<InputItemListProps> = ({ 
  chainingItems, 
  commonItems, 
  items, 
  onClearChaining,
  onClearCommon,
  onClearElement,
  ...commonProps 
}) => {
  // Determine if any list has items to conditionally render the empty state differently
  const hasAnyItems = chainingItems.length > 0 || commonItems.length > 0 || items.length > 0;

  return (
    <div className="space-y-4">
      {/* Always render ItemListSection for each type */}
      <ItemListSection 
        title="Chaining Items"
        itemType="chaining" 
        items={chainingItems}
        colorClass="gray" 
        onClear={onClearChaining} // Pass the specific clear handler
        {...commonProps} 
      />
      <ItemListSection 
        title="Common Items" 
        itemType="common" 
        items={commonItems} 
        colorClass="purple" 
        onClear={onClearCommon} // Pass the specific clear handler
        {...commonProps} 
      />
      <ItemListSection 
        title="Element Items" // Changed title for clarity
        itemType="element" 
        items={items} 
        colorClass="orange" 
        onClear={onClearElement} // Pass the specific clear handler
        {...commonProps} 
      />
    </div>
  );
};

// Helper component to render one section of items
const ItemListSection: React.FC<ItemListSectionProps> = ({ 
  title, 
  itemType, 
  items, 
  colorClass, 
  onClear, // Receive the clear handler
  editingItemId, 
  ...otherProps 
}) => {
  const headerColor = itemType === 'chaining' ? 'text-gray-800' : `text-${colorClass}-800`;

  // Always render the section container and title
  return (
    <div className="space-y-2">
      {/* Section Header with Title and Optional Clear Button */}
      <div className={`flex justify-between items-center`}>
        <div className={`text-sm font-medium ${headerColor}`}>{title} ({items.length})</div>
        {/* Render clear button only if handler is provided and items exist */}
        {onClear && items.length > 0 && (
          <button 
            onClick={onClear} 
            className="p-0.5 text-gray-400 hover:text-red-500"
            title={`Clear ${title}`}
          >
            <TrashIcon className="h-3 w-3"/>
          </button>
        )}
      </div>
      {items.length > 0 ? (
        <ul className="space-y-1">
          {items.map((item, index) => (
            <ListItem 
              key={`${itemType}-${index}-${item.isFile ? 'file' : 'text'}`} 
              item={item} 
              itemType={itemType} 
              colorClass={colorClass} 
              isEditing={editingItemId === item.id} // Pass editing state
              {...otherProps} 
            />
          ))}
        </ul>
      ) : (
        <div className="text-center py-6 border border-dashed border-gray-300 bg-gray-50 rounded-md">
          <p className="text-sm text-gray-500">No items added yet</p>
        </div>
      )}
    </div>
  );
}; 