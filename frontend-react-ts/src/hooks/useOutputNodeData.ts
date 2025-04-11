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
  const mode = content.mode || 'batch'; // Add mode tracking

  /**
   * Format content based on type and format
   */
  const formatContent = useCallback((content: any): string => {
    if (content === null || content === undefined) return '';

    // Handle array content
    if (Array.isArray(content)) {
      if (format === 'json') {
        return JSON.stringify(content, null, 2);
      }
      return content.join('\n');
    }

    // Handle object content in JSON mode
    if (format === 'json' && typeof content === 'object') {
      try {
        return JSON.stringify(content, null, 2);
      } catch (e) {
        console.error(`[OutputNode ${nodeId}] Error stringifying JSON:`, e);
        return String(content);
      }
    }

    // Default to string conversion
    return String(content);
  }, [format, nodeId]);

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
  const handleContentChange = useCallback((newContent: any, isForeachUpdate?: boolean, forceUpdate?: boolean) => {
    // Format the content appropriately
    const formattedContent = formatContent(newContent);

    // IMPORTANT: Always check for equality first to prevent infinite loops
    // Even with forceUpdate, we need to prevent updating with identical content
    if (isEqual(formattedContent, outputContent)) {
      console.log(`[OutputNode ${nodeId}] Skipping content update - no change (deep equal)`);
      return;
    }

    // In foreach mode or when forcing update, always overwrite content
    if (isForeachUpdate || mode === 'foreach' || forceUpdate === true) {
      console.log(`[OutputNode ${nodeId}] Forced update or foreach mode: Overwriting content with:`, formattedContent);
      setContent({ content: formattedContent });
      return;
    }

    console.log(`[OutputNode ${nodeId}] Updating content from "${outputContent}" to:`, formattedContent);
    setContent({ content: formattedContent });
  }, [nodeId, outputContent, mode, setContent, formatContent]);

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
    // If mode is changing, clear existing content
    if ('mode' in updates && updates.mode !== mode) {
      updates.content = '';
    }

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
  }, [nodeId, content, mode, setContent]);

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