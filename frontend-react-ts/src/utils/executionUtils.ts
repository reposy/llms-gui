import { Edge, Node } from 'reactflow';
import jsonpath from 'jsonpath';
import { ConditionType, NodeData } from '../types/nodes';
import { normalizeInputForTemplate } from './templateUtils';

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

// Utility to resolve handlebars-style templates within a string
export const resolveTemplate = (template: string, data: any): string => {
    if (!template) return '';
    // Basic check to avoid processing non-template strings unnecessarily
    if (!template.includes('{{')) return template;
    
    // CRITICAL FIX: Add validation for null/undefined data to prevent errors
    if (data === null || data === undefined) {
        console.warn('[resolveTemplate] WARNING: Received null/undefined data for template resolution');
        // Return the template with placeholder to indicate the error (rather than silently replacing with empty string)
        return template;
    }

    // ENHANCED DEBUG: Log detailed input for debugging
    console.log(`[resolveTemplate] DEBUG INPUT:`, {
        template: template && template.length > 100 ? template.substring(0, 100) + '...' : template,
        dataType: typeof data,
        dataIsNull: data === null,
        dataIsUndefined: data === undefined,
        dataIsMetaWrapped: typeof data === 'object' && data !== null && '_meta' in data && 'value' in data,
        dataIsForeachItem: typeof data === 'object' && data !== null && 
                         '_meta' in data && data._meta?.mode === 'foreach-item',
        hasInputKey: typeof data === 'object' && data !== null && 'input' in data,
        dataContent: typeof data === 'object' && data !== null ? 
            JSON.stringify(data).substring(0, 200) + 
            (JSON.stringify(data).length > 200 ? '...' : '') : 
            String(data)
    });

    // CRITICAL FIX: Special handling for data passed as { input: value } structure
    let dataForResolution = data;
    
    // Check if data is passed with the expected { input: value } structure
    if (typeof data === 'object' && data !== null && 'input' in data) {
        console.log('[resolveTemplate] Using data.input for resolution:', {
            inputType: typeof data.input,
            inputIsObject: typeof data.input === 'object' && data.input !== null,
            inputPreview: typeof data.input === 'object' && data.input !== null ? 
                JSON.stringify(data.input).substring(0, 100) : String(data.input)
        });
        
        // Use the input property directly for better template resolution
        // Normalize it to ensure proper value extraction
        dataForResolution = normalizeInputForTemplate(data.input);
        
        console.log('[resolveTemplate] Normalized input:', {
            before: typeof data.input === 'object' ? 
                JSON.stringify(data.input).substring(0, 100) : String(data.input),
            after: typeof dataForResolution === 'object' ? 
                JSON.stringify(dataForResolution).substring(0, 100) : String(dataForResolution),
            normalized: dataForResolution !== data.input
        });
        
        // Validate the input value
        if (dataForResolution === null || dataForResolution === undefined) {
            console.warn('[resolveTemplate] WARNING: data.input is null/undefined');
            // Return empty string for input specifically
            dataForResolution = '';
        }
    }
    // Early unwrapping for foreach-item mode
    else if (typeof data === 'object' && 
        data !== null && 
        '_meta' in data && 
        'value' in data && 
        data._meta?.mode === 'foreach-item') {
        
        console.log(`[resolveTemplate] FOREACH ITEM DETECTED:`, {
            metaSource: data._meta?.source,
            metaIndex: data._meta?.index,
            valueType: typeof data.value,
            valueIsArray: Array.isArray(data.value),
            valuePreview: typeof data.value === 'object' ? 
                JSON.stringify(data.value).substring(0, 100) : 
                String(data.value)
        });
        
        // Unwrap the value from the foreach-item metadata wrapper
        dataForResolution = data.value;
        
        // Additional validation for unwrapped data
        if (dataForResolution === null || dataForResolution === undefined) {
            console.error('[resolveTemplate] ERROR: Unwrapped foreach-item value is null/undefined!');
            // Fall back to original data rather than failing completely
            dataForResolution = data;
        }
    }

    // Use /{{\s*([^}]+?)\s*}}/g to handle spaces inside braces robustly
    return template.replace(/\{{\s*([^}]+?)\s*}}/g, (match, path) => {
      const trimmedPath = path.trim();
      console.log(`[resolveTemplate] Resolving placeholder: {{${trimmedPath}}}`);

      // --- Handle {{input}} specifically --- 
      if (trimmedPath === 'input') {
        console.log(`[resolveTemplate] Processing {{input}} with data:`, {
            dataType: typeof dataForResolution,
            dataValue: dataForResolution === null || dataForResolution === undefined ? 
                'null/undefined' : 
                (typeof dataForResolution === 'object' ? 
                  JSON.stringify(dataForResolution).substring(0, 100) + 
                  (JSON.stringify(dataForResolution).length > 100 ? '...' : '') : 
                  String(dataForResolution)),
            isForeachMode: dataForResolution && typeof dataForResolution === 'object' && 
                          dataForResolution._meta?.mode === 'foreach-item'
        });
        
        // Handle undefined/null data
        if (dataForResolution === undefined || dataForResolution === null) {
          console.warn('[resolveTemplate] CRITICAL: {{input}} cannot be resolved because data is null/undefined');
          // Return a clearer error message that will help debug the issue
          return '{{input:ERROR:null-or-undefined-data}}';
        }
        
        // Unwrap value from metadata object if data is from Input node (double unwrapping check)
        let actualValue = dataForResolution;
        if (typeof dataForResolution === 'object' && 'value' in dataForResolution && '_meta' in dataForResolution) {
          console.log('[resolveTemplate] Detected NESTED metadata-wrapped input, unwrapping again:', {
              valueType: typeof dataForResolution.value,
              valuePreview: JSON.stringify(dataForResolution.value).substring(0, 100),
              metaSource: dataForResolution._meta?.source,
              metaMode: dataForResolution._meta?.mode
          });
          actualValue = dataForResolution.value;
          
          // Validate the double-unwrapped value
          if (actualValue === undefined || actualValue === null) {
            console.error('[resolveTemplate] ERROR: Double-unwrapped value is null/undefined!');
            return '{{input}}'; // Return placeholder to indicate error
          }
        } 
        
        // Handle the actual value
        let resolvedValue = '';
        if (typeof actualValue === 'object') {
          try {
            resolvedValue = JSON.stringify(actualValue); // Stringify object/array data
            console.log('[resolveTemplate] Stringified object/array for {{input}}:', 
                resolvedValue.substring(0, 100) + 
                (resolvedValue.length > 100 ? '...' : ''));
          } catch (e) {
            console.error('Error stringifying input data for {{input}}:', e);
            resolvedValue = '[Object Data]'; // Fallback
          }
        } else {
          // For primitive types (string, number, boolean), just convert to string
          resolvedValue = String(actualValue);
          console.log('[resolveTemplate] Converted primitive to string for {{input}}:', resolvedValue);
        }
        
        // Final validation check
        console.log(`[resolveTemplate] FINAL {{input}} replacement:`, {
            originalPlaceholder: match,
            resolvedValue: resolvedValue.substring(0, 100) + 
              (resolvedValue.length > 100 ? '...' : ''),
            isEmpty: !resolvedValue,
            length: resolvedValue.length
        });
            
        return resolvedValue;
      }

      // --- Handle other paths using jsonpath --- 
      // BUGFIX: Ensure we resolve paths against the correct object structure,
      // even if data is wrapped in a metadata object
      
      // Determine the appropriate context for jsonpath resolution
      let jsonContext = dataForResolution;
      
      // If data is a metadata-wrapped object from Input node, use its value
      if (typeof dataForResolution === 'object' && dataForResolution !== null && 'value' in dataForResolution && '_meta' in dataForResolution) {
        jsonContext = dataForResolution.value;
        console.log('[resolveTemplate] Using unwrapped value for path resolution');
      }
      
      // Ensure the context is an object for jsonpath (or empty object if primitive)
      const context = (typeof jsonContext === 'object' && jsonContext !== null) ? jsonContext : {};
      
      // If data is primitive, non-input paths cannot be resolved
      if (typeof jsonContext !== 'object' || jsonContext === null) {
        console.warn(`Template variable "${trimmedPath}" cannot be resolved from primitive data.`);
        return match; // Return original placeholder
      }

      try {
        // Prefix with '$' if it's not already there for jsonpath compatibility
        const jsonPathQuery = trimmedPath.startsWith('$') ? trimmedPath : `$.${trimmedPath}`;
        const results = jsonpath.query(context, jsonPathQuery);
        const value = results.length > 0 ? results[0] : undefined;

        // Handle different value types
        if (value === undefined || value === null) {
          // Return original placeholder if path resolves to undefined/null
          console.warn(`Template variable "${trimmedPath}" resolved to undefined/null in context:`, context);
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