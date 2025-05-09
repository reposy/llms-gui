import { OutputNodeContent } from './common';

/**
 * Creates default OutputNodeContent
 */
export const createDefaultOutputNodeContent = (label?: string): OutputNodeContent => {
  return {
    label: label || 'Output Node',
    format: 'text',
    content: '',
    mode: 'read',
    isDirty: false
  };
};

/**
 * Truncates output content if too long for storage
 */
export const truncateOutputContentForStorage = (
  content: OutputNodeContent, 
  maxLength: number = 1000
): OutputNodeContent => {
  if (!content) return {};
  
  const result = { ...content };
  
  if (content.content && 
      typeof content.content === 'string' && 
      content.content.length > maxLength) {
    result.content = `[Content truncated for storage: ${content.content.length} chars]`;
  }
  
  return result;
};

/**
 * Formats content based on the specified format
 */
export const formatOutputContent = (content: any, format: 'json' | 'text' = 'text'): string => {
  if (content === null || content === undefined) {
    return '';
  }
  
  if (format === 'json') {
    // If content is already a string, try to parse it as JSON and re-stringify prettily
    if (typeof content === 'string') {
      try {
        const parsed = JSON.parse(content);
        return JSON.stringify(parsed, null, 2);
      } catch (error) {
        // If can't parse as JSON, try to convert object to JSON
        try {
          return JSON.stringify(content, null, 2);
        } catch (error) {
          // If all else fails, return as string
          return String(content);
        }
      }
    } else {
      // If not a string, try to convert to JSON
      try {
        return JSON.stringify(content, null, 2);
      } catch (error) {
        return String(content);
      }
    }
  } else {
    // For text format, convert to string
    if (typeof content === 'object') {
      try {
        return JSON.stringify(content, null, 2);
      } catch (error) {
        return String(content);
      }
    } else {
      return String(content);
    }
  }
}; 