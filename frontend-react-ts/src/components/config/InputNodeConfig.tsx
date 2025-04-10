import React, { useCallback } from 'react';
import { InputNodeData } from '../../types/nodes';
import { useInputNodeData } from '../../hooks/useInputNodeData';
import { InputTextManager } from '../input/InputTextManager';
import { InputFileUploader } from '../input/InputFileUploader';
import { InputItemList } from '../input/InputItemList';
import { InputSummaryBar } from '../input/InputSummaryBar';
import { InputModeToggle } from '../input/InputModeToggle';
import { Switch } from '@headlessui/react';

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
    executeInParallel,
    handleTextChange,
    handleAddText,
    handleFileChange,
    handleDeleteItem,
    handleClearItems,
    handleToggleProcessingMode,
    handleToggleParallelExecution
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
        />
      </div>

      {/* Parallel Execution toggle (only shown when iterateEachRow is true) */}
      {iterateEachRow && (
        <div>
          <ConfigLabel>Execution Mode</ConfigLabel>
          <div className="flex items-center space-x-2">
            <Switch
              checked={executeInParallel}
              onChange={handleToggleParallelExecution}
              className={`${
                executeInParallel ? 'bg-blue-600' : 'bg-gray-200'
              } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
            >
              <span
                className={`${
                  executeInParallel ? 'translate-x-6' : 'translate-x-1'
                } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
              />
            </Switch>
            <span className="text-sm">
              {executeInParallel ? 'Parallel Execution' : 'Sequential Execution'}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {executeInParallel 
              ? 'Execute all rows in parallel (faster but less deterministic)' 
              : 'Execute one row at a time (slower but more reliable)'}
          </p>
        </div>
      )}

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