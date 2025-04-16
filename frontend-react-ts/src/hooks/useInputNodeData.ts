import { useCallback } from 'react';
import { useNodeContent, InputNodeContent } from '../store/useNodeContentStore';

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
    setContent 
  } = useNodeContent(nodeId);

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
    setContent({ textBuffer: event.target.value });
  }, [setContent]);

  /**
   * Handle adding text from buffer to items
   */
  const handleAddText = useCallback(() => {
    if (!textBuffer.trim()) return;
    setContent({ 
      items: [...items, textBuffer.trim()],
      textBuffer: ''
    });
  }, [textBuffer, items, setContent]);

  /**
   * Toggle Batch/Foreach processing mode
   */
  const handleToggleProcessingMode = useCallback(() => {
    setContent({ 
      iterateEachRow: !iterateEachRow, 
      executionMode: !iterateEachRow ? 'foreach' : 'batch' 
    });
  }, [iterateEachRow, setContent]);

  /**
   * Handle file input change
   */
  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files?.length) return;
    const filePaths = Array.from(event.target.files).map(file => file.name);
    setContent({ items: [...items, ...filePaths] });
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
    setContent
  };
}; 