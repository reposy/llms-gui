/**
 * Utilities for template handling and normalization
 */

/**
 * Normalizes input for template resolution to ensure proper value extraction
 * Extracts the 'value' property from objects that have it, otherwise returns the input as is
 * Handles special cases like arrays and nested objects
 */
export function normalizeInputForTemplate(input: any): any {
  // Handle null/undefined
  if (input === null || input === undefined) {
    return '';
  }
  
  // Handle objects (including arrays)
  if (typeof input === 'object') {
    // Handle arrays
    if (Array.isArray(input)) {
      if (input.length === 0) return '';
      if (input.length === 1) {
        // For single-item arrays, extract that item
        return normalizeInputForTemplate(input[0]);
      }
      // For multi-item arrays, normalize each item and join with newlines
      return input
        .map(item => normalizeInputForTemplate(item))
        .join('\n');
    }
    
    // Extract 'value' if it exists (common pattern in our app)
    if ('value' in input && input.value !== undefined) {
      // Recursively normalize the value (in case it's also an object)
      return normalizeInputForTemplate(input.value);
    }
    
    // Extract 'text' if it exists (another common pattern)
    if ('text' in input && input.text !== undefined) {
      return String(input.text);
    }
    
    // For other objects, stringify them
    try {
      return JSON.stringify(input);
    } catch (e) {
      console.error('Error stringifying input for template:', e);
      return '[Object]';
    }
  }
  
  // For primitives, return as string
  return String(input);
} 