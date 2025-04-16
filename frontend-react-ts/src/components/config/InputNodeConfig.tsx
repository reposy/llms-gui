import React, { useCallback, useEffect, useMemo } from 'react';
import { InputNodeData } from '../../types/nodes';
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

/**
 * Calculate item counts for display
 */
const useItemCounts = (items: string[]) => {
  return useMemo(() => {
    // File count is determined by file extensions
    const fileCount = items.filter(item => {
      return typeof item === 'string' && 
        /\.(jpg|jpeg|png|gif|bmp|txt|pdf|doc|docx)$/i.test(item);
    }).length;
    
    const textCount = items.length - fileCount;
    
    return {
      fileCount,
      textCount,
      total: items.length
    };
  }, [items]);
};

/**
 * Format items for display
 */
const useFormattedItems = (items: string[]) => {
  return useMemo(() => {
    return items.map((item) => {
      // Add file icon for file paths
      if (typeof item === 'string' && 
          /\.(jpg|jpeg|png|gif|bmp|txt|pdf|doc|docx)$/i.test(item)) {
        return `📄 ${item}`;
      }
      return item;
    });
  }, [items]);
};

export const InputNodeConfig: React.FC<InputNodeConfigProps> = ({ nodeId, data }) => {
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
  
  // Use the local hooks for the removed functionality
  const itemCounts = useItemCounts(items);
  const formattedItems = useFormattedItems(items);
  const showIterateOption = true; // This was a constant value in the original

  // Debug: Log what's happening with textBuffer
  useEffect(() => {
    console.log(`[InputNodeConfig] TextBuffer updated: "${textBuffer}" (length: ${textBuffer?.length || 0})`);
  }, [textBuffer]);

  // Debug wrapper for handleTextChange
  const debugHandleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    console.log('[InputNodeConfig] handleTextChange called with:', e.target.value);
    handleTextChange(e);
    // Double-check if textBuffer is actually updated after the handleTextChange call
    setTimeout(() => {
      console.log('[InputNodeConfig] After handleTextChange, textBuffer is now:', textBuffer);
    }, 0);
  }, [handleTextChange, textBuffer]);

  // Prevent keydown events from bubbling to parent components
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <div className="space-y-4">
      {/* Debug info */}
      <div className="text-xs p-2 bg-gray-50 border border-gray-200 rounded">
        Debug: TextBuffer: "{textBuffer}" (Length: {textBuffer?.length || 0})
      </div>

      {/* Processing Mode toggle */}
      <div>
        <ConfigLabel>Processing Mode</ConfigLabel>
        <InputModeToggle 
          iterateEachRow={iterateEachRow}
          onToggle={handleToggleProcessingMode}
        />
      </div>

      {/* Item Count Summary */}
      <InputSummaryBar
        itemCounts={itemCounts}
        iterateEachRow={iterateEachRow}
      />

      {/* Text Input */}
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
      
      {/* File Upload */}
      <div>
        <ConfigLabel>Add Files</ConfigLabel>
        <InputFileUploader
          onUpload={handleFileChange}
          buttonLabel="Choose Files"
        />
      </div>
      
      {/* Items List */}
      {formattedItems.length > 0 && (
        <div>
          <ConfigLabel>Input Items ({formattedItems.length})</ConfigLabel>
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