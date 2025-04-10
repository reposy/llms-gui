import { Edge, Node } from 'reactflow';
import jsonpath from 'jsonpath';
import { ConditionType, NodeData } from '../types/nodes';

// Utility to safely extract a value from an object using a JSONPath query
export const extractValue = (obj: any, path: string): any => {
  try {
    if (!path) return obj;
    // Basic safety check for stringified JSON
    let dataToParse = obj;
    if (typeof obj === 'string') {
      try {
        dataToParse = JSON.parse(obj);
      } catch (e) {
        // If it's not valid JSON string, treat it as a plain string
        // Path extraction on plain strings might not be meaningful beyond the root
        return path === '.' || path === '$' || path === '$[0]' ? obj : undefined; // Handle basic paths for strings
      }
    }
    // Use jsonpath for more robust path extraction
    const results = jsonpath.query(dataToParse, path);
    // Return the first result, or undefined if no match
    return results.length > 0 ? results[0] : undefined;

  } catch (error) {
    console.error('Error extracting value:', error);
    // Return undefined instead of throwing, let conditional node handle it
    return undefined;
  }
};

// Utility to evaluate a condition based on type, input value, and condition value
export const evaluateCondition = (inputType: ConditionType, inputValue: any, conditionValue: string): boolean => {
  try {
    switch (inputType) {
      case 'contains':
        // Allow checking numbers converted to strings
        return String(inputValue).includes(conditionValue);
      case 'greater_than': {
        const numInput = parseFloat(inputValue);
        const numCondition = parseFloat(conditionValue);
        return !isNaN(numInput) && !isNaN(numCondition) && numInput > numCondition;
      }
      case 'less_than': {
        const numInput = parseFloat(inputValue);
        const numCondition = parseFloat(conditionValue);
        return !isNaN(numInput) && !isNaN(numCondition) && numInput < numCondition;
      }
      case 'equal_to': {
         // Attempt numeric comparison first, fallback to string comparison
        const numInput = parseFloat(inputValue);
        const numCondition = parseFloat(conditionValue);
        if (!isNaN(numInput) && !isNaN(numCondition)) {
          return numInput === numCondition;
        } else {
          // Explicitly convert to string for comparison to handle numbers vs string numbers
          return String(inputValue) === String(conditionValue);
        }
      }
      case 'json_path':
        // For json_path, the conditionValue IS the path. Extraction happens *before* this function.
        // We check if the extracted value (inputValue) is truthy
        return !!inputValue;
      default:
        return false;
    }
  } catch (e) {
    console.error("Condition evaluation error:", e);
    return false;
  }
};

/**
 * Helper function to determine the appropriate input value based on execution context.
 * Prioritizes iterationItem, then batch input rows, and finally falls back to the provided input.
 */
export const getResolvedInput = (context: any, input: any): any => {
  // Priority 1: If we're inside an iteration, use the iteration item
  if (context?.iterationItem !== undefined) {
    return context.iterationItem;
  }
  
  // Priority 2: If we're in batch mode with inputRows available, use them
  if (context?.executionMode === 'batch' && Array.isArray(context?.inputRows)) {
    return context.inputRows;
  }
  
  // Priority 3: Fall back to the direct input parameter
  return input;
};

// Utility to resolve handlebars-style templates within a string
export const resolveTemplate = (template: string, data: any, context?: any): string => {
    if (!template) return '';
    // Basic check to avoid processing non-template strings unnecessarily
    if (!template.includes('{{')) return template;

    // Determine the effective input data based on execution context if provided
    const effectiveData = context ? getResolvedInput(context, data) : data;

    // Use /{{\s*([^}]+?)\s*}}/g to handle spaces inside braces robustly
    return template.replace(/\{{\s*([^}]+?)\s*}}/g, (match, path) => {
      const trimmedPath = path.trim();

      // --- Handle {{input}} specifically --- 
      if (trimmedPath === 'input') {
        if (typeof effectiveData === 'object' && effectiveData !== null) {
          try {
            return JSON.stringify(effectiveData); // Stringify object/array data
          } catch (e) {
            console.error('Error stringifying input data for {{input}}:', e);
            return '[Object Data]'; // Fallback
          }
        } else {
          return String(effectiveData ?? ''); // Convert primitive data (or null/undefined) to string
        }
      } 

      // --- Handle other paths using jsonpath --- 
      // Ensure the context for jsonpath is the data itself if it's an object,
      // otherwise jsonpath won't work correctly.
      const jsonpathContext = (typeof effectiveData === 'object' && effectiveData !== null) ? effectiveData : {};
      // If data is primitive, non-input paths cannot be resolved.
      if (typeof jsonpathContext !== 'object' || jsonpathContext === null) {
        console.warn(`Template variable "${trimmedPath}" cannot be resolved from primitive data.`);
        return match; // Return original placeholder
      }

      try {
        // Prefix with '$' if it's not already there for jsonpath compatibility
        const jsonPathQuery = trimmedPath.startsWith('$') ? trimmedPath : `$.${trimmedPath}`;
        const results = jsonpath.query(jsonpathContext, jsonPathQuery);
        const value = results.length > 0 ? results[0] : undefined;

        // Handle different value types
        if (value === undefined || value === null) {
          // Return original placeholder if path resolves to undefined/null
          console.warn(`Template variable "${trimmedPath}" resolved to undefined/null in context:`, jsonpathContext);
          return match; 
        }
        if (typeof value === 'object') {
          try {
            return JSON.stringify(value); // Stringify nested objects/arrays
          } catch (e) {
             console.error(`Error stringifying nested object for "${trimmedPath}":`, e);
             return '[Nested Object]'; // Fallback
          }
        }
        return String(value); // Convert other resolved primitive types to string
      } catch (e) {
        // Return original placeholder on jsonpath query error
        console.error(`Error resolving template variable "${trimmedPath}":`, e);
        return match; 
      }
    });
};

// Helper to get root nodes from a subset of nodes and edges
export const getRootNodesFromSubset = (nodes: Node[], edges: Edge[], subsetNodeIds?: Set<string>): string[] => {
  const targetNodes = subsetNodeIds ? nodes.filter(n => subsetNodeIds.has(n.id)) : nodes;
  // Filter edges to only include those connecting nodes *within* the subset
  const targetEdges = edges.filter(e => 
    (subsetNodeIds ? subsetNodeIds.has(e.source) : true) &&
    (subsetNodeIds ? subsetNodeIds.has(e.target) : true)
  );
  
  return targetNodes
    .filter(node => !targetEdges.some(edge => edge.target === node.id))
    .map(node => node.id);
};

// Helper to check if a node is a root node (no incoming edges within its context)
export const isNodeRoot = (nodeId: string, nodes: Node<NodeData>[], edges: Edge[]): boolean => {
  const node = nodes.find(n => n.id === nodeId);
  if (!node) return false; // Node not found

  // Filter edges relevant to the node's context (either global or within its parent group)
  const relevantEdges = node.parentNode
    ? edges.filter(e => {
        const sourceNode = nodes.find(n => n.id === e.source);
        const targetNode = nodes.find(n => n.id === e.target);
        // Edge is relevant if both source and target are in the same group as the node
        return sourceNode?.parentNode === node.parentNode && targetNode?.parentNode === node.parentNode;
      })
    : edges; // Global context if no parent node

  // A node is a root if no relevant edges target it
  return !relevantEdges.some(edge => edge.target === nodeId);
}; 