import { useCallback } from 'react';
import { useNodeContent, OutputNodeContent } from '../store/useNodeContentStore';
import { isEqual } from 'lodash';

/**
 * Custom hook to manage Output node state and operations using Zustand store.
 * Centralizes logic for both OutputNode and OutputConfig components
 */
export const useOutputNodeData = ({ 
  nodeId
}: { 
  nodeId: string
}) => {
  // Use the general NodeContentStore with OutputNodeContent type
  const { 
    content: generalContent, 
    setContent,
    isContentDirty
  } = useNodeContent(nodeId);

  // Cast the general content to OutputNodeContent type
  const content = generalContent as OutputNodeContent;

  // Destructure content for easier access
  const format = content.format || 'text';
  const outputContent = content.content || '';
  const label = content.label || 'Output Node';

  /**
   * Handle format change with deep equality check
   */
  const handleFormatChange = useCallback((newFormat: 'json' | 'text') => {
    if (isEqual(newFormat, format)) return;
    setContent({ format: newFormat });
  }, [format, setContent]);

  /**
   * Handle content change with deep equality check
   */
  const handleContentChange = useCallback((newContent: string) => {
    // Skip update if content hasn't changed (deep equality)
    if (isEqual(newContent, outputContent)) {
      console.log(`[OutputNode ${nodeId}] Skipping content update - no change (deep equal)`);
      return;
    }
    console.log(`[OutputNode ${nodeId}] Updating content from "${outputContent}" to "${newContent}"`);
    setContent({ content: newContent });
  }, [nodeId, outputContent, setContent]);

  /**
   * Formats result based on the provided format
   */
  const formatResultBasedOnFormat = useCallback((result: any, format: 'json' | 'text'): string => {
    if (result === null || result === undefined) return '';

    if (format === 'json') {
      // JSON Mode: Stringify if object, otherwise convert to string
      if (typeof result === 'object') {
        try {
          return JSON.stringify(result, null, 2);
        } catch (e) {
          console.error("Error stringifying result for JSON display:", e);
          return String(result); // Fallback
        }
      }
      // For non-objects in JSON mode, just convert to string
      return String(result); 
    } else {
      // TEXT Mode: Prioritize 'content' or 'text' properties
      if (typeof result === 'object') {
        if ('content' in result && result.content !== null && result.content !== undefined) {
          // If content itself is an object, stringify it for text view
          return typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
        } 
        if ('text' in result && result.text !== null && result.text !== undefined) {
          return String(result.text);
        }
        // Fallback for objects in text mode
        return JSON.stringify(result); 
      }
      // For primitives in text mode, just convert to string
      return String(result); 
    }
  }, []);

  /**
   * Update multiple properties at once with deep equality check
   */
  const updateOutputContent = useCallback((updates: Partial<OutputNodeContent>) => {
    // Skip update if no actual changes using deep equality
    const hasChanges = Object.entries(updates).some(([key, value]) => {
      const currentValue = content[key as keyof OutputNodeContent];
      return !isEqual(currentValue, value);
    });
    
    if (!hasChanges) {
      console.log(`[OutputNode ${nodeId}] Skipping content update - no changes in update object (deep equal)`);
      return;
    }
    
    // Create new content object with updates
    const newContent = {
      ...content,
      ...updates
    };

    // Final deep equality check against current content
    if (isEqual(newContent, content)) {
      console.log(`[OutputNode ${nodeId}] Skipping content update - merged content unchanged (deep equal)`);
      return;
    }
    
    console.log(`[OutputNode ${nodeId}] Updating content with:`, updates);
    setContent(updates);
  }, [nodeId, content, setContent]);

  return {
    // Data
    content,
    format,
    outputContent,
    label,
    isDirty: isContentDirty,
    
    // Event handlers
    handleFormatChange,
    handleContentChange,
    formatResultBasedOnFormat,
    updateOutputContent,
  };
}; 