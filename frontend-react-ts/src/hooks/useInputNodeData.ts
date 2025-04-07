import { useState, useEffect, useCallback, useMemo, ChangeEvent } from 'react';
import { useDispatch } from 'react-redux';
import { updateNodeData } from '../store/flowSlice';
import { InputNodeData, FileLikeObject } from '../types/nodes';

/**
 * Custom hook to manage InputNode state and operations
 * Centralizes logic for both InputNode and InputNodeConfig components
 */
export const useInputNodeData = ({ 
  nodeId, 
  data 
}: { 
  nodeId: string, 
  data: InputNodeData 
}) => {
  const dispatch = useDispatch();
  
  // Local state
  const [textBuffer, setTextBuffer] = useState(data.textBuffer || '');
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileList, setFileList] = useState<string[]>([]);
  
  // Sync local state with Redux data changes
  useEffect(() => {
    // Update text buffer from Redux data
    setTextBuffer(data.textBuffer || '');
    
    // Update file display info based on items
    if (data.items && data.items.length > 0) {
      const fileItems = data.items.filter(item => typeof item !== 'string');
      if (fileItems.length > 0) {
        setFileList(fileItems.map(item => (item as FileLikeObject).file));
        setFileName(fileItems.length === 1 
          ? (fileItems[0] as FileLikeObject).file 
          : `${fileItems.length} files selected`);
      } else {
        setFileName(null);
        setFileList([]);
      }
    } else {
      setFileName(null);
      setFileList([]);
    }
  }, [data.textBuffer, data.items]);

  /**
   * Update node data in Redux
   */
  const handleConfigChange = useCallback((updates: Partial<InputNodeData>) => {
    dispatch(updateNodeData({
      nodeId,
      data: { ...data, ...updates }
    }));
  }, [dispatch, nodeId, data]);

  /**
   * Handle text buffer changes (doesn't modify items, only the buffer)
   */
  const handleTextChange = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
    const newText = event.target.value;
    setTextBuffer(newText);
    handleConfigChange({ textBuffer: newText });
  }, [handleConfigChange]);

  /**
   * Handle adding text from buffer to items
   */
  const handleAddText = useCallback(() => {
    if (!textBuffer.trim()) return;
    
    // Keep existing items and add the new text as a separate item
    const existingItems = data.items || [];
    const updatedItems = [...existingItems, textBuffer.trim()];
    
    // Update items and clear the text buffer
    handleConfigChange({ 
      items: updatedItems,
      textBuffer: ''
    });
    
    // Clear the text buffer
    setTextBuffer('');
  }, [textBuffer, data.items, handleConfigChange]);

  /**
   * Toggle Batch/Foreach processing mode
   */
  const handleToggleProcessingMode = useCallback(() => {
    handleConfigChange({ iterateEachRow: !data.iterateEachRow });
  }, [handleConfigChange, data.iterateEachRow]);

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
  const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
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
        // Keep existing items (both text and files)
        const existingItems = data.items || [];
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
        
        // Append new files to existing items
        const updatedItems = [...existingItems, ...newFiles];
        
        handleConfigChange({ items: updatedItems });
      } catch (error) {
        console.error("Error reading files:", error);
        setFileName('Error reading files');
        setFileList(['Error reading files']);
      }
    };
    
    processFiles();
  }, [handleConfigChange, data.items]);

  /**
   * Handle deletion of a specific item
   */
  const handleDeleteItem = useCallback((index: number) => {
    if (!data.items) return;
    
    const updatedItems = [...data.items];
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
    
    handleConfigChange({ 
      items: updatedItems,
      iterateEachRow: updatedItems.length <= 1 ? false : data.iterateEachRow
    });
  }, [data.items, handleConfigChange, data.iterateEachRow]);

  /**
   * Handle clearing all items
   */
  const handleClearItems = useCallback(() => {
    handleConfigChange({ 
      items: [],
      iterateEachRow: false
    });
    setFileName(null);
    setFileList([]);
  }, [handleConfigChange]);

  /**
   * Format items for display
   * Returns an array of formatted items with metadata for UI rendering
   */
  const formattedItems = useMemo(() => {
    if (!data.items || data.items.length === 0) return [];
    
    return data.items.map((item, index) => {
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
          display: item.file,
          type: item.type,
          isFile: true,
        };
      }
    });
  }, [data.items]);

  /**
   * Count items by type
   * Returns counts of file items, text items, and total
   */
  const itemCounts = useMemo(() => {
    if (!data.items || data.items.length === 0) {
      return { fileCount: 0, textCount: 0, total: 0 };
    }
    
    const fileCount = data.items.filter(item => typeof item !== 'string').length;
    const textCount = data.items.filter(item => typeof item === 'string').length;
    
    return {
      fileCount,
      textCount,
      total: fileCount + textCount
    };
  }, [data.items]);

  // Determine whether to show foreach option (only when multiple items exist)
  const showIterateOption = data.items && data.items.length > 1;

  return {
    // State
    textBuffer,
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
    handleClearItems,
    handleToggleProcessingMode,
    handleConfigChange
  };
}; 