import { isEqual } from 'lodash';
import { FileLikeObject } from '../types/nodes';

/**
 * Type guard to check if an item is a FileLikeObject
 */
const isFileLikeObject = (item: any): item is FileLikeObject => {
  return Boolean(item && typeof item === 'object' && 'file' in item && 'type' in item);
};

/**
 * Checks if a string value is valid input content
 */
const isValidStringContent = (str: string): boolean => {
  const trimmed = str.trim();
  // Exclude empty strings, "0", and strings that only contain whitespace
  return trimmed !== '' && trimmed !== '0' && /\S/.test(trimmed);
};

/**
 * Checks if a FileLikeObject is valid
 */
const isValidFileObject = (file: FileLikeObject): boolean => {
  return Boolean(
    file.file && 
    typeof file.file === 'string' && 
    isValidStringContent(file.file) &&
    file.type && 
    typeof file.type === 'string'
  );
};

/**
 * Checks if an input item is valid
 * @param item Item to validate (string or FileLikeObject)
 * @returns boolean indicating if item is valid
 */
export const isValidInputItem = (item: string | FileLikeObject): boolean => {
  if (isFileLikeObject(item)) {
    return isValidFileObject(item);
  }
  return typeof item === 'string' && isValidStringContent(item);
};

/**
 * Sanitizes input items by removing invalid entries
 * @param items Array of input items to sanitize
 * @returns Filtered array of valid items
 */
export const sanitizeInputItems = (items: any[]): (string | FileLikeObject)[] => {
  if (!Array.isArray(items)) {
    console.warn('[inputUtils] sanitizeInputItems received non-array input:', items);
    return [];
  }

  const sanitized = items.filter(item => {
    const isValid = isValidInputItem(item);
    if (!isValid) {
      console.log('[inputUtils] Filtered out invalid item:', item);
    }
    return isValid;
  });

  console.log('[inputUtils] Sanitization result:', {
    before: items,
    after: sanitized,
    removedCount: items.length - sanitized.length
  });

  return sanitized;
};

/**
 * Resolves input variables based on processing mode
 * @param items Array of input items
 * @param mode Processing mode ('batch' or 'foreach')
 * @param index Current index for foreach mode
 * @returns Resolved input value(s)
 */
export const resolveInputVariable = (
  items: (string | FileLikeObject)[], 
  mode: 'batch' | 'foreach', 
  index?: number
): string | string[] => {
  // Ensure items is an array and sanitize
  const validItems = sanitizeInputItems(items || []);
  
  // Convert FileLikeObjects to their content or filename
  const processedItems = validItems.map(item => {
    if (isFileLikeObject(item)) {
      return item.content?.toString() || item.file;
    }
    return item;
  });

  console.log('[inputUtils] resolveInputVariable:', {
    mode,
    index,
    itemCount: processedItems.length,
    result: mode === 'batch' ? processedItems : processedItems[index ?? 0]
  });

  return mode === 'batch' ? processedItems : processedItems[index ?? 0] || '';
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