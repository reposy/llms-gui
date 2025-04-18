import { useCallback } from 'react';
import { useNodeContent } from '../store/useNodeContentStore';
import { InputNodeContent } from '../store/nodeContentStore';

/**
 * Simplified hook for InputNode data - minimal implementation that just connects to the store
 */
export const useInputNodeData = ({ 
  nodeId
}: { 
  nodeId: string
}) => {
  // Use the NodeContentStore
  const { 
    content: generalContent, 
    updateContent 
  } = useNodeContent<InputNodeContent>(nodeId, 'input');

  // Cast the general content to InputNodeContent type
  const content = generalContent as InputNodeContent;

  // Destructure content for easier access - ensure default values
  const items = content?.items || [];
  const textBuffer = content?.textBuffer || '';
  const iterateEachRow = content?.iterateEachRow || false;

  /**
   * Handle text buffer changes
   */
  const handleTextChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateContent({ textBuffer: event.target.value });
  }, [updateContent]);

  /**
   * Handle adding text from buffer to items
   */
  const handleAddText = useCallback(() => {
    const trimmedText = textBuffer.trim();
    if (!trimmedText) return;
    
    // First update items array with the current text
    const updatedItems = [...items, trimmedText];
    
    // Then reset the textBuffer in a single update to avoid state inconsistency
    updateContent({ 
      items: updatedItems,
      textBuffer: '' 
    });
  }, [textBuffer, items, updateContent]);

  /**
   * Toggle Batch/Foreach processing mode
   */
  const handleToggleProcessingMode = useCallback(() => {
    updateContent({ 
      iterateEachRow: !iterateEachRow
    });
  }, [iterateEachRow, updateContent]);

  /**
   * Handle file input change
   */
  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files?.length) return;
    const filePaths = Array.from(event.target.files).map(file => file.name);
    updateContent({ items: [...items, ...filePaths] });
  }, [items, updateContent]);

  /**
   * Handle item deletion
   */
  const handleDeleteItem = useCallback((index: number) => {
    const updatedItems = [...items];
    updatedItems.splice(index, 1);
    updateContent({ items: updatedItems });
  }, [items, updateContent]);

  /**
   * Handle clearing all items
   */
  const handleClearItems = useCallback(() => {
    updateContent({ items: [] });
  }, [updateContent]);

  return {
    items,
    textBuffer,
    iterateEachRow,
    handleTextChange,
    handleAddText,
    handleFileChange,
    handleDeleteItem,
    handleClearItems,
    handleToggleProcessingMode,
    setContent: updateContent
  };
}; 