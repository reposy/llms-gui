import { useCallback, useMemo, ChangeEvent, useEffect } from 'react';
import { InputNodeData, FileLikeObject } from '../types/nodes';
import { useSyncedNodeField } from './synced/useSyncedNodeFieldZustand';
import { useRef } from 'react';

/**
 * Custom hook to manage InputNode state and operations using Zustand.
 * Centralizes logic for both InputNode and InputNodeConfig components
 * 
 * Refactored version using useSyncedNodeField hooks
 */
export const useInputNodeDataRefactored = ({ 
  nodeId
}: { 
  nodeId: string
}) => {
  // Use synced hooks for core node fields
  const [items, setItems, syncItemsToStore] = useSyncedNodeField<(string | FileLikeObject)[]>({
    nodeId,
    field: 'items',
    defaultValue: []
  });
  
  const [textBuffer, setTextBuffer, syncTextBufferToStore] = useSyncedNodeField<string>({
    nodeId,
    field: 'textBuffer',
    defaultValue: ''
  });
  
  const [iterateEachRow, setIterateEachRow, syncIterateToStore] = useSyncedNodeField<boolean>({
    nodeId,
    field: 'iterateEachRow',
    defaultValue: false
  });
  
  // Ref to track if a toggle was just initiated locally
  const hasToggledRef = useRef(false);
  
  // Derive file display info directly from items
  const { fileName, fileList } = useMemo(() => {
    const fileItems = items.filter((item: string | FileLikeObject): item is FileLikeObject => typeof item !== 'string');
    if (fileItems.length === 0) {
      return { fileName: null, fileList: [] };
    }
    const derivedFileList = fileItems.map(item => item.file);
    const derivedFileName = fileItems.length === 1
      ? derivedFileList[0]
      : `${fileItems.length} files selected`;
    return { fileName: derivedFileName, fileList: derivedFileList };
  }, [items]);

  /**
   * Handle changes initiated from config panel or external updates.
   * Updates local state immediately and triggers sync to store.
   */
  const handleConfigChange = useCallback((updates: Partial<InputNodeData>) => {
    let changed = false;
    if ('items' in updates && updates.items) {
      setItems(updates.items); // Update local state first
      syncItemsToStore(updates.items);
      changed = true;
    }
    
    if ('textBuffer' in updates && updates.textBuffer !== undefined) {
      setTextBuffer(updates.textBuffer); // Update local state first
      syncTextBufferToStore(updates.textBuffer);
      changed = true;
    }
    
    if ('iterateEachRow' in updates && updates.iterateEachRow !== undefined) {
      setIterateEachRow(updates.iterateEachRow); // Update local state first
      syncIterateToStore(updates.iterateEachRow);
      changed = true;
    }

    // Optional: log if no relevant changes were detected in the update object
    // if (!changed) {
    //   console.warn(`[InputNode ${nodeId}] handleConfigChange called with no relevant updates:`, updates);
    // }
  }, [nodeId, setItems, syncItemsToStore, setTextBuffer, syncTextBufferToStore, setIterateEachRow, syncIterateToStore]);

  /**
   * Handle text buffer changes - update local state and sync to store.
   */
  const handleTextChange = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
    const newText = event.target.value;
    setTextBuffer(newText);
    syncTextBufferToStore(newText);
  }, [setTextBuffer, syncTextBufferToStore]);

  /**
   * Handle adding text from buffer to items. Updates local state and syncs.
   */
  const handleAddText = useCallback(() => {
    const trimmedText = textBuffer.trim();
    if (!trimmedText) return;
    const updatedItems = [...items, trimmedText];
    setItems(updatedItems); // Update local state
    setTextBuffer(''); // Update local state
    syncItemsToStore(updatedItems);
    syncTextBufferToStore('');
  }, [textBuffer, items, setItems, setTextBuffer, syncItemsToStore, syncTextBufferToStore]);

  /**
   * Toggle Batch/Foreach processing mode. Updates local state and syncs.
   */
  const handleToggleProcessingMode = useCallback(() => {
    const newMode = !iterateEachRow;
    hasToggledRef.current = true;
    setIterateEachRow(newMode);
    syncIterateToStore(newMode);
  }, [iterateEachRow, setIterateEachRow, syncIterateToStore]);

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

    // Process all files
    const processFiles = async () => {
      try {
        // Create deep copy of current items to avoid reference issues
        const currentItems = [...items];
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
        
        // Update with new items
        syncItemsToStore(updatedItems);
        setItems(updatedItems);
      } catch (error) {
        console.error("Error reading files:", error);
      }
    };
    
    processFiles();
  }, [items, setItems, syncItemsToStore]);

  /**
   * Handle deletion of a specific item. Updates local state and syncs.
   */
  const handleDeleteItem = useCallback((index: number) => {
    if (items.length === 0) return;
    const updatedItems = [...items];
    updatedItems.splice(index, 1);
    
    // Update local state first
    setItems(updatedItems);
    // Sync changes to the store
    syncItemsToStore(updatedItems);
  }, [items, setItems, syncItemsToStore]);

  /**
   * Format items for display
   * Returns an array of formatted items with metadata for UI rendering
   */
  const formattedItems = useMemo(() => {
    if (items.length === 0) return [];
    
    // Use map for transformation
    return items.map((item: string | FileLikeObject, index: number) => {
      if (typeof item === 'string') {
        return {
          id: `item-${index}`,
          index,
          display: item, // Show the string content directly
          type: 'text',
          isFile: false,
          originalItem: item // Keep original for potential use
        };
      } else {
        // For FileLikeObject, display file info
        return {
          id: `file-${index}`,
          index,
          display: item.file || 'Unnamed file', // Show the file name
          type: item.type,
          isFile: true,
          originalItem: item // Keep original for potential use
        };
      }
    });
  }, [items]);

  /**
   * Count items by type
   * Returns counts of file items, text items, and total
   */
  const itemCounts = useMemo(() => {
    if (items.length === 0) {
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
  const showIterateOption = items.length > 1;

  const isDuplicate = (name: string) => {
    // Check if any item in the items array has the same name
    return items.some((item: string | FileLikeObject) => typeof item !== 'string' && item.file === name);
  };

  const handleItemUpdate = useCallback((index: number, updatedItem: string | FileLikeObject) => {
    const newItems = [...items];
    newItems[index] = updatedItem;
    setItems(newItems);
  }, [items, setItems]);

  const handleItemRemove = useCallback((index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
  }, [items, setItems]);

  const handleItemMove = useCallback((fromIndex: number, toIndex: number) => {
    const newItems = [...items];
    const [movedItem] = newItems.splice(fromIndex, 1);
    newItems.splice(toIndex, 0, movedItem);
    setItems(newItems);
  }, [items, setItems]);

  const combinedItems = useMemo(() => {
    // Combine items and textBuffer into a single array for rendering
    const bufferItems = textBuffer.split('\n').filter(line => line.trim() !== '');
    return [...items, ...bufferItems];
  }, [items, textBuffer]);

  // UseEffect to sync local state changes back to the store
  useEffect(() => {
    syncItemsToStore();
  }, [items, syncItemsToStore]);

  useEffect(() => {
    syncTextBufferToStore();
  }, [textBuffer, syncTextBufferToStore]);

  useEffect(() => {
    syncIterateToStore();
  }, [iterateEachRow, syncIterateToStore]);

  // Compute input structure for execution graph
  const inputStructure = useMemo(() => {
    return iterateEachRow
      ? combinedItems.map((item: string | FileLikeObject) => ({ type: typeof item === 'string' ? 'string' : 'file', value: item }))
      : [{ type: 'array', value: combinedItems }];
  }, [combinedItems, iterateEachRow]);

  return {
    // State
    items,
    textBuffer,
    iterateEachRow,
    fileName,
    fileList,
    
    // Derived values
    itemCounts,
    formattedItems,
    showIterateOption,
    
    // Handlers
    handleTextChange,
    handleAddText,
    handleFileChange,
    handleDeleteItem,
    handleToggleProcessingMode,
    handleConfigChange,
    handleItemUpdate,
    handleItemRemove,
    handleItemMove,
    inputStructure,
  };
}; 