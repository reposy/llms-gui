/**
 * Utility functions for generating consistent previews of data across components
 */

/**
 * Creates a compact JSON preview string from an array result
 * Limits to first few items with trailing ellipsis if needed
 * 
 * @param result The array or value to preview
 * @param maxItems Maximum number of items to include before truncating
 * @returns Formatted preview string
 */
export function createCompactJsonPreview(result: any, maxItems: number = 3): string {
  try {
    if (!result) return 'No data';
    
    // Handle non-array results
    if (!Array.isArray(result)) {
      const stringified = JSON.stringify(result);
      if (stringified.length > 50) {
        return stringified.substring(0, 47) + '...';
      }
      return stringified;
    }
    
    // Handle array results
    if (result.length === 0) return '[]';
    
    const previewItems = result.slice(0, maxItems);
    const previewArray = previewItems.map(item => {
      if (typeof item === 'object' && item !== null) {
        return '{}'; // Simplify objects to {} for compact preview
      }
      return JSON.stringify(item);
    });
    
    let preview = `[${previewArray.join(', ')}`;
    if (result.length > maxItems) {
      preview += ', ...';
    }
    preview += ']';
    
    // Further truncate if too long
    if (preview.length > 50) {
      return preview.substring(0, 47) + '...]';
    }
    
    return preview;
  } catch (e) {
    return 'Error previewing data';
  }
}

/**
 * Creates an array of formatted line items for row-by-row display
 * 
 * @param result The array or value to format into rows
 * @param maxItems Optional limit on number of rows to generate
 * @returns Array of formatted string rows
 */
export function createRowByRowPreview(result: any, maxItems?: number): string[] {
  try {
    if (!result) return ['No data'];
    
    // Handle non-array results
    if (!Array.isArray(result)) {
      return [JSON.stringify(result)];
    }
    
    // Handle empty array
    if (result.length === 0) return ['(empty array)'];
    
    // Process items up to maxItems limit if specified
    const items = maxItems ? result.slice(0, maxItems) : result;
    
    return items.map((item, index) => {
      if (typeof item === 'object' && item !== null) {
        try {
          return `${index + 1}. ${JSON.stringify(item)}`;
        } catch (e) {
          return `${index + 1}. [Complex Object]`;
        }
      }
      return `${index + 1}. ${item}`;
    });
  } catch (e) {
    return ['Error formatting preview rows'];
  }
}

/**
 * Determines if a result has more items than the specified limit
 */
export function hasMoreItems(result: any, limit: number): boolean {
  return Array.isArray(result) && result.length > limit;
} 