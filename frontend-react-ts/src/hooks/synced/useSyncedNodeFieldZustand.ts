import { useState, useEffect, useRef, useCallback } from 'react';
import { isEqual } from 'lodash';
import { NodeData } from '../../types/nodes';
import { useFlowStructureStore } from '../../store/useFlowStructureStore';

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
    dispatchOnChange = false 
  } = options;
  
  // Get flow structure store functions
  const { updateNode } = useFlowStructureStore(state => ({
    updateNode: state.updateNode
  }));
  
  // Get current node from Zustand store
  const node = useFlowStructureStore(
    state => state.nodes.find(n => n.id === nodeId),
    isEqual
  );
  
  // Get field data from Zustand store
  const storeValue = node?.data ? (node.data as Record<string, any>)[field] as T | undefined : undefined;
  
  // Store all state hooks in this object to maintain stability across renders
  const stateHooksMap = useRef<Map<string, [T, (value: T) => void]>>(new Map());
  
  // Create a unique key for this field+nodeId combination
  const fieldKey = `${nodeId}-${field}`;
  
  // Create or retrieve state hook for this field+nodeId
  if (!stateHooksMap.current.has(fieldKey)) {
    const stateHook = useState<T>(defaultValue);
    stateHooksMap.current.set(fieldKey, stateHook);
  }
  
  // Get the current state hook
  const [value, setValueInternal] = stateHooksMap.current.get(fieldKey) as [T, (value: T) => void];
  
  // Track if we've initialized from the store yet
  const isInitializedRef = useRef(false);
  
  // Reset initialization flag when nodeId changes
  const prevNodeIdRef = useRef<string | null>(null);
  
  // Clean up old state hooks when nodeId changes
  useEffect(() => {
    if (prevNodeIdRef.current !== null && prevNodeIdRef.current !== nodeId) {
      console.log(`[useSyncedNodeField] Cleaning up state hooks for old node ${prevNodeIdRef.current}`);
      
      // Get all keys from the stateHooksMap that start with the old nodeId
      const keysToRemove: string[] = [];
      stateHooksMap.current.forEach((_, key) => {
        if (key.startsWith(`${prevNodeIdRef.current}-`)) {
          keysToRemove.push(key);
        }
      });
      
      // Remove all state hooks for the old nodeId
      keysToRemove.forEach(key => {
        stateHooksMap.current.delete(key);
      });
    }
  }, [nodeId]);
  
  // Reset initialization state when nodeId changes
  useEffect(() => {
    if (prevNodeIdRef.current !== nodeId) {
      console.log(`[useSyncedNodeField] Node ID changed from ${prevNodeIdRef.current} to ${nodeId}, resetting initialization state`);
      isInitializedRef.current = false;
      prevNodeIdRef.current = nodeId;
    }
  }, [nodeId]);
  
  // Initialize from store once data is available
  useEffect(() => {
    if (!isInitializedRef.current) {
      if (storeValue !== undefined) {
        console.log(`[useSyncedNodeField] Initial load for ${nodeId}.${field}`, storeValue);
        setValueInternal(storeValue);
        isInitializedRef.current = true;
      } else {
        console.log(`[useSyncedNodeField] Waiting for data for ${nodeId}.${field} - store value undefined`);
      }
    }
  }, [storeValue, nodeId, field]);
  
  // Sync from store to local state when store changes
  useEffect(() => {
    if (!isInitializedRef.current) return;
    
    if (storeValue !== undefined && !compare(storeValue as T, value)) {
      console.log(`[useSyncedNodeField] Syncing ${nodeId}.${field} from store`);
      setValueInternal(storeValue as T);
    }
  }, [storeValue, value, nodeId, field, compare]);
  
  // Function to manually sync value to Zustand store
  const syncToStore = useCallback((newValue?: T) => {
    const valueToSync = newValue !== undefined ? newValue : value;
    
    if (node) {
      // Update node data in Zustand store
      updateNode(nodeId, (currentNode) => {
        // Create an update with the current field value
        const updatedData = {
          ...currentNode.data,
          [field]: valueToSync
        };
        
        console.log(`[useSyncedNodeField] Updating ${nodeId}.${field} in store`);
        return {
          ...currentNode,
          data: updatedData
        };
      });
    }
  }, [field, nodeId, updateNode, value, node]);
  
  // Wrapper for setValue that optionally syncs to store
  const setValue = useCallback((newValue: T) => {
    if (newValue === undefined) {
      console.warn(`[useSyncedNodeField] Attempted to set undefined value for ${nodeId}.${field}`);
      return;
    }
    
    console.log(`[useSyncedNodeField] Setting value for ${nodeId}.${field}`, newValue);
    setValueInternal(newValue);
    
    if (dispatchOnChange) {
      syncToStore(newValue);
    }
  }, [dispatchOnChange, syncToStore, nodeId, field]);
  
  return [value, setValue, syncToStore];
} 