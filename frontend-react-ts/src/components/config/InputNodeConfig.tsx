// src/components/config/InputNodeConfig.tsx
import React, { useCallback, useEffect, useMemo } from 'react';
import { InputNodeData } from '../../types/nodes';
import { useInputNodeData } from '../../hooks/useInputNodeData';
import { InputTextManagerSidebar } from '../input/InputTextManagerSidebar';
import { InputFileUploader } from '../input/InputFileUploader';
import { InputItemList } from '../input/InputItemList';
import { InputSummaryBar } from '../input/InputSummaryBar';
import { InputModeToggle } from '../input/InputModeToggle';
import { formatItemsForDisplay } from '../../utils/ui/formatInputItems'; // Import the utility function
import clsx from 'clsx';
import { InputNodeContent } from '../../types/nodes';
import { useNodeContent } from '../../store/useNodeContentStore';

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

// Utility function to format items for display - REMOVED
// const formatItemsForDisplay = (rawItems: (string | File)[]) => { ... };

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
    handleUpdateChainingMode,
    handleMoveChainingItem: handleMoveItem,
    handleStartEditingTextItem,
    handleEditingTextChange,
    handleFinishEditingTextItem,
    handleCancelEditingTextItem,
    editingItemId,
    editingText,
    handleClearChainingItems,
    handleClearCommonItems,
    handleClearElementItems,
  } = useInputNodeData({ nodeId });
  
  const { content, updateContent } = useNodeContent<InputNodeContent>(nodeId, 'input');

  // Explicitly type the mode for clarity within this component scope
  const currentMode = chainingUpdateMode as 'common' | 'replaceCommon' | 'element' | 'none' | 'replaceElement';

  // Format each list separately using the imported utility function
  const formattedChainingItems = useMemo(() => formatItemsForDisplay(chainingItems || [], 'config-chaining'), [chainingItems]);
  const formattedCommonItems = useMemo(() => formatItemsForDisplay(commonItems || [], 'config-common'), [commonItems]);
  const formattedItems = useMemo(() => formatItemsForDisplay(items || [], 'config-element'), [items]);

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

  // Handler for Accumulation Mode change
  const handleAccumulationModeChange = (value: 'always' | 'oncePerContext' | 'none') => {
    if (value) { // Ensure a value is selected
      updateContent({ accumulationMode: value });
    }
  };

  return (
    <div className="space-y-6 p-4">
      {/* Debug info (kept from original) */}
      {/* <div className="text-xs p-2 bg-gray-50 border border-gray-200 rounded">
        Debug: TextBuffer: "{textBuffer}" (Length: {textBuffer?.length || 0})
      </div> */}

      {/* Processing Mode Toggle - Use two distinct buttons */}
      <div>
        <ConfigLabel>Processing Mode</ConfigLabel>
        <div className="flex justify-between space-x-2">
            {/* Batch Button */}
            <button
                type="button"
                onClick={() => iterateEachRow && handleToggleProcessingMode()} // Trigger when in ForEach mode
                className={clsx(
                    `px-3 py-1 text-sm font-medium rounded-md transition-colors flex-1`,
                    !iterateEachRow ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                )}
                disabled={!iterateEachRow} // Disable if active
            >
                Batch
            </button>
            {/* ForEach Button */}
            <button
                type="button"
                onClick={() => !iterateEachRow && handleToggleProcessingMode()} // Trigger when in Batch mode
                className={clsx(
                    `px-3 py-1 text-sm font-medium rounded-md transition-colors flex-1`,
                    iterateEachRow ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                )}
                disabled={iterateEachRow} // Disable if active
            >
                ForEach
            </button>
        </div>
      </div>

      {/* Chaining Update Mode Buttons (Replicating UI from InputNode.tsx) */}
      <div>
        <ConfigLabel>Chained Input Behavior</ConfigLabel>
        <div className="flex flex-wrap gap-1.5 mt-1"> {/* Reduced gap */} 
          <button
            type="button"
            onClick={() => handleUpdateChainingMode('common')}
            className={clsx(
              `px-2 py-1 text-xs font-medium rounded-md transition-colors flex-grow`, // Use flex-grow
              currentMode === 'common' ? 'bg-purple-100 text-purple-800 hover:bg-purple-200' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
            )}
            title="Append chained input to Common Items"
          >
            Common (App)
          </button>
          <button
            type="button"
            onClick={() => handleUpdateChainingMode('replaceCommon')}
            className={clsx(
              `px-2 py-1 text-xs font-medium rounded-md transition-colors flex-grow`,
              currentMode === 'replaceCommon' ? 'bg-purple-400 text-white hover:bg-purple-500' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
            )}
            title="Replace Common Items with chained input"
          >
            Common (Rep)
          </button>
          <button
            type="button"
            onClick={() => handleUpdateChainingMode('element')}
            className={clsx(
              `px-2 py-1 text-xs font-medium rounded-md transition-colors flex-grow`,
              currentMode === 'element' ? 'bg-orange-100 text-orange-800 hover:bg-orange-200' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
            )}
            title="Append chained input to Element Items"
          >
            Element (App)
          </button>
          {/* Added Replace Element button */}
          <button
            type="button"
            onClick={() => handleUpdateChainingMode('replaceElement')}
            className={clsx(
              `px-2 py-1 text-xs font-medium rounded-md transition-colors flex-grow`,
              currentMode === 'replaceElement' ? 'bg-orange-400 text-white hover:bg-orange-500' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
            )}
            title="Replace Element Items with chained input"
          >
            Element (Rep)
          </button>
          <button
            type="button"
            onClick={() => handleUpdateChainingMode('none')}
            className={clsx(
              `px-2 py-1 text-xs font-medium rounded-md transition-colors flex-grow`,
              currentMode === 'none' ? 'bg-gray-400 text-white hover:bg-gray-500' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
            )}
            title="Do not automatically add chained input"
          >
            None
          </button>
        </div>
      </div>

      {/* New Accumulation Mode Section */}
      {/* Only show this if chaining mode affects common items */}
      {/* Updated condition: Show if chainingUpdateMode is NOT 'none' */}
      {(content?.chainingUpdateMode !== 'none') && (
        <div>
          <div className="block text-sm font-medium text-gray-700 mb-1">
            Accumulation Mode
          </div>
          <div className="flex space-x-2 mt-1">
            <button
              type="button"
              onClick={() => handleAccumulationModeChange('always')}
              className={clsx(
                `px-3 py-1 text-xs font-medium rounded-md transition-colors flex-1`,
                (content?.accumulationMode === 'always' || !content?.accumulationMode) ? 'bg-blue-100 text-blue-800 hover:bg-blue-200' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
              )}
              title="Always add chained input to relevant items (Common/Element) on each execution"
            >
              Always
            </button>
            <button
              type="button"
              onClick={() => handleAccumulationModeChange('oncePerContext')}
              className={clsx(
                `px-3 py-1 text-xs font-medium rounded-md transition-colors flex-1`,
                content?.accumulationMode === 'oncePerContext' ? 'bg-green-100 text-green-800 hover:bg-green-200' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
              )}
              title="Add chained input to relevant items only once per execution context (e.g., once per loop)"
            >
              Once
            </button>
            <button
              type="button"
              onClick={() => handleAccumulationModeChange('none')}
              className={clsx(
                `px-3 py-1 text-xs font-medium rounded-md transition-colors flex-1`,
                content?.accumulationMode === 'none' ? 'bg-gray-400 text-white hover:bg-gray-500' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
              )}
              title="Do not add chained input to internal items; only pass through"
            >
              None
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Controls if/when chained input is added to this node's internal items (Common/Element). 'None' passes input through without adding it internally.
          </p>
        </div>
      )}

      {/* Item Count Summary - Uses calculated counts */}
      <InputSummaryBar
        itemCounts={calculateItemCounts(items)}
        iterateEachRow={iterateEachRow}
      />

      {/* Text Input with Common/Element buttons */}
      <div>
        <ConfigLabel>Add Text</ConfigLabel>
        <textarea
          value={textBuffer}
          onChange={handleTextChange}
          placeholder="Enter text..."
          className={`w-full h-24 p-2 border border-gray-300 rounded-md bg-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent nodrag nowheel`}
          onKeyDown={(e) => e.stopPropagation()} // Prevent keydown propagation
        />
        <div className="flex justify-end space-x-2 mt-2">
          <button
            onClick={handleAddTextToCommon}
            disabled={!textBuffer?.trim()}
            className={`px-3 py-1 text-xs font-medium rounded ${!textBuffer?.trim() ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-purple-100 text-purple-800 hover:bg-purple-200'}`}
            title={!textBuffer?.trim() ? "Enter text to add" : "Add to Common Items"}
          >
            Add Common
          </button>
          <button
            onClick={handleAddTextToElement}
            disabled={!textBuffer?.trim()}
            className={`px-3 py-1 text-xs font-medium rounded ${!textBuffer?.trim() ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-orange-100 text-orange-800 hover:bg-orange-200'}`}
            title={!textBuffer?.trim() ? "Enter text to add" : "Add to Element Items"}
          >
            Add Element
          </button>
        </div>
      </div>
      
      {/* File Upload - Separate buttons */}
      <div>
        <ConfigLabel>Add Files</ConfigLabel>
        <div className="flex space-x-2">
          <InputFileUploader
            onUpload={handleFileUploadToCommon}
            buttonLabel="Common"
          />
          <InputFileUploader
            onUpload={handleFileUploadToElement}
            buttonLabel="Element"
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
          onMoveItem={handleMoveItem} // Pass the aliased handler
          
          // Pass editing handlers
          editingItemId={editingItemId}
          editingText={editingText}
          onStartEditing={handleStartEditingTextItem}
          onEditingTextChange={handleEditingTextChange}
          onFinishEditing={handleFinishEditingTextItem}
          onCancelEditing={handleCancelEditingTextItem}
          
          // Pass clear handlers
          onClearChaining={handleClearChainingItems}
          onClearCommon={handleClearCommonItems}
          onClearElement={handleClearElementItems}
      />

    </div>
  );
}; 