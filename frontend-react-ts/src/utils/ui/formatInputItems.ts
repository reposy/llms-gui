/**
 * Represents the structure of an item formatted for display in the UI.
 */
export interface FormattedItem {
  id: string;
  originalIndex: number;
  display: string;
  fullContent: string;
  type: string;
  isFile: boolean;
  isEditing: boolean;
}

/**
 * Formats raw input items (strings or Files) into a displayable structure.
 * This function is used by both InputNode and InputNodeConfig.
 * 
 * @param rawItems - The array of raw input items (string or File).
 * @param itemType - A string identifier for the type of item list ('chaining', 'common', 'element', 'config', etc.) used for generating unique IDs.
 * @returns An array of FormattedItem objects.
 */
export const formatItemsForDisplay = (
  rawItems: (string | File)[], 
  itemType: string // Generic item type for ID generation
): FormattedItem[] => {
  if (!rawItems) return [];

  return rawItems.map((item, index) => {
    const isFile = typeof item !== 'string';
    // Generate ID: Use file name for files, 'text' for strings
    const idSuffix = isFile ? (item as File).name : 'text'; 
    const id = `${itemType}-${index}-${idSuffix}`;
    
    let display = '';
    let fullContent = '';
    let fileType = 'text'; // Default type for strings

    if (isFile) {
      const file = item as File;
      display = file.name || 'Unnamed file';
      // Provide a fallback for file.type if it's missing or empty
      const typeString = file.type || ''; 
      const sizeString = typeof file.size === 'number' ? `${Math.round(file.size / 1024)} KB` : 'Unknown size';
      fullContent = `${display} (${typeString}, ${sizeString})`;
      fileType = typeString; // Use the potentially empty string
    } else {
      // Ensure item is treated as string
      fullContent = typeof item === 'string' ? item : String(item); 
      
      // Generate display text (truncate if necessary)
      const lines = fullContent.split('\\n');
      if (lines.length > 2) {
        display = lines.slice(0, 2).join('\\n') + '...'; // Indicate truncation
      } else if (fullContent.length > 50) {
        display = fullContent.substring(0, 50) + '...'; // Indicate truncation
      } else {
        display = fullContent;
      }
      
      // Ensure display is not empty if fullContent was empty
      if (!display && !isFile) {
         display = '(empty text)';
      }
    }
    
    return {
      id,
      originalIndex: index,
      display,
      fullContent,
      type: fileType, // Pass the potentially empty string type
      isFile,
      isEditing: false // Default state, typically managed by component state/hooks
    };
  });
}; 