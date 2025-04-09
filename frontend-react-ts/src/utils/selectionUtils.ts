import { Node } from 'reactflow';
import { NodeData } from '../types/nodes';
import { isEqual } from 'lodash';

/**
 * Ensures ReactFlow nodes' visual selection state matches Zustand's selectedNodeIds
 * 
 * @param nodes - The ReactFlow nodes to update
 * @param selectedNodeIds - Array of node IDs that should be visually selected
 * @returns A new array of nodes with updated selection states
 */
export function syncVisualSelectionToReactFlow(
  nodes: Node<NodeData>[],
  selectedNodeIds: string[]
): Node<NodeData>[] {
  // Create a Set for faster lookups
  const selectedIdsSet = new Set(selectedNodeIds);
  
  // Return a new array where each node has a correct selection state
  return nodes.map(node => {
    const shouldBeSelected = selectedIdsSet.has(node.id);
    
    // Only create a new node object if selection state needs to change
    if (!!node.selected !== shouldBeSelected) {
      return {
        ...node,
        selected: shouldBeSelected
      };
    }
    
    // Return unchanged node if selection state already matches
    return node;
  });
}

/**
 * Compares two arrays of selected IDs to determine if they contain the same elements
 * regardless of order
 * 
 * @param selectedIds1 First array of selected IDs
 * @param selectedIds2 Second array of selected IDs
 * @returns boolean True if both arrays contain the same elements
 */
export function hasEqualSelection(selectedIds1: string[], selectedIds2: string[]): boolean {
  // Quick length check first - if lengths are different, arrays can't be equal
  if (selectedIds1.length !== selectedIds2.length) {
    return false;
  }
  
  // Empty arrays are equal
  if (selectedIds1.length === 0 && selectedIds2.length === 0) {
    return true;
  }
  
  // Convert to sets and check equality (handles order differences)
  const set1 = new Set(selectedIds1);
  const set2 = new Set(selectedIds2);
  
  // Additional length check after converting to sets to catch duplicates
  if (set1.size !== set2.size) {
    return false;
  }
  
  // Check that every item in set1 is also in set2
  for (const id of set1) {
    if (!set2.has(id)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Debug helper to log selection changes
 */
export function logSelectionChange(
  label: string,
  oldSelection: string[],
  newSelection: string[],
  additionalInfo?: Record<string, any>
): void {
  const changed = !hasEqualSelection(oldSelection, newSelection);
  console.log(
    `[Selection] ${label}: ${changed ? 'CHANGED' : 'unchanged'}`,
    {
      from: oldSelection,
      to: newSelection,
      ...additionalInfo
    }
  );
} 