import { useState, useEffect, useCallback } from 'react';
import { isEqual } from 'lodash';
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
    dispatchOnChange = false,
  } = options;
  
  // Get flow structure store functions
  const { updateNode } = useFlowStructureStore(state => ({
    updateNode: state.updateNode,
  }));
  
  // Get current node from Zustand store
  const node = useFlowStructureStore(
    state => state.nodes.find(n => n.id === nodeId),
    isEqual
  );
  
  // Get field data from Zustand store
  const storeValue = node?.data ? (node.data as Record<string, any>)[field] as T | undefined : undefined;
  
  // 고정 useState 훅 (동적 Map 금지)
  const [value, setValue] = useState<T>(storeValue !== undefined ? storeValue : defaultValue);
  
  // 스토어 값이 바뀌면 동기화 (단, 값이 다를 때만)
  useEffect(() => {
    if (storeValue !== undefined && !compare(storeValue, value)) {
      setValue(storeValue);
    }
    // nodeId, field가 바뀌면 defaultValue로 초기화
    // (storeValue가 undefined일 때만)
    if (storeValue === undefined) {
      setValue(defaultValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeValue, nodeId, field]);
  
  // 수동으로 스토어에 동기화
  const syncToStore = useCallback((newValue?: T) => {
    const valueToSync = newValue !== undefined ? newValue : value;
    if (node) {
      updateNode(nodeId, (currentNode) => {
        const updatedData = {
          ...currentNode.data,
          [field]: valueToSync,
        };
        return {
          ...currentNode,
          data: updatedData,
        };
      });
    }
  }, [field, nodeId, updateNode, value, node]);
  
  // setValue 래퍼 (dispatchOnChange 옵션 지원)
  const setValueAndMaybeSync = useCallback((newValue: T) => {
    setValue(newValue);
    if (dispatchOnChange) {
      syncToStore(newValue);
    }
  }, [dispatchOnChange, syncToStore]);
  
  return [value, setValueAndMaybeSync, syncToStore];
} 