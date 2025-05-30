import { FileLikeObject } from '../../types/nodes';
import { InputNodeProperty, NodeProperty, isInputNodeProperty } from './common';
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
    console.warn('[inputNodeProperty] sanitizeInputItems received non-array input:', items);
    return [];
  }

  const sanitized = items.filter(item => {
    const isValid = isValidInputItem(item);
    if (!isValid) {
      console.log('[inputNodeProperty] Filtered out invalid item:', item);
    }
    return isValid;
  });

  console.log('[inputNodeProperty] Sanitization result:', {
    before: items,
    after: sanitized,
    removedCount: items.length - sanitized.length
  });

  return sanitized;
};

/**
 * Sanitizes the entire InputNodeProperty
 */
export const sanitizeInputNodeProperty = (content: InputNodeProperty): InputNodeProperty => {
  if (!content) return {};
  
  // Log content state before sanitization
  console.log('[inputNodeProperty] Pre-sanitization content:', {
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
    console.log('[inputNodeProperty] Items changed after sanitization:', {
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
 * Creates default InputNodeProperty
 */
export const createDefaultInputNodeProperty = (label?: string): InputNodeProperty => {
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
 * Sanitizes any type of NodeProperty if it's an InputNodeProperty
 */
export const sanitizeNodeProperty = (content: NodeProperty): NodeProperty => {
  if (!content) return {};
  
  if (isInputNodeProperty(content)) {
    return sanitizeInputNodeProperty(content);
  }
  
  return content;
}; 