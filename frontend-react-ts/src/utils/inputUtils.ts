import { isEqual } from 'lodash';

/**
 * Resolves input variables based on processing mode
 * @param items Array of input items
 * @param mode Processing mode ('batch' or 'foreach')
 * @param index Current index for foreach mode
 * @returns Resolved input value(s)
 */
export const resolveInputVariable = (items: string[], mode: 'batch' | 'foreach', index?: number): string | string[] => {
  if (!Array.isArray(items)) return '';
  
  // Filter out invalid items
  const validItems = items.filter(item => typeof item === 'string' && item.trim() !== '');
  
  return mode === 'batch' ? validItems : validItems[index ?? 0] || '';
};

/**
 * Sanitizes input items by removing invalid entries
 * @param items Array of input items to sanitize
 * @returns Filtered array of valid items
 */
export const sanitizeInputItems = (items: any[]): string[] => {
  return items.filter(item => {
    if (typeof item === 'string') {
      return item.trim() !== '';
    }
    return false;
  });
};

/**
 * Checks if content has changed using deep equality
 * @param newContent New content to compare
 * @param oldContent Old content to compare against
 * @returns boolean indicating if content has changed
 */
export const hasContentChanged = (newContent: any, oldContent: any): boolean => {
  return !isEqual(newContent, oldContent);
}; 