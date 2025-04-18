import { useState, useEffect, useCallback } from 'react';
import { isEqual } from 'lodash';
import { useFlowStructureStore, setNodes as setStructureNodes } from '../../store/useFlowStructureStore';
import { Node } from '@xyflow/react';
import { NodeData } from '../../types/nodes';

/**
 * Hook for syncing a single node field between Zustand store and local state
 * Handles lazy initialization and prevents unnecessary re-renders
 * Supports two-way sync with Zustand store
 * 
 * @template T Type of the field value
 * @param options Configuration options
 * @returns [value, setValue, syncToStore] tuple
 */
export function useSyncedNodeField<T>(options: {
  nodeId: string;
  field: string;
  defaultValue: T;
  compare?: (a: T, b: T) => boolean;
  dispatchOnChange?: boolean;
}): [T, (newValue: T) => void, (value?: T) => void] {
  const {
    nodeId,
    field,
    defaultValue,
    compare = isEqual,
    dispatchOnChange = false,
  } = options;
  
  // Get current node from Zustand store using selector
  const node = useFlowStructureStore(
    state => state.nodes.find(n => n.id === nodeId),
    isEqual
  );
  
  // Get field data from the selected node's data
  const storeValue = node?.data ? (node.data as Record<string, any>)[field] as T | undefined : undefined;
  
  // Local state for the field value
  const [value, setValue] = useState<T>(storeValue !== undefined ? storeValue : defaultValue);
  
  // Effect to sync from store to local state
  useEffect(() => {
    if (storeValue !== undefined && !compare(storeValue, value)) {
      setValue(storeValue);
    }
    if (storeValue === undefined) {
      // Reset to default if node/field changes and store value is missing
      setValue(defaultValue);
    }
    // Dependencies include storeValue and key identifiers
  }, [storeValue, nodeId, field, defaultValue, value, compare]);
  
  // Function to manually sync local value back to the store
  const syncToStore = useCallback((newValue?: T) => {
    const valueToSync = newValue !== undefined ? newValue : value;
    
    // Get the current nodes array from the store
    const currentNodes = useFlowStructureStore.getState().nodes;
    
    // Create the updated nodes array
    const updatedNodes = currentNodes.map((n: Node<NodeData>) => {
      if (n.id === nodeId) {
        // Found the node, update its data
        return {
          ...n,
          data: {
            ...n.data, // Keep existing data
            [field]: valueToSync, // Update the specific field
          },
        };
      }
      return n; // Return other nodes unchanged
    });

    // Update the store with the new nodes array
    setStructureNodes(updatedNodes);

  }, [field, nodeId, value]);
  
  // Wrapper for setValue that optionally syncs immediately
  const setValueAndMaybeSync = useCallback((newValue: T) => {
    setValue(newValue);
    if (dispatchOnChange) {
      syncToStore(newValue);
    }
  }, [dispatchOnChange, syncToStore]);
  
  return [value, setValueAndMaybeSync, syncToStore];
} 