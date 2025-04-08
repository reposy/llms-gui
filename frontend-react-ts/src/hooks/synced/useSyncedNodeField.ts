import { useState, useEffect, useRef, useCallback } from 'react';
import { useSelector, useDispatch, useStore } from 'react-redux';
import { RootState } from '../../store/store';
import { isEqual } from 'lodash';
import { updateNodeData } from '../../store/flowSlice';
import { NodeData } from '../../types/nodes';

/**
 * Hook for syncing a single node field between Redux store and local state
 * Handles lazy initialization and prevents unnecessary re-renders
 * Supports two-way sync with Redux store
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
  
  const dispatch = useDispatch();
  const store = useStore<RootState>();
  
  // Get field data from Redux store
  const storeValue = useSelector((state: RootState) => {
    const node = state.flow.nodes.find(n => n.id === nodeId);
    // Safe indexing with type assertions
    return node?.data ? (node.data as Record<string, any>)[field] as T | undefined : undefined;
  });
  
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
  
  // Function to manually sync value to Redux store
  const syncToStore = useCallback((newValue?: T) => {
    const valueToSync = newValue !== undefined ? newValue : value;
    
    // Get the latest node data from the store
    const state = store.getState();
    const node = state.flow.nodes.find(n => n.id === nodeId);
    
    if (node) {
      // Create an update with the current field value
      const update = {
        ...node.data,
        [field]: valueToSync
      };
      
      console.log(`[useSyncedNodeField] Dispatching ${nodeId}.${field} to store`);
      dispatch(updateNodeData({
        nodeId,
        data: update
      }));
    }
  }, [dispatch, field, nodeId, store, value]);
  
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