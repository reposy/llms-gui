import { useCallback, useMemo, ChangeEvent, useEffect } from 'react';
import { FileLikeObject } from '../types/nodes';
import { isEqual } from 'lodash';
import { sanitizeInputItems } from '../utils/inputUtils';

// Import the general NodeContentStore and the InputNodeContent type
import { useNodeContent, InputNodeContent, getNodeContent } from '../store/useNodeContentStore';

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

  // Destructure and sanitize content for easier access
  const rawItems = content.items || [];
  
  // Debug raw items before sanitization
  useEffect(() => {
    if (rawItems.length > 0) {
      console.log(`[useInputNodeData] Raw items for ${nodeId}:`, rawItems.map(item => ({
        value: item,
        type: typeof item,
        isFileLike: typeof item === 'object' && 'file' in item,
        stringValue: typeof item === 'object' ? JSON.stringify(item) : String(item)
      })));
    }
  }, [rawItems, nodeId]);

  const items = useMemo(() => {
    const sanitized = sanitizeInputItems(rawItems);
    console.log(`[useInputNodeData] Sanitized items for ${nodeId}:`, {
      raw: rawItems.map(item => ({
        value: item,
        type: typeof item
      })),
      sanitized: sanitized.map(item => ({
        value: item,
        type: typeof item
      }))
    });
    return sanitized;
  }, [rawItems, nodeId]);

  // Debug effect to monitor items changes
  useEffect(() => {
    console.log(`[useInputNodeData] Final items for ${nodeId}:`, {
      items: items.map(item => ({
        value: item,
        type: typeof item
      })),
      count: items.length
    });
  }, [items, nodeId]);

  const textBuffer = content.textBuffer || '';
  const iterateEachRow = !!content.iterateEachRow;
  
  // Ensure executionMode stays in sync with iterateEachRow on initialization and changes
  useEffect(() => {
    // Check if executionMode doesn't match iterateEachRow setting
    const currentMode = content.executionMode;
    const expectedMode = iterateEachRow ? 'foreach' : 'batch';
    
    if (currentMode !== expectedMode) {
      console.log(`[useInputNodeData] Syncing executionMode (${currentMode}) with iterateEachRow (${iterateEachRow}) for ${nodeId}`);
      setContent({ executionMode: expectedMode });
    }
  }, [nodeId, iterateEachRow, content.executionMode, setContent]);

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
    // If updating items, ensure they are sanitized
    const sanitizedUpdates = { ...updates };
    if ('items' in updates && Array.isArray(updates.items)) {
      console.log(`[useInputNodeData] Pre-sanitization items in config update for ${nodeId}:`, updates.items);
      sanitizedUpdates.items = sanitizeInputItems(updates.items);
      console.log(`[useInputNodeData] Post-sanitization items in config update for ${nodeId}:`, sanitizedUpdates.items);
    }
    
    console.log(`[useInputNodeData] handleConfigChange for ${nodeId}:`, sanitizedUpdates);
    setContent(sanitizedUpdates);
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
    // Set both iterateEachRow and executionMode properties with proper types
    const modeUpdate: Partial<InputNodeContent> = { 
      iterateEachRow: newMode, 
      executionMode: newMode ? 'foreach' : 'batch' 
    };
    
    console.log(`[useInputNodeData] Toggling mode for ${nodeId}:`, modeUpdate);
    setContent(modeUpdate);
    
    // Debug log to confirm the update
    setTimeout(() => {
      const updatedContent = getNodeContent(nodeId) as InputNodeContent;
      console.log(`[useInputNodeData] After toggle for ${nodeId}:`, {
        iterateEachRow: updatedContent.iterateEachRow,
        executionMode: updatedContent.executionMode
      });
    }, 100);
  }, [iterateEachRow, setContent, nodeId]);

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
      
      // Update items with new files and ensure sanitization
      const updatedItems = sanitizeInputItems([...items, ...fileObjects]);
      setContent({ items: updatedItems });
      
    } catch (error) {
      console.error('Error processing files:', error);
    }
  }, [items, setContent]);

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
    const formatted = items.map((item: string | FileLikeObject) => {
      if (typeof item === 'string') {
        return item;
      } else {
        return `📄 ${(item as FileLikeObject).file}`;
      }
    });
    console.log(`[useInputNodeData] Formatted items for ${nodeId}:`, formatted);
    return formatted;
  }, [items, nodeId]);

  // Always show iterate option for now
  const showIterateOption = true;

  return {
    // Data
    items, // This is now always sanitized
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