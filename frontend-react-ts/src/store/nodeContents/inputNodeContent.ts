import { FileLikeObject } from '../../types/nodes';
import { InputNodeContent, isInputNodeContent, NodeContent } from './common';
import { isEqual } from 'lodash';

/**
 * Checks if an input item is valid (string)
 */
export const isValidInputItem = (item: any): boolean => {
  // Accept only strings
  if (typeof item === 'string') {
    return true;
  }
  
  return false;
};

/**
 * Sanitizes input items by removing invalid entries
 * @param items Array of input items to sanitize
 * @returns Filtered array of valid items
 */
export const sanitizeInputItems = (items: any[]): string[] => {
  if (!Array.isArray(items)) {
    console.warn('[inputNodeContent] sanitizeInputItems received non-array input:', items);
    return [];
  }

  const sanitized = items.filter(item => {
    const isValid = isValidInputItem(item);
    if (!isValid) {
      console.log('[inputNodeContent] Filtered out invalid item:', item);
    }
    return isValid;
  });

  console.log('[inputNodeContent] Sanitization result:', {
    before: items,
    after: sanitized,
    removedCount: items.length - sanitized.length
  });

  return sanitized;
};

/**
 * Sanitizes the entire InputNodeContent
 */
export const sanitizeInputNodeContent = (content: InputNodeContent): InputNodeContent => {
  if (!content) return {};
  
  // Log content state before sanitization
  console.log('[inputNodeContent] Pre-sanitization content:', {
    hasItems: 'items' in content,
    itemCount: content.items?.length,
    items: content.items?.map(item => ({
      value: item,
      type: typeof item
    }))
  });

  const sanitizedItems = sanitizeInputItems(content.items || []);
  
  // Log sanitization results
  if (!isEqual(sanitizedItems, content.items)) {
    console.log('[inputNodeContent] Items changed after sanitization:', {
      before: content.items?.map(item => ({
        value: item,
        type: typeof item
      })),
      after: sanitizedItems.map(item => ({
        value: item,
        type: typeof item
      }))
    });
    return { ...content, items: sanitizedItems };
  }
  
  return content;
};

/**
 * Creates default InputNodeContent
 */
export const createDefaultInputNodeContent = (label?: string): InputNodeContent => {
  return {
    label: label || 'Input Node',
    items: [],
    textBuffer: '',
    iterateEachRow: false,
    executionMode: 'batch',
    isDirty: false
  };
};

/**
 * Sanitizes any type of NodeContent if it's an InputNodeContent
 */
export const sanitizeNodeContent = (content: NodeContent): NodeContent => {
  if (!content) return {};
  
  if (isInputNodeContent(content)) {
    return sanitizeInputNodeContent(content);
  }
  
  return content;
}; 