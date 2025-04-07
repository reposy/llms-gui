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
    handleTextChange,
    handleAddText,
    handleFileChange,
    handleDeleteItem,
    handleClearItems,
    handleToggleProcessingMode
  } = useInputNodeData({ nodeId, data });

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
          iterateEachRow={Boolean(data.iterateEachRow)}
          onToggle={handleToggleProcessingMode}
          showLabel={false}
          size="md"
        />
      </div>

      {/* Item Count Summary */}
      <InputSummaryBar
        itemCounts={itemCounts}
        iterateEachRow={Boolean(data.iterateEachRow)}
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

      {/* Processing mode explanation when there are multiple items */}
      {showIterateOption && (
        <div className="text-sm bg-gray-50 p-3 rounded-md">
          <p className="font-medium mb-1">
            {data.iterateEachRow ? "Foreach Mode" : "Batch Mode"}
          </p>
          <p className="text-xs text-gray-600">
            {data.iterateEachRow 
              ? "Each item will be sent separately to downstream nodes" 
              : "All items will be processed together as a batch"}
          </p>
        </div>
      )}
    </div>
  );
}; 