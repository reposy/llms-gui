import { useCallback } from 'react';
import { useNodeContentStore } from '../store/useNodeContentStore';
import { OutputNodeContent, OutputFormat } from '../types/nodes';
import { isEqual } from 'lodash';

/**
 * Custom hook to manage Output node state and operations.
 * All state is managed via useNodeContentStore.
 */
export const useOutputNodeData = (nodeId: string) => {
  // Get the content using proper selector pattern
  const content = useNodeContentStore(
    useCallback(
      (state) => state.getNodeContent(nodeId, 'output') as OutputNodeContent,
      [nodeId]
    )
  );
  
  // Get the setNodeContent function
  const setNodeContent = useNodeContentStore(state => state.setNodeContent);

  // Extract properties with defaults for safety
  const label = content?.label || 'Output Node';
  const format = content?.format || 'text';
  const mode = content?.mode || 'read';
  const result = content?.content;

  /**
   * Update content with deep equality check to prevent unnecessary updates
   */
  const updateOutputContent = useCallback((updates: Partial<OutputNodeContent>) => {
    // Check if any individual updates differ from current values
    const hasChanges = Object.entries(updates).some(([key, value]) => {
      const currentValue = content[key as keyof OutputNodeContent];
      return !isEqual(currentValue, value);
    });
    
    if (!hasChanges) {
      console.log(`[OutputNode ${nodeId}] Skipping content update - no changes (deep equal)`);
      return;
    }
    
    console.log(`[OutputNode ${nodeId}] Updating content with:`, updates);
    setNodeContent(nodeId, updates);
  }, [nodeId, content, setNodeContent]);

  // Change handlers using the central updater
  const handleLabelChange = useCallback((newLabel: string) => {
    updateOutputContent({ label: newLabel });
  }, [updateOutputContent]);

  const handleFormatChange = useCallback((newFormat: OutputFormat) => {
    updateOutputContent({ format: newFormat });
  }, [updateOutputContent]);

  const setMode = useCallback((newMode: 'write' | 'read') => {
    updateOutputContent({ mode: newMode });
  }, [updateOutputContent]);

  const clearOutput = useCallback(() => {
    console.log(`[OutputNode ${nodeId}] Clearing output content`);
    updateOutputContent({ content: undefined });
  }, [updateOutputContent, nodeId]);

  const handleContentChange = useCallback((newContent: any) => {
    console.log(`[OutputNode ${nodeId}] Setting output content`);
    updateOutputContent({ content: newContent });
  }, [updateOutputContent, nodeId]);

  /**
   * Formats the result based on the current format setting.
   * @param data The data to format (defaults to the current result).
   * @returns Formatted string.
   */
  const formatResultBasedOnFormat = useCallback((data: any = result): string => {
    if (data === null || data === undefined) return '';

    try {
      switch (format) {
        case 'json':
          // Improved JSON formatting: handle potential stringified JSON
          let jsonData = data;
          if (typeof data === 'string') {
            try { jsonData = JSON.parse(data); } catch { /* Ignore parse error, treat as string */ }
          }
          return JSON.stringify(jsonData, null, 2);
        case 'text':
        default:
          if (typeof data === 'string') {
            return data;
          } else {
            // Attempt to stringify non-string data for text format
            try { 
              // Use pretty-printing for objects even in text mode for better readability
              return JSON.stringify(data, null, 2); 
            } catch { 
              // Fallback to String() only if stringify fails
              return String(data); 
            }
          }
      }
    } catch (error) {
      console.error('Error formatting output:', error);
      return String(data); // Fallback to simple string conversion on error
    }
  }, [result, format]);

  return {
    // Data
    content,
    label,
    format,
    mode,
    result,

    // Change Handlers
    handleLabelChange,
    handleFormatChange,
    setMode,

    // Result Content Handlers
    clearOutput,
    handleContentChange,

    // Formatting Utility
    formatResultBasedOnFormat,
    
    // Direct update method
    updateContent: updateOutputContent
  };
}; 