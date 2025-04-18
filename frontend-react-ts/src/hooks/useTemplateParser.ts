import { useCallback } from 'react';
import { get } from 'lodash'; // Import lodash get function

/**
 * A hook that provides template parsing functionality
 * Resolves template variables in the format {{variable}} with values from an object
 */
export const useTemplateParser = () => {
  /**
   * Parse a template string and replace variables with values from a data object
   * @param template The template string with variables in {{variable}} format
   * @param data The data object containing values for variables
   * @returns The parsed string with variables replaced by values
   */
  const parseTemplate = useCallback((template: string, data: any): string => {
    if (!template) return '';
    
    // Replace variables in the format {{variable}}
    return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, key) => {
      const trimmedKey = key.trim();
      
      // Check if the data is undefined or null
      if (data === undefined || data === null) {
        return `[No data for ${trimmedKey}]`;
      }
      
      // Use lodash get for safe nested property access
      const value = get(data, trimmedKey, undefined);
      
      // Return the value or a placeholder if undefined
      return value !== undefined ? String(value) : `[${trimmedKey} not found]`;
    });
  }, []);

  return { parseTemplate };
};

export default useTemplateParser; 