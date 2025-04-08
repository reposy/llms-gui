import { useState, useEffect, useRef, useCallback } from 'react';
import { isEqual } from 'lodash';
import { useFlowStructureStore } from '../../store/useFlowStructureStore';

/**
 * Hook that synchronizes multiple node fields between Zustand store and local state
 * Handles lazy initialization and prevents unnecessary re-renders
 * Supports two-way sync with Zustand store
 * 
 * @template T Type map of field names to their value types
 * @param options Configuration options
 * @returns Object with field values, setters, and sync functions
 */
export function useSyncedNodeFields<T extends Record<string, any>>(options: {
  nodeId: string;
  fields: T;
  compareMap?: Partial<Record<keyof T, (a: any, b: any) => boolean>>;
  dispatchOnChange?: boolean;
}): {
  values: T;
  setValues: (updates: Partial<T>) => void;
  syncToStore: (updates?: Partial<T>) => void;
} {
  const { 
    nodeId, 
    fields, 
    compareMap = {}, 
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
  
  // Get node data from Zustand store
  const nodeDataFromStore = node?.data;
  
  // Track initialization status
  const isInitializedRef = useRef(false);
  
  // Track previous nodeId to detect changes
  const prevNodeIdRef = useRef<string | null>(null);
  
  // Create persistent refs to store field states and setters across renders
  const fieldStatesRef = useRef<Record<keyof T, any>>({} as Record<keyof T, any>);
  const settersMapRef = useRef<Record<keyof T, (value: any) => void>>({} as Record<keyof T, (value: any) => void>);
  
  // Store all state hooks in this object
  const stateHooksMap = useRef<Map<string, [any, (value: any) => void]>>(new Map());
  
  // Create or retrieve state for each field
  // This ensures useState hooks are stable across renders
  Object.keys(fields).forEach(fieldName => {
    const key = fieldName as keyof T;
    const defaultValue = fields[key];
    
    // Check if this field's state hook already exists
    if (!stateHooksMap.current.has(`${nodeId}-${fieldName}`)) {
      // Create a new state hook for this field and nodeId
      const stateHook = useState<T[typeof key]>(defaultValue);
      stateHooksMap.current.set(`${nodeId}-${fieldName}`, stateHook);
    }
    
    // Retrieve the state hook
    const [value, setValue] = stateHooksMap.current.get(`${nodeId}-${fieldName}`) as [T[typeof key], (val: T[typeof key]) => void];
    
    // Update refs with current values and setters
    fieldStatesRef.current[key] = value;
    settersMapRef.current[key] = setValue;
  });
  
  // Clean up old state hooks when nodeId changes
  // This prevents memory leaks from accumulating state for old nodes
  useEffect(() => {
    if (prevNodeIdRef.current !== null && prevNodeIdRef.current !== nodeId) {
      console.log(`[useSyncedNodeFields] Cleaning up state hooks for old node ${prevNodeIdRef.current}`);
      
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
  
  // Reset initialization flag when nodeId changes
  useEffect(() => {
    if (prevNodeIdRef.current !== nodeId) {
      console.log(`[useSyncedNodeFields] Node ID changed from ${prevNodeIdRef.current} to ${nodeId}, resetting initialization state`);
      isInitializedRef.current = false;
      prevNodeIdRef.current = nodeId;
    }
  }, [nodeId]);
  
  // Initialize all fields from store once data is available
  useEffect(() => {
    // Only initialize if not already done and we have store data
    if (!isInitializedRef.current) {
      if (nodeDataFromStore) {
        console.log(`[useSyncedNodeFields] Initial load for ${nodeId} fields: ${Object.keys(fields).join(', ')}`);
        
        const updatedFields: string[] = [];
        let fieldsInitialized = false;
        
        Object.keys(fields).forEach(fieldName => {
          const key = fieldName as keyof T;
          const storeValue = (nodeDataFromStore as Record<string, any>)[fieldName];
          
          if (storeValue !== undefined) {
            const setValue = settersMapRef.current[key];
            if (setValue) {
              setValue(storeValue);
              updatedFields.push(fieldName);
              fieldsInitialized = true;
            }
          }
        });
        
        if (fieldsInitialized) {
          console.log(`[useSyncedNodeFields] Successfully initialized fields: ${updatedFields.join(', ')}`);
          isInitializedRef.current = true;
        } else {
          console.log(`[useSyncedNodeFields] No data found for fields in node ${nodeId}`);
        }
      } else {
        console.log(`[useSyncedNodeFields] Waiting for node data for ${nodeId} - store data undefined`);
      }
    }
  }, [nodeDataFromStore, nodeId, fields]);
  
  // Sync each field from store to local state when store changes
  useEffect(() => {
    if (!isInitializedRef.current || !nodeDataFromStore) return;
    
    Object.keys(fields).forEach(fieldName => {
      const key = fieldName as keyof T;
      const storeValue = (nodeDataFromStore as Record<string, any>)[fieldName];
      const currentValue = fieldStatesRef.current[key];
      
      // Use provided compare function or default to isEqual
      const compareFunc = compareMap[key] || isEqual;
      
      if (storeValue !== undefined && !compareFunc(storeValue, currentValue)) {
        console.log(`[useSyncedNodeFields] Syncing ${nodeId}.${fieldName} from store`);
        const setValue = settersMapRef.current[key];
        if (setValue) {
          setValue(storeValue);
        }
      }
    });
  }, [nodeDataFromStore, fields, nodeId, compareMap]);
  
  // Function to manually sync multiple values to Zustand store
  const syncToStore = useCallback((updates?: Partial<T>) => {
    if (node) {
      // Values to sync (either provided updates or current values)
      const valuesToSync = updates || fieldStatesRef.current;
      
      // Update node data in Zustand store
      updateNode(nodeId, (currentNode) => {
        // Create an update with the current field values
        const updatedData = {
          ...currentNode.data,
          ...valuesToSync
        };
        
        console.log(`[useSyncedNodeFields] Updating ${nodeId} fields in store: ${Object.keys(valuesToSync).join(', ')}`);
        return {
          ...currentNode,
          data: updatedData
        };
      });
    }
  }, [node, nodeId, updateNode]);
  
  // Function to update multiple field values at once
  const setValues = useCallback((updates: Partial<T>) => {
    if (!updates || Object.keys(updates).length === 0) return;
    
    console.log(`[useSyncedNodeFields] Updating values for ${nodeId}:`, Object.keys(updates));
    
    // Update local state for each changed field
    Object.keys(updates).forEach(fieldName => {
      const key = fieldName as keyof T;
      const newValue = updates[key];
      
      if (newValue !== undefined) {
        const setValue = settersMapRef.current[key];
        if (setValue) {
          setValue(newValue);
        }
      }
    });
    
    // Optionally sync to store
    if (dispatchOnChange) {
      syncToStore(updates);
    }
  }, [dispatchOnChange, syncToStore, nodeId]);
  
  // Return values, setValues function, and syncToStore function
  return {
    values: fieldStatesRef.current as T,
    setValues,
    syncToStore
  };
} 