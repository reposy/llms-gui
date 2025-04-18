import React, { useCallback, useEffect, useMemo } from 'react';
import { InputNodeData, FileLikeObject } from '../../types/nodes';
import { useInputNodeData } from '../../hooks/useInputNodeData';
import { InputTextManagerSidebar } from '../input/InputTextManagerSidebar';
import { InputFileUploader } from '../input/InputFileUploader';
import { InputItemList } from '../input/InputItemList';
import { InputSummaryBar } from '../input/InputSummaryBar';
import { InputModeToggle } from '../input/InputModeToggle';

interface InputNodeConfigProps {
  nodeId: string;
  data: InputNodeData;
}

// Reusable label component
const ConfigLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label className="block text-sm font-medium text-gray-700 mb-1">
    {children}
  </label>
);

// Utility function to calculate item counts (consistent with InputNode.tsx)
const calculateItemCounts = (items: (string | FileLikeObject)[]) => {
  if (!items) return { fileCount: 0, textCount: 0, total: 0 };
  
  const fileCount = items.filter(item => typeof item !== 'string').length;
  const textCount = items.filter(item => typeof item === 'string').length;
  
  return {
    fileCount,
    textCount,
    total: items.length
  };
};

// Utility function to format items for display (consistent with InputNode.tsx)
const formatItemsForDisplay = (items: (string | FileLikeObject)[]) => {
  if (!items) return [];
  
  return items.map((item, index) => {
    if (typeof item === 'string') {
      return {
        id: `item-${index}`,
        index,
        display: item,
        type: 'text',
        isFile: false,
        originalItem: item
      };
    } else {
      // Assumes item is FileLikeObject
      return {
        id: `file-${index}`,
        index,
        display: item.file || 'Unnamed file',
        type: item.type,
        isFile: true,
        originalItem: item
      };
    }
  });
};

export const InputNodeConfig: React.FC<InputNodeConfigProps> = ({ nodeId }) => {
  const {
    items,
    textBuffer,
    iterateEachRow,
    handleTextChange,
    handleAddText,
    handleFileChange,
    handleDeleteItem,
    handleClearItems,
    handleToggleProcessingMode
  } = useInputNodeData({ nodeId });
  
  // Calculate derived state using useMemo and utility functions
  const itemCounts = useMemo(() => calculateItemCounts(items), [items]);
  const formattedItems = useMemo(() => formatItemsForDisplay(items), [items]);
  const showIterateOption = items.length > 1; // Determine if toggle should be shown

  // Debug: Log textBuffer changes (kept from original)
  useEffect(() => {
    console.log(`[InputNodeConfig] TextBuffer updated: "${textBuffer}" (length: ${textBuffer?.length || 0})`);
  }, [textBuffer]);

  // Debug wrapper for handleTextChange (kept from original)
  const debugHandleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    console.log('[InputNodeConfig] handleTextChange called with:', e.target.value);
    handleTextChange(e);
  }, [handleTextChange]);

  // Prevent keydown events from bubbling (kept from original)
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <div className="space-y-4">
      {/* Debug info (kept from original) */}
      {/* <div className="text-xs p-2 bg-gray-50 border border-gray-200 rounded">
        Debug: TextBuffer: "{textBuffer}" (Length: {textBuffer?.length || 0})
      </div> */}

      {/* Processing Mode toggle - Conditionally render based on item count */}
      {showIterateOption && (
        <div>
          <ConfigLabel>Processing Mode</ConfigLabel>
          <InputModeToggle 
            iterateEachRow={iterateEachRow}
            onToggle={handleToggleProcessingMode}
          />
        </div>
      )}

      {/* Item Count Summary - Uses calculated counts */}
      <InputSummaryBar
        itemCounts={itemCounts}
        iterateEachRow={iterateEachRow}
      />

      {/* Text Input (no changes) */}
      <div>
        <ConfigLabel>Add Text</ConfigLabel>
        <InputTextManagerSidebar
          textBuffer={textBuffer}
          onChange={debugHandleTextChange}
          onAdd={handleAddText}
          height="h-32"
          onKeyDown={handleKeyDown}
        />
      </div>
      
      {/* File Upload (no changes) */}
      <div>
        <ConfigLabel>Add Files</ConfigLabel>
        <InputFileUploader
          onUpload={handleFileChange}
          buttonLabel="Choose Files"
        />
      </div>
      
      {/* Items List - Use calculated counts and formatted items */}
      {formattedItems.length > 0 && (
        <div>
          <ConfigLabel>Input Items ({itemCounts.total})</ConfigLabel>
          <InputItemList 
            items={formattedItems}
            onDelete={handleDeleteItem}
            onClear={handleClearItems}
            showClear={true}
          />
        </div>
      )}
    </div>
  );
}; 