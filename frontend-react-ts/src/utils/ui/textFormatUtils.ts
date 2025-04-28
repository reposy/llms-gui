/**
 * Formats a node type string into a display-friendly name.
 * Example: 'llm' -> 'Llm', 'html-parser' -> 'Html Parser'
 * @param nodeType The raw node type string.
 * @returns The formatted type name.
 */
const formatNodeType = (nodeType: string): string => {
  if (!nodeType) return 'Node'; // Fallback for empty type
  return nodeType
    .split(/[-_]/) // Split by hyphen or underscore
    .map(part => part.charAt(0).toUpperCase() + part.slice(1)) // Capitalize first letter of each part
    .join(' '); // Join parts with space
};

/**
 * Generates the standardized header text for node sidebars.
 * Format: "{Label} | {Formatted Type Name}"
 * If label is empty, uses the formatted type name as the label.
 * Ensures a single entry point for header formatting logic.
 * 
 * @param nodeType The raw node type string (e.g., 'llm', 'html-parser').
 * @param nodeLabel The user-defined label for the node (optional).
 * @returns The formatted header string.
 */
export const formatNodeHeaderText = (nodeType: string, nodeLabel?: string): string => {
  const formattedType = formatNodeType(nodeType);
  const effectiveLabel = nodeLabel && nodeLabel.trim() !== '' ? nodeLabel.trim() : formattedType;
  
  // Combine label and type, ensuring type is always present
  return `${effectiveLabel} | ${formattedType}`;
}; 