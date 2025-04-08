import { useCallback, useMemo, ChangeEvent } from 'react';
import { FileLikeObject } from '../types/nodes';
import { isEqual } from 'lodash';
import { sanitizeInputItems } from '../utils/inputUtils';

// Import the general NodeContentStore and the InputNodeContent type
import { useNodeContent, InputNodeContent } from '../store/useNodeContentStore';

/**
 * Custom hook to manage InputNode state and operations using Zustand store.
 * Centralizes logic for both InputNode and InputNodeConfig components
 */
export const useInputNodeData = ({ 
  nodeId
}: { 
  nodeId: string
}) => {
  // Use the general NodeContentStore instead of input-specific store
  const { 
    content: generalContent, 
    setContent 
  } = useNodeContent(nodeId);

  // Cast the general content to InputNodeContent type
  const content = generalContent as InputNodeContent;

  // Destructure content for easier access (ensure we have InputNodeContent fields)
  const items = content.items || [];
  const textBuffer = content.textBuffer || '';
  const iterateEachRow = !!content.iterateEachRow;

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
   * Update node content in Zustand store
   */
  const handleConfigChange = useCallback((updates: Partial<InputNodeContent>) => {
    console.log(`[useInputNodeData] handleConfigChange for ${nodeId}:`, updates);
    setContent(updates);
  }, [nodeId, setContent]);

  /**
   * Handle text buffer changes - directly update Zustand state
   */
  const handleTextChange = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
    const newText = event.target.value;
    setContent({ textBuffer: newText });
  }, [setContent]);

  /**
   * Handle adding text from buffer to items
   */
  const handleAddText = useCallback(() => {
    const trimmedText = textBuffer.trim();
    if (!trimmedText) return;
    
    const updatedItems = sanitizeInputItems([...items, trimmedText]);
    setContent({ 
      items: updatedItems,
      textBuffer: '' // Clear buffer after adding
    });
  }, [textBuffer, items, setContent]);

  /**
   * Toggle Batch/Foreach processing mode
   */
  const handleToggleProcessingMode = useCallback(() => {
    const newMode = !iterateEachRow;
    setContent({ iterateEachRow: newMode });
  }, [iterateEachRow, setContent]);

  /**
   * Handle file input change
   */
  const handleFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;
    
    const files = Array.from(event.target.files);
    
    try {
      // Process each file into a FileLikeObject
      const fileObjects: FileLikeObject[] = await Promise.all(
        files.map(async (file) => {
          // Read the file content
          const content = await readFileAsText(file);
          
          // Create a FileLikeObject
          return {
            file: file.name,
            type: file.type,
            content
          };
        })
      );
      
      // Update items with new files
      const updatedItems = [...items, ...fileObjects];
      setContent({ items: updatedItems });
      
    } catch (error) {
      console.error('Error processing files:', error);
    }
  }, [items, setContent, readFileAsText]);

  /**
   * Handle item deletion
   */
  const handleDeleteItem = useCallback((index: number) => {
    const updatedItems = [...items];
    updatedItems.splice(index, 1);
    setContent({ items: updatedItems });
  }, [items, setContent]);

  /**
   * Handle clearing all items
   */
  const handleClearItems = useCallback(() => {
    setContent({ items: [] });
  }, [setContent]);

  /**
   * Calculate item counts for display
   */
  const itemCounts = useMemo(() => {
    const fileCount = items.filter(item => typeof item !== 'string').length;
    const textCount = items.filter(item => typeof item === 'string').length;
    
    return {
      fileCount,
      textCount,
      total: fileCount + textCount
    };
  }, [items]);

  /**
   * Format items for display
   */
  const formattedItems = useMemo(() => {
    const validItems = sanitizeInputItems(items);
    return validItems.map((item: string | FileLikeObject) => {
      if (typeof item === 'string') {
        return item;
      } else {
        return `📄 ${(item as FileLikeObject).file}`;
      }
    });
  }, [items]);

  // Always show iterate option for now
  const showIterateOption = true;

  return {
    // Data
    items,
    textBuffer,
    itemCounts,
    formattedItems,
    showIterateOption,
    iterateEachRow,
    
    // Event handlers
    handleTextChange,
    handleAddText,
    handleFileChange, 
    handleDeleteItem,
    handleClearItems,
    handleToggleProcessingMode,
    handleConfigChange
  };
}; 