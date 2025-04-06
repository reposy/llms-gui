import { Node } from 'reactflow';
import { NodeData } from '../types/nodes';
import { ExecutionContext } from '../types/execution';

/**
 * Handles merging results from multiple nodes into a single array output.
 * This module provides a clear and reusable implementation of the merger logic
 * that can be used by the execution dispatcher.
 */
export interface MergeOptions {
  /**
   * Whether to flatten array inputs (spread arrays into the result)
   */
  flattenArrays?: boolean;
  
  /**
   * Whether to include null/undefined values in the result
   */
  includeEmpty?: boolean;
  
  /**
   * Custom items to include in the merged result
   */
  customItems?: any[];
  
  /**
   * Custom transformation function to apply to each item
   */
  transform?: (item: any) => any;
}

/**
 * Merges multiple inputs based on the specified options
 */
export function mergeResults(
  inputs: any[],
  options: MergeOptions = {}
): any[] {
  const { 
    flattenArrays = true, 
    includeEmpty = false, 
    customItems = [], 
    transform
  } = options;
  
  // Initialize result array
  const result: any[] = [];
  
  // Process inputs
  for (const input of inputs) {
    if (!includeEmpty && (input === null || input === undefined)) {
      // Skip null/undefined inputs unless includeEmpty is true
      continue;
    }
    
    if (flattenArrays && Array.isArray(input)) {
      // Flatten arrays if flattenArrays is true
      for (const item of input) {
        if (!includeEmpty && (item === null || item === undefined)) {
          continue;
        }
        result.push(transform ? transform(item) : item);
      }
    } else {
      // Add non-array inputs directly
      result.push(transform ? transform(input) : input);
    }
  }
  
  // Add custom items
  for (const item of customItems) {
    if (!includeEmpty && (item === null || item === undefined)) {
      continue;
    }
    result.push(transform ? transform(item) : item);
  }
  
  return result;
}

/**
 * Merges results from a set of nodes
 */
export function mergeNodeResults(
  nodeResults: Record<string, any>,
  nodeIds: string[],
  options: MergeOptions = {}
): any[] {
  // Extract results for the specified nodes
  const inputs = nodeIds
    .map(id => nodeResults[id])
    .filter(result => result !== undefined);
  
  // Merge results
  return mergeResults(inputs, options);
}

/**
 * Handles collecting and merging results from multiple execution paths
 */
export function handleMergedExecutionResults(
  context: ExecutionContext,
  results: any[],
  outputProcessor?: (result: any[]) => any
): any[] {
  // Apply output processor if provided
  if (outputProcessor) {
    return outputProcessor(results);
  }
  
  return results;
} 