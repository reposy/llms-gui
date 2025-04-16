import { useState, useEffect, useCallback } from 'react';
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
    dispatchOnChange = false,
  } = options;
  
  // Get flow structure store functions
  const { updateNode } = useFlowStructureStore(state => ({
    updateNode: state.updateNode,
  }));
  
  // Get current node from Zustand store (as Record<string, any> for safe indexing)
  const node = useFlowStructureStore(
    state => state.nodes.find(n => n.id === nodeId),
    isEqual
  );
  
  // Get node data from Zustand store (as Record<string, any> for safe indexing)
  const nodeDataFromStore = (node?.data || {}) as Record<string, any>;
  
  // 각 필드별로 useState를 명시적으로 선언
  const stateEntries = (Object.keys(fields) as (keyof T)[]).map((fieldName) => {
    const defaultValue = fields[fieldName];
    const storeValue = nodeDataFromStore[fieldName as string];
    const [value, setValue] = useState(storeValue !== undefined ? storeValue : defaultValue);
    return { fieldName, value, setValue, defaultValue };
  });
  
  // values 객체 생성
  const values = stateEntries.reduce((acc, { fieldName, value }) => {
    acc[fieldName as string] = value;
    return acc;
  }, {} as Record<string, any>) as T;
  
  // setValues 함수
  const setValues = useCallback((updates: Partial<T>) => {
    const updatesObj = updates as Record<string, any>;
    stateEntries.forEach(({ fieldName, setValue }) => {
      if (updatesObj[fieldName as string] !== undefined) {
        setValue(updatesObj[fieldName as string]);
      }
    });
    if (dispatchOnChange) {
      syncToStore(updates);
    }
  }, [dispatchOnChange]);
  
  // 스토어 값이 바뀌면 동기화 (값이 다를 때만)
  useEffect(() => {
    stateEntries.forEach(({ fieldName, setValue, value, defaultValue }) => {
      const storeValue = nodeDataFromStore[fieldName as string];
      const compare = compareMap[fieldName as string] || isEqual;
      if (storeValue !== undefined && !compare(storeValue, value)) {
        setValue(storeValue);
      }
      if (storeValue === undefined) {
        setValue(defaultValue);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeDataFromStore, nodeId]);
  
  // 수동으로 스토어에 동기화
  const syncToStore = useCallback((updates?: Partial<T>) => {
    if (node) {
      const valuesToSync = (updates || values) as Record<string, any>;
      updateNode(nodeId, (currentNode) => {
        const updatedData = {
          ...currentNode.data,
          ...valuesToSync,
        };
        return {
          ...currentNode,
          data: updatedData,
        };
      });
    }
  }, [node, nodeId, updateNode, values]);
  
  return {
    values,
    setValues,
    syncToStore,
  };
} 