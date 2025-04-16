import { useNodeContent, OutputNodeContent } from '../store/useNodeContentStore';
import { useCallback } from 'react';

/**
 * Simplified hook for OutputNode data - minimal implementation that just connects to the store
 */
export const useOutputNodeData = ({ 
  nodeId 
}: { 
  nodeId: string 
}) => {
  // Get node content from store
  const { content, setContent } = useNodeContent(nodeId);
  
  // Safely extract properties with default fallbacks
  const outputContent = content as OutputNodeContent;
  const format = outputContent?.format || 'text';
  const outputText = outputContent?.content || '';
  const mode = outputContent?.mode || 'batch';
  
  /**
   * Update output format
   */
  const handleFormatChange = useCallback((newFormat: 'json' | 'text') => {
    setContent({ format: newFormat });
  }, [setContent]);
  
  /**
   * Update output mode
   */
  const setMode = useCallback((newMode: 'batch' | 'foreach') => {
    setContent({ mode: newMode });
  }, [setContent]);
  
  /**
   * Clear output content
   */
  const clearOutput = useCallback(() => {
    setContent({ content: '' });
  }, [setContent]);
  
  /**
   * Set output text content
   */
  const handleContentChange = useCallback((newContent: string) => {
    setContent({ content: newContent });
  }, [setContent]);
  
  /**
   * Format a result based on the selected format
   */
  const formatResultBasedOnFormat = useCallback((result: any, format: 'json' | 'text'): string => {
    try {
      if (format === 'json') {
        // If it's already a string but looks like JSON, try to parse and re-stringify for formatting
        if (typeof result === 'string') {
          try {
            const parsed = JSON.parse(result);
            return JSON.stringify(parsed, null, 2);
          } catch {
            // If it's not valid JSON, try to return as is
            return result;
          }
        }
        
        // If it's an object, stringify it
        if (result && typeof result === 'object') {
          return JSON.stringify(result, null, 2);
        }
        
        // Fall back to string representation
        return String(result);
      } else {
        // For text format
        if (typeof result === 'string') {
          return result;
        }
        
        // If it's an object, convert to string with some formatting
        if (result && typeof result === 'object') {
          // Simple formatting to make it readable, but not JSON-specific
          return JSON.stringify(result, null, 2);
        }
        
        // Fall back to string representation
        return String(result);
      }
    } catch (error) {
      console.error("Error formatting result:", error);
      return String(result);
    }
  }, []);
  
  return {
    format,
    outputText,
    mode,
    handleFormatChange,
    setMode,
    clearOutput,
    handleContentChange,
    formatResultBasedOnFormat,
    setContent
  };
}; 