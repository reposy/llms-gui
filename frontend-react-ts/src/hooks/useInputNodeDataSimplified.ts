import { useCallback, ChangeEvent, useRef, useEffect } from 'react';
import { cloneDeep } from 'lodash';
import { InputNodeData, FileLikeObject, NodeData } from '../types/nodes';
import { useState } from 'react';
import { useFlowStructureStore } from '../store/useFlowStructureStore';
import { Node as ReactFlowNode } from 'reactflow';

// Define a type for the updates that allows items to be mixed temporarily
type InputNodeUpdates = Omit<Partial<InputNodeData>, 'items'> & {
  items?: (string | FileLikeObject)[];
};

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
  const { setNodes, getNode } = useFlowStructureStore(state => ({
    setNodes: state.setNodes,
    getNode: (id: string) => state.nodes.find(n => n.id === id)
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
    
    const fileItems = items.filter(item => typeof item !== 'string' && item.hasOwnProperty('file')) as FileLikeObject[];
    if (fileItems.length > 0) {
      setFileList(fileItems.map(item => item.file));
      setFileName(fileItems.length === 1 
        ? fileItems[0].file 
        : `${fileItems.length} files selected`);
    } else {
      setFileName(null);
      setFileList([]);
    }
  }, [items]);

  /**
   * Update node data in store while ensuring state consistency
   * Always maintains ALL state properties to prevent data loss
   * Ensures only strings are saved in node.data.items
   */
  const handleConfigChange = useCallback((updates: InputNodeUpdates) => {
    const targetNode = getNode(nodeId);
    if (!targetNode) {
      console.warn(`[useInputNodeDataSimplified] Node ${nodeId} not found in store, skipping update`);
      return;
    }

    // Explicitly type check before accessing data
    const currentNodeData = targetNode.data as InputNodeData;
    if (!currentNodeData) {
      console.error(`[useInputNodeDataSimplified] Node ${nodeId} found but has no data.`);
      return;
    }

    // Prepare items for storage: convert FileLikeObjects to string paths/names
    let itemsToStore: string[] = [];
    // Use local state `items` as fallback if `updates.items` is not provided
    const itemsSource = updates.items !== undefined ? updates.items : items;

    itemsToStore = itemsSource.map(item => {
      if (typeof item === 'string') {
        return item;
      }
      // Check if it's a FileLikeObject before accessing .file
      if (typeof item === 'object' && item !== null && 'file' in item) {
        // Ensure item.file exists and is a string
        return typeof item.file === 'string' ? item.file : '';
      }
      // Handle unexpected item types if necessary, e.g., return empty string or log error
      console.warn(`[useInputNodeDataSimplified] Unexpected item type found in items array:`, item);
      return ''; // Or handle differently
    }).filter(item => typeof item === 'string'); // Ensure only strings remain

    // Update local state for items if they were part of the update
    if (updates.items !== undefined) {
      setItems(updates.items);
    }

    // Update local state for other properties
    if ('textBuffer' in updates && updates.textBuffer !== undefined) {
      setTextBuffer(updates.textBuffer);
    }
    if ('iterateEachRow' in updates && updates.iterateEachRow !== undefined) {
      setIterateEachRow(Boolean(updates.iterateEachRow));
    }

    // Update Zustand store using setNodes
    setNodes(
      useFlowStructureStore.getState().nodes.map((n: ReactFlowNode<NodeData>) => { // Use NodeData here
        if (n.id === nodeId) {
          // Double check it's an input node before assuming InputNodeData
          if (n.type === 'input') {
            const currentInputData = n.data as InputNodeData;
            // Create the updated data object safely
            const updatedData: InputNodeData = {
              ...currentInputData, // Start with existing data
              ...updates, // Apply partial updates
              items: itemsToStore, // Ensure items are strings
              type: 'input', // Explicitly set type
              label: ('label' in updates ? updates.label : currentInputData.label) ?? '',
            };

            // Ensure iterateEachRow and textBuffer from updates are correctly typed if present
            if ('iterateEachRow' in updates && updates.iterateEachRow !== undefined) {
              updatedData.iterateEachRow = Boolean(updates.iterateEachRow);
            }
            if ('textBuffer' in updates && updates.textBuffer !== undefined) {
              updatedData.textBuffer = updates.textBuffer;
            }

            return {
              ...n, // Keep other node properties (position, etc.)
              data: updatedData, // Assign the specifically typed InputNodeData
            };
          } else {
            // Log error if the node type doesn't match
            console.error(`[useInputNodeDataSimplified] Expected node ${nodeId} to be type 'input', but found type ${n.type}`);
          }
        }
        return n; // Return other nodes unchanged
      })
    );
  }, [nodeId, getNode, setNodes, items]); // Add items to dependency array

  /**
   * Handle text buffer changes - directly update both local and store state
   * Always preserves all other state properties
   */
  const handleTextChange = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
    const newText = event.target.value;
    setTextBuffer(newText);
    handleConfigChange({ 
      textBuffer: newText,
    });
  }, [handleConfigChange]);

  /**
   * Handle adding text from buffer to items - preserves entire text as one item
   */
  const handleAddText = useCallback(() => {
    const trimmedText = textBuffer.trim();
    if (!trimmedText) return;
    const updatedItems = [...items, trimmedText];
    setItems(updatedItems);
    setTextBuffer('');

    handleConfigChange({ 
      items: updatedItems,
      textBuffer: '',
    });
  }, [textBuffer, items, handleConfigChange]);

  /**
   * Toggle Batch/Foreach processing mode while preserving all items and text
   * Uses lodash cloneDeep for proper deep copying of complex objects
   */
  const handleToggleProcessingMode = useCallback(() => {
    const newMode = !iterateEachRow;
    hasToggledRef.current = true;
    setIterateEachRow(newMode);

    handleConfigChange({ 
      iterateEachRow: newMode,
    });
  }, [iterateEachRow, handleConfigChange]);

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
      
    const fileNameList = files.map(file => file.name);
    setFileList(fileNameList);
    setFileName(fileNames);
    
    const processFiles = async () => {
      try {
        const currentItems = items ? [...items] : [];
        const newFiles: FileLikeObject[] = [];
        
        for (const file of files) {
          const fileObj: FileLikeObject = {
            file: file.name,
            type: file.type
          };
          
          if (file.type.startsWith('text/')) {
            const fileContent = await readFileAsText(file);
            fileObj.content = fileContent;
          }
          
          newFiles.push(fileObj);
        }
        
        const updatedItems = [...currentItems, ...newFiles];
        setItems(updatedItems);
        
        handleConfigChange({ 
          items: updatedItems,
        });
      } catch (error) {
        console.error("Error reading files:", error);
        setFileName('Error reading files');
        setFileList(['Error reading files']);
      }
    };
    
    processFiles();
  }, [handleConfigChange, items]);

  /**
   * Handle deletion of a specific item
   */
  const handleDeleteItem = useCallback((index: number) => {
    if (!items || items.length === 0) return;
    const updatedItems = [...items];
    updatedItems.splice(index, 1);
    
    setItems(updatedItems);
    
    const fileItems = updatedItems.filter(item => typeof item !== 'string' && item.hasOwnProperty('file')) as FileLikeObject[];
    if (fileItems.length === 0) {
      setFileName(null);
      setFileList([]);
    } else {
      setFileList(fileItems.map(item => item.file));
      
      setFileName(fileItems.length === 1 
        ? fileItems[0].file 
        : `${fileItems.length} files selected`);
    }
    
    handleConfigChange({ 
      items: updatedItems,
    });
  }, [items, handleConfigChange]);

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
      .filter(Boolean);
    
    if (lines.length === 0) return;
    
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