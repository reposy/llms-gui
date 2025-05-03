import { useCallback, useMemo } from 'react';
import { shallow } from 'zustand/shallow'; // Use shallow for store selectors
import { useNodeContentStore, OutputNodeContent, NodeContent } from '../store/useNodeContentStore';
// import { useFlowStructureStore } from '../store/useFlowStructureStore'; // Removed FlowStructureStore dependency
import { isEqual } from 'lodash';
// import { Node as ReactFlowNode } from '@xyflow/react'; // Removed ReactFlowNode dependency
import { OutputFormat } from '../types/nodes'; // Keep OutputFormat type

/**
 * Custom hook to manage Output node state and operations.
 * All state (label, format, mode, content) is managed via useNodeContentStore.
 */
export const useOutputNodeData = (nodeId: string) => {
  // --- Content Store Access (Unified State Management) ---
  const setNodeContent = useNodeContentStore(state => state.setNodeContent);

  // Use a selector with shallow comparison to get the entire content object
  const content = useNodeContentStore(
    useCallback(
      (state) => state.getNodeContent<OutputNodeContent>(nodeId, 'output'), // Get Output specific content
      [nodeId]
    ),
    shallow // Use shallow comparison
  );

  // const isContentDirty = useNodeContentStore(state => state.isNodeDirty(nodeId)); // Removed: Use useDirtyTracker instead

  // --- Derived State (from content store) ---
  // Provide defaults directly when destructuring or accessing
  const label = content?.label || 'Output Node';
  const format = content?.format || 'text';
  const mode = content?.mode || 'read';
  const result = content?.content;

  /**
   * Utility function to update content in the store, ensuring defaults and types.
   */
  const updateOutputContent = useCallback((updates: Partial<Omit<OutputNodeContent, keyof NodeContent | 'isDirty'>>) => {
    // Create the full update object based on current content
    const currentContent = useNodeContentStore.getState().getNodeContent<OutputNodeContent>(nodeId, 'output');
    const newContent: Partial<OutputNodeContent> = { ...currentContent, ...updates };
    
    // Check if the update actually changes anything using deep comparison
    if (!isEqual(currentContent, newContent)) {
        console.log(`[useOutputNodeData ${nodeId}] Updating content with:`, updates);
        setNodeContent<OutputNodeContent>(nodeId, newContent);
    } else {
        console.log(`[useOutputNodeData ${nodeId}] Skipping content update - no changes (deep equal).`);
    }
  }, [nodeId, setNodeContent]);

  // --- Change Handlers (using updateOutputContent) ---
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
    // Update only the 'content' field to undefined
    updateOutputContent({ content: undefined });
  }, [updateOutputContent]);

  const handleContentChange = useCallback((newContent: any) => {
    console.log(`[OutputNode ${nodeId}] Setting output content`);
    // Update only the 'content' field
    updateOutputContent({ content: newContent });
  }, [updateOutputContent]);


  /**
   * Formats the result based on the current format setting.
   * @param data The data to format (defaults to the current result).
   * @returns Formatted string.
   */
  const formatResultBasedOnFormat = useCallback((
    data: any = result // Use the result derived from content store
  ): string => {
    if (data === null || data === undefined) return '';

    const currentFormat = format; // Use format derived from content store

    try {
      switch (currentFormat) {
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
  }, [result, format]); // Depend only on state derived from the store

  return {
    // State Data (all from useNodeContentStore)
    label,
    format,
    mode,
    content: result, 
    // isDirty: isContentDirty, // Removed

    // Change Handlers
    handleLabelChange,
    handleFormatChange,
    setMode,
    // handleConfigChange, // Removed as config is now part of content

    // Result Content Handlers
    clearOutput,
    handleContentChange,

    // Formatting Utility
    formatResultBasedOnFormat,
    
    // Provide the unified update function if direct partial updates are needed
    // updateContent: updateOutputContent 
  };
}; 