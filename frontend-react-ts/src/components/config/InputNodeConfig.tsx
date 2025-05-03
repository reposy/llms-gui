// src/components/config/InputNodeConfig.tsx
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
  // data prop is no longer needed as data is fetched by the hook
  // data: InputNodeData;
}

// Reusable label component
const ConfigLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label className="block text-sm font-medium text-gray-700 mb-1">
    {children}
  </label>
);

// Utility function to calculate item counts (consistent with InputNode.tsx)
const calculateItemCounts = (items: (string | File)[]) => {
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
const formatItemsForDisplay = (items: (string | File)[]) => {
  if (!items) return [];
  
  return items.map((item, index) => {
    const baseItem = {
      id: `item-${index}-${typeof item === 'string' ? 'text' : 'file'}`,
      index,
      isFile: typeof item !== 'string',
      originalItem: item
    };
    if (typeof item === 'string') {
      return {
        ...baseItem,
        display: item,
        type: 'text',
      };
    } else {
      return {
        ...baseItem,
        display: item.name || 'Unnamed file',
        type: item.type,
      };
    }
  });
};

export const InputNodeConfig: React.FC<InputNodeConfigProps> = ({ nodeId }) => {
  const {
    chainingItems,
    commonItems,
    items,
    textBuffer,
    iterateEachRow,
    chainingUpdateMode,
    handleTextChange,
    handleAddText,
    handleFileChange,
    handleDeleteItem,
    handleClearItems,
    handleToggleProcessingMode,
    handleMoveItem,
    handleClearChainingItems,
    handleClearCommonItems,
    handleClearElementItems,
    handleUpdateChainingMode,
    editingItemId,
    editingText,
    handleStartEditingTextItem,
    handleEditingTextChange,
    handleFinishEditingTextItem,
    handleCancelEditingTextItem,
  } = useInputNodeData({ nodeId });
  
  // Format each list separately
  const formattedChainingItems = useMemo(() => formatItemsForDisplay(chainingItems || []), [chainingItems]);
  const formattedCommonItems = useMemo(() => formatItemsForDisplay(commonItems || []), [commonItems]);
  const formattedItems = useMemo(() => formatItemsForDisplay(items || []), [items]);

  // Calculate total count across relevant lists for summary
  const totalItemCount = (commonItems?.length || 0) + (items?.length || 0);
  const showIterateOption = totalItemCount > 1;

  // Text Input: Add buttons for Common and Element
  const handleAddTextToCommon = useCallback(() => handleAddText('common'), [handleAddText]);
  const handleAddTextToElement = useCallback(() => handleAddText('element'), [handleAddText]);

  // File Upload: Pass type directly
  const handleFileUploadToCommon = useCallback((event: React.ChangeEvent<HTMLInputElement>) => handleFileChange(event, 'common'), [handleFileChange]);
  const handleFileUploadToElement = useCallback((event: React.ChangeEvent<HTMLInputElement>) => handleFileChange(event, 'element'), [handleFileChange]);

  // Define delete handlers for each list type
  const handleDeleteChainingItem = useCallback((index: number) => handleDeleteItem(index, 'chaining'), [handleDeleteItem]);
  const handleDeleteCommonItem = useCallback((index: number) => handleDeleteItem(index, 'common'), [handleDeleteItem]);
  const handleDeleteElementItem = useCallback((index: number) => handleDeleteItem(index, 'element'), [handleDeleteItem]);

  // Define move handlers (only from chaining)
  const handleMoveToCommon = useCallback((index: number) => handleMoveItem(index, 'common'), [handleMoveItem]);
  const handleMoveToElement = useCallback((index: number) => handleMoveItem(index, 'element'), [handleMoveItem]);

  return (
    <div className="space-y-6 p-4">
      {/* Debug info (kept from original) */}
      {/* <div className="text-xs p-2 bg-gray-50 border border-gray-200 rounded">
        Debug: TextBuffer: "{textBuffer}" (Length: {textBuffer?.length || 0})
      </div> */}

      {/* Processing Mode toggle - Conditionally render based on item count */}
      {showIterateOption && (
        <div>
          <ConfigLabel>실행 모드 (Processing Mode)</ConfigLabel>
          <InputModeToggle 
            iterateEachRow={iterateEachRow}
            onToggle={handleToggleProcessingMode}
            option1Label="배치 (Batch)"
            option2Label="개별 반복 (ForEach)"
          />
        </div>
      )}

      {/* Chaining Update Mode Buttons (Replicating UI from InputNode.tsx) */}
      <div>
        <ConfigLabel>자동 입력 추가 방식 (Chained Input Behavior)</ConfigLabel>
        <div className="flex space-x-2 items-center mt-1">
          <button
            type="button"
            onClick={() => handleUpdateChainingMode('common')}
            className={`px-3 py-1 text-sm font-medium rounded-md transition-colors flex-1 ${chainingUpdateMode === 'common' ? 'bg-purple-100 text-purple-800 hover:bg-purple-200' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}
          >
            공통 항목 (Common)
          </button>
          <button
            type="button"
            onClick={() => handleUpdateChainingMode('element')}
            className={`px-3 py-1 text-sm font-medium rounded-md transition-colors flex-1 ${chainingUpdateMode === 'element' ? 'bg-orange-100 text-orange-800 hover:bg-orange-200' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}
          >
            개별 항목 (Element)
          </button>
          <button
            type="button"
            onClick={() => handleUpdateChainingMode('none')}
            className={`px-3 py-1 text-sm font-medium rounded-md transition-colors flex-1 ${chainingUpdateMode === 'none' ? 'bg-gray-400 text-white hover:bg-gray-500' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}
          >
            미적용 (None)
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {chainingUpdateMode === 'common' ? '이전 노드 출력이 자동으로 공통 항목에 추가됩니다.' :
           chainingUpdateMode === 'element' ? '이전 노드 출력이 자동으로 개별 항목에 추가됩니다.' :
           '이전 노드 출력이 자동으로 추가되지 않습니다.'}
        </p>
      </div>

      {/* Item Count Summary - Uses calculated counts */}
      <InputSummaryBar
        itemCounts={calculateItemCounts(items)}
        iterateEachRow={iterateEachRow}
      />

      {/* Text Input with Common/Element buttons */}
      <div>
        <ConfigLabel>텍스트 추가 (Add Text)</ConfigLabel>
        <InputTextManagerSidebar
          textBuffer={textBuffer}
          onChange={handleTextChange}
          height="h-24"
          commonButtonLabel="공통 목록에 추가"
          elementButtonLabel="개별 목록에 추가"
          onAddCommon={handleAddTextToCommon}
          onAddElement={handleAddTextToElement}
        />
      </div>
      
      {/* File Upload - Separate buttons */}
      <div>
        <ConfigLabel>파일 추가 (Add Files)</ConfigLabel>
        <div className="flex space-x-2">
          <InputFileUploader
            onUpload={handleFileUploadToCommon}
            buttonLabel="공통으로 추가"
            className="flex-1"
          />
          <InputFileUploader
            onUpload={handleFileUploadToElement}
            buttonLabel="개별로 추가"
            className="flex-1"
          />
        </div>
      </div>

      <hr className="my-4"/>

      {/* Single InputItemList Call */}
      <InputItemList 
          // Pass all three formatted lists
          chainingItems={formattedChainingItems}
          commonItems={formattedCommonItems}
          items={formattedItems} // Represents element items
          
          // Pass common props (handlers etc.)
          onDeleteItem={handleDeleteItem} // Pass the generic handler
          onMoveItem={handleMoveItem} // Pass the generic handler
          
          // Pass editing handlers
          editingItemId={editingItemId}
          editingText={editingText}
          onStartEditing={handleStartEditingTextItem}
          onEditingTextChange={handleEditingTextChange}
          onFinishEditing={handleFinishEditingTextItem}
          onCancelEditing={handleCancelEditingTextItem}
          
          // Pass clear handlers if available from hook
          // onClearChaining={handleClearChainingItems}
          // onClearCommon={handleClearCommonItems}
          // onClearElement={handleClearElementItems}
      />

    </div>
  );
}; 