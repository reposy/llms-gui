import { Node } from 'reactflow';
import { JSONExtractorNodeData } from '../types/nodes';
import { ExecutionContext } from '../types/execution';
import { extractValue } from '../utils/executionUtils';

// Define the expected parameters for the executor
interface ExecuteJsonExtractorNodeParams {
  node: Node<JSONExtractorNodeData>;
  inputs: any[];
  context: ExecutionContext; // Included for consistency
}

/**
 * Executes a JSON Extractor node.
 * Extracts data from the input using a JSONPath expression.
 * Returns the extracted value or undefined.
 */
export function executeJsonExtractorNode(params: ExecuteJsonExtractorNodeParams): any {
  const { node, inputs, context } = params;
  const nodeId = node.id;
  const nodeData = node.data;

  console.log(`[ExecuteNode ${nodeId}] (JSON Extractor) Executing with context:`, context);

  const jsonInput = inputs.length > 0 ? inputs[0] : null;
  console.log(`[ExecuteNode ${nodeId}] (JSON Extractor) Input:`, jsonInput);
  console.log(`[ExecuteNode ${nodeId}] (JSON Extractor) Path:`, nodeData.path);

  if (jsonInput === null || jsonInput === undefined) {
    throw new Error("Input is null or undefined.");
  }
  if (!nodeData.path) {
    throw new Error("JSONPath is not defined.");
  }

  try {
    let dataToParse = jsonInput;
    // Attempt to parse if input is a stringified JSON
    if (typeof jsonInput === 'string') {
      try {
        dataToParse = JSON.parse(jsonInput);
      } catch (parseError) {
        // If parsing fails, maybe it's intended to run path on the string itself?
        // Or more likely, the input string wasn't valid JSON.
        console.warn(`[ExecuteNode ${nodeId}] (JSON Extractor) Input is a string but not valid JSON. Proceeding with string value. Error: ${parseError}`);
        // Let extractValue handle the string based on the path 
      }
    }
    
    // Use the centralized extractValue utility
    const output = extractValue(dataToParse, nodeData.path);
    console.log(`[ExecuteNode ${nodeId}] (JSON Extractor) Extracted output:`, output);
    if (output === undefined) {
      console.warn(`[ExecuteNode ${nodeId}] (JSON Extractor) Path "${nodeData.path}" returned undefined.`);
    }
    return output;

  } catch (extractError: any) {
    console.error(`[ExecuteNode ${nodeId}] (JSON Extractor) Error:`, extractError);
    throw new Error(`JSONPath extraction failed: ${extractError.message}`);
  }
} 