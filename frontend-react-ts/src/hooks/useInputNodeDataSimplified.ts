import { useCallback, useMemo, ChangeEvent, useRef, useEffect } from 'react';
import { useDispatch, useStore } from 'react-redux';
import { updateNodeData } from '../store/flowSlice';
import { InputNodeData, FileLikeObject } from '../types/nodes';
import { cloneDeep } from 'lodash';
import { RootState } from '../store/store';
import { useSyncedNodeFields } from './synced/useSyncedNodeFields';
import { useState } from 'react';

/**
 * Custom hook to manage InputNode state and operations, reading directly from Redux store.
 * Centralizes logic for both InputNode and InputNodeConfig components
 * 
 * Simplified version using useSyncedNodeFields hook
 */
export const useInputNodeDataSimplified = ({ 
  nodeId
}: { 
  nodeId: string
}) => {
  const dispatch = useDispatch();
  const store = useStore<RootState>();
  
  // Track the current node ID to detect changes
  const currentNodeIdRef = useRef(nodeId);
  
  // Use synced fields hook for core node data
  const { 
    values, 
    setValues, 
    syncToStore 
  } = useSyncedNodeFields({
    nodeId,
    fields: {
      items: [] as (string | FileLikeObject)[],
      textBuffer: '',
      iterateEachRow: false
    }
  });
  
  // Extract values for easier access
  const { items, textBuffer, iterateEachRow } = values;
  
  // Additional UI state (not synced to Redux)
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileList, setFileList] = useState<string[]>([]);
  
  // Reset UI state when node changes
  useEffect(() => {
    if (currentNodeIdRef.current !== nodeId) {
      console.log(`[useInputNodeDataSimplified] Node changed from ${currentNodeIdRef.current} to ${nodeId}, resetting UI state`);
      setFileName(null);
      setFileList([]);
      currentNodeIdRef.current = nodeId;
    }
  }, [nodeId]);
  
  // Ref to track if a toggle was just initiated locally
  const hasToggledRef = useRef(false);
  
  // Update file display info when items change
  useEffect(() => {
    if (!items || items.length === 0) {
      setFileName(null);
      setFileList([]);
      return;
    }
    
    const fileItems = items.filter(item => typeof item !== 'string');
    if (fileItems.length > 0) {
      setFileList(fileItems.map(item => (item as FileLikeObject).file));
      setFileName(fileItems.length === 1 
        ? (fileItems[0] as FileLikeObject).file 
        : `${fileItems.length} files selected`);
    } else {
      setFileName(null);
      setFileList([]);
    }
  }, [items]);

  /**
   * Update node data in Redux while ensuring state consistency
   * Always maintains ALL state properties to prevent data loss
   */
  const handleConfigChange = useCallback((updates: Partial<InputNodeData>) => {
    // 1. Get the absolute latest state from Redux store
    const state = store.getState();
    const latestNode = state.flow.nodes.find(n => n.id === nodeId);
    
    if (!latestNode) {
      console.warn(`[useInputNodeDataSimplified] Node ${nodeId} not found in store, skipping update`);
      return;
    }
    
    const latestData = (latestNode.data || {}) as InputNodeData; 

    // 2. Create the complete update object based on the LATEST data
    const completeUpdate: InputNodeData = {
      ...latestData, 
      ...updates,     
      items: 'items' in updates ? updates.items : latestData.items,
      textBuffer: 'textBuffer' in updates ? updates.textBuffer : latestData.textBuffer,
      iterateEachRow: 'iterateEachRow' in updates ? updates.iterateEachRow : latestData.iterateEachRow,
      type: latestData.type || 'input', 
      label: ('label' in updates ? updates.label : latestData.label) ?? '',
    };
    
    // 3. Dispatch the update with the correctly merged data
    dispatch(updateNodeData({
      nodeId,
      data: completeUpdate
    }));
    
    // 4. Update local state immediately based on the intended updates
    const stateUpdates: Partial<typeof values> = {};
    
    if ('items' in updates && updates.items) {
      stateUpdates.items = updates.items;
    }
    if ('textBuffer' in updates && updates.textBuffer !== undefined) {
      stateUpdates.textBuffer = updates.textBuffer || '';
    }
    if ('iterateEachRow' in updates && updates.iterateEachRow !== undefined) {
      stateUpdates.iterateEachRow = Boolean(updates.iterateEachRow);
    }
    
    if (Object.keys(stateUpdates).length > 0) {
      setValues(stateUpdates);
    }
  }, [dispatch, nodeId, store, setValues]);

  /**
   * Handle text buffer changes - directly update both local and Redux state
   * Always preserves all other state properties
   */
  const handleTextChange = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
    const newText = event.target.value;
    handleConfigChange({ 
      textBuffer: newText,
      items: [...items],
      iterateEachRow
    });
  }, [handleConfigChange, items, iterateEachRow]);

  /**
   * Handle adding text from buffer to items - preserves entire text as one item
   */
  const handleAddText = useCallback(() => {
    const trimmedText = textBuffer.trim();
    if (!trimmedText) return;
    const updatedItems = [...items, trimmedText];
    handleConfigChange({ 
      items: updatedItems,
      textBuffer: '',
      iterateEachRow: iterateEachRow
    });
  }, [textBuffer, items, handleConfigChange, iterateEachRow]);

  /**
   * Toggle Batch/Foreach processing mode while preserving all items and text
   * Uses lodash cloneDeep for proper deep copying of complex objects
   */
  const handleToggleProcessingMode = useCallback(() => {
    const itemsCopy = cloneDeep(items);
    const newMode = !iterateEachRow;
    hasToggledRef.current = true;
    handleConfigChange({ 
      iterateEachRow: newMode,
      items: itemsCopy,
      textBuffer: textBuffer
    });
  }, [handleConfigChange, items, textBuffer, iterateEachRow]);

  /**
   * Helper function to read file as text
   */
  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });
  };

  /**
   * Handle file input change
   */
  const handleFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;
    const files = Array.from(event.target.files);
    const fileCount = files.length;
    const fileNames = fileCount === 1 
      ? files[0].name 
      : `${fileCount} files selected`;
      
    // Store individual file names for display
    const fileNameList = files.map(file => file.name);
    setFileList(fileNameList);
    setFileName(fileNames);
    
    // Process all files
    const processFiles = async () => {
      try {
        // Create deep copy of current items to avoid reference issues
        const currentItems = items ? [...items] : [];
        const newFiles: FileLikeObject[] = [];
        
        for (const file of files) {
          // Create FileLikeObject for each file
          const fileObj: FileLikeObject = {
            file: file.name,
            type: file.type
          };
          
          // For text files, read content and add to items
          if (file.type.startsWith('text/')) {
            const fileContent = await readFileAsText(file);
            fileObj.content = fileContent;
          }
          
          newFiles.push(fileObj);
        }
        
        // Use current items to preserve all existing content
        const updatedItems = [...currentItems, ...newFiles];
        
        // Update with new items while preserving ALL state
        handleConfigChange({ 
          items: updatedItems,
          textBuffer: textBuffer,
          iterateEachRow: iterateEachRow
        });
      } catch (error) {
        console.error("Error reading files:", error);
        setFileName('Error reading files');
        setFileList(['Error reading files']);
      }
    };
    
    processFiles();
  }, [handleConfigChange, items, textBuffer, iterateEachRow]);

  /**
   * Handle deletion of a specific item
   */
  const handleDeleteItem = useCallback((index: number) => {
    if (!items || items.length === 0) return;
    const updatedItems = [...items];
    updatedItems.splice(index, 1);
    
    // Update fileName and fileList if needed based on remaining file items
    const fileItems = updatedItems.filter(item => typeof item !== 'string');
    if (fileItems.length === 0) {
      setFileName(null);
      setFileList([]);
    } else {
      setFileList(fileItems.map(item => 
        typeof item !== 'string' ? item.file : ''
      ).filter(Boolean));
      
      setFileName(fileItems.length === 1 
        ? (fileItems[0] as FileLikeObject).file 
        : `${fileItems.length} files selected`);
    }
    
    // Update with new items while preserving ALL state
    handleConfigChange({ 
      items: updatedItems,
      iterateEachRow: updatedItems.length <= 1 ? false : iterateEachRow,
      textBuffer: textBuffer
    });
  }, [items, handleConfigChange, iterateEachRow, textBuffer]);

  /**
   * Handle clearing all items
   */
  const handleClearItems = useCallback(() => {
    handleConfigChange({ items: [], iterateEachRow: false, textBuffer: textBuffer });
    setFileName(null);
    setFileList([]);
  }, [handleConfigChange, textBuffer]);

  /**
   * Format items for display
   * Returns an array of formatted items with metadata for UI rendering
   */
  const formattedItems = useMemo(() => {
    if (!items || items.length === 0) return [];
    
    return items.map((item, index) => {
      if (typeof item === 'string') {
        return {
          id: `item-${index}`,
          index,
          display: item,
          type: 'text',
          isFile: false,
        };
      } else {
        return {
          id: `file-${index}`,
          index,
          display: item.file || item.type || 'Unnamed file',
          type: item.type,
          isFile: true,
        };
      }
    });
  }, [items]);

  /**
   * Count items by type
   * Returns counts of file items, text items, and total
   */
  const itemCounts = useMemo(() => {
    if (!items || items.length === 0) {
      return { fileCount: 0, textCount: 0, total: 0 };
    }
    
    const fileCount = items.filter(item => typeof item !== 'string').length;
    const textCount = items.filter(item => typeof item === 'string').length;
    
    return {
      fileCount,
      textCount,
      total: fileCount + textCount
    };
  }, [items]);

  // Determine whether to show foreach option (only when multiple items exist)
  const showIterateOption = items && items.length > 1;

  return {
    // State
    textBuffer,
    fileName,
    fileList,
    iterateEachRow,
    
    // Derived values
    itemCounts,
    formattedItems,
    showIterateOption,
    
    // Handlers
    handleTextChange,
    handleAddText,
    handleFileChange,
    handleDeleteItem,
    handleClearItems,
    handleToggleProcessingMode,
    handleConfigChange
  };
}; 