import React, { useCallback } from 'react';
import { InputNodeData } from '../../types/nodes';
import { useInputNodeData } from '../../hooks/useInputNodeData';
import { InputTextManager } from '../input/InputTextManager';
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

export const InputNodeConfig: React.FC<InputNodeConfigProps> = ({ nodeId, data }) => {
  // Use shared input node hook for state and handlers
  const {
    textBuffer,
    itemCounts,
    formattedItems,
    showIterateOption,
    iterateEachRow,
    handleTextChange,
    handleAddText,
    handleFileChange,
    handleDeleteItem,
    handleClearItems,
    handleToggleProcessingMode
  } = useInputNodeData({ nodeId });

  // Prevent keydown events from bubbling to parent components
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <div className="space-y-4">
      {/* Processing Mode toggle */}
      <div>
        <ConfigLabel>Processing Mode</ConfigLabel>
        <InputModeToggle 
          iterateEachRow={iterateEachRow}
          onToggle={handleToggleProcessingMode}
          showLabel={false}
          size="md"
          layout="column"
          showDescription={true}
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
        <InputTextManager
          textBuffer={textBuffer}
          onChange={handleTextChange}
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