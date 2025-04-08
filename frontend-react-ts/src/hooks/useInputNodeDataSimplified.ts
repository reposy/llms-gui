import { useCallback, useMemo, ChangeEvent, useRef, useEffect } from 'react';
import { cloneDeep } from 'lodash';
import { InputNodeData, FileLikeObject } from '../types/nodes';
import { useState } from 'react';
import { useFlowStructureStore } from '../store/useFlowStructureStore';

/**
 * Custom hook to manage InputNode state and operations, using Zustand store.
 * Centralizes logic for both InputNode and InputNodeConfig components
 * 
 * Simplified version using useSyncedNodeFields hook
 */
export const useInputNodeDataSimplified = ({ 
  nodeId
}: { 
  nodeId: string
}) => {
  // Use Zustand hooks
  const { updateNode } = useFlowStructureStore(state => ({
    updateNode: state.updateNode
  }));
  
  const node = useFlowStructureStore(
    state => state.nodes.find(n => n.id === nodeId)
  );
  
  // Track the current node ID to detect changes
  const currentNodeIdRef = useRef(nodeId);
  
  // Use local state for core node data
  const [items, setItems] = useState<(string | FileLikeObject)[]>([]);
  const [textBuffer, setTextBuffer] = useState('');
  const [iterateEachRow, setIterateEachRow] = useState(false);
  
  // Initialize state from node data
  useEffect(() => {
    if (node?.data) {
      const data = node.data as InputNodeData;
      setItems(data.items || []);
      setTextBuffer(data.textBuffer || '');
      setIterateEachRow(data.iterateEachRow || false);
    }
  }, [node]);
  
  // Additional UI state (not synced to store)
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileList, setFileList] = useState<string[]>([]);
  
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
   * Update node data in store while ensuring state consistency
   * Always maintains ALL state properties to prevent data loss
   */
  const handleConfigChange = useCallback((updates: Partial<InputNodeData>) => {
    if (!node) {
      console.warn(`[useInputNodeDataSimplified] Node ${nodeId} not found in store, skipping update`);
      return;
    }
    
    const currentNodeData = node.data as InputNodeData;

    // Update local state
    if ('items' in updates && updates.items) {
      setItems(updates.items);
    }
    if ('textBuffer' in updates && updates.textBuffer !== undefined) {
      setTextBuffer(updates.textBuffer);
    }
    if ('iterateEachRow' in updates && updates.iterateEachRow !== undefined) {
      setIterateEachRow(Boolean(updates.iterateEachRow));
    }

    // Update Zustand store
    updateNode(nodeId, (currentNode) => ({
      ...currentNode,
      data: {
        ...currentNodeData,
        ...updates,
        type: currentNodeData.type || 'input',
        label: ('label' in updates ? updates.label : currentNodeData.label) ?? '',
      }
    }));
  }, [nodeId, node, updateNode]);

  /**
   * Handle text buffer changes - directly update both local and store state
   * Always preserves all other state properties
   */
  const handleTextChange = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
    const newText = event.target.value;
    setTextBuffer(newText);
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
    setIterateEachRow(newMode);
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
      textBuffer: textBuffer,
      iterateEachRow: iterateEachRow
    });
  }, [items, textBuffer, iterateEachRow, handleConfigChange]);

  /**
   * Handle saving the node label
   */
  const handleLabelChange = useCallback((newLabel: string) => {
    handleConfigChange({ label: newLabel });
  }, [handleConfigChange]);

  /**
   * Clear all items in the input node, preserving mode and any unsaved text in buffer
   */
  const handleClearItems = useCallback(() => {
    handleConfigChange({
      items: [],
      iterateEachRow: iterateEachRow,
      textBuffer: textBuffer
    });
    
    setFileName(null);
    setFileList([]);
  }, [handleConfigChange, iterateEachRow, textBuffer]);

  /**
   * Parse the content of the text buffer into individual items (by line)
   * Each non-empty line becomes an item
   */
  const handleSplitByLine = useCallback(() => {
    if (!textBuffer.trim()) return;
    
    const lines = textBuffer
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean); // Remove empty lines
    
    if (lines.length === 0) return;
    
    // Update with splitted text lines as items
    handleConfigChange({
      items: [...items, ...lines],
      textBuffer: '',
      iterateEachRow: iterateEachRow
    });
  }, [textBuffer, items, iterateEachRow, handleConfigChange]);

  /**
   * Reset node to empty state
   */
  const handleReset = useCallback(() => {
    handleConfigChange({
      items: [],
      textBuffer: '',
      iterateEachRow: false
    });
    
    setFileName(null);
    setFileList([]);
  }, [handleConfigChange]);

  return {
    // State
    items,
    textBuffer,
    iterateEachRow,
    fileName,
    fileList,
    
    // Actions
    handleTextChange,
    handleAddText,
    handleToggleProcessingMode,
    handleFileChange,
    handleDeleteItem,
    handleLabelChange,
    handleClearItems,
    handleSplitByLine,
    handleReset,
    handleConfigChange
  };
}; 