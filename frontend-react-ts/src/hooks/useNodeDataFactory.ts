import { useCallback } from 'react';
import { useNodePropertyStore } from '../store/useNodePropertyStore';
import { isEqual } from 'lodash';
import { NodeProperty } from '../types/nodes';

// NodePropertyState 타입 직접 정의
type NodePropertyState = {
  getNodeProperty: (nodeId: string, nodeType?: string) => NodeProperty | undefined;
  setNodeProperty: (nodeId: string, updates: Partial<NodeProperty>) => void;
  contents: Record<string, NodeProperty>;
  // 기타 필요한 속성들
};

/**
 * Factory function that creates standardized node data hooks.
 * This provides a consistent pattern for all node data hooks.
 * 
 * The improved version supports extending the hook with custom functionality.
 * 
 * @param nodeType The type of node (e.g., 'llm', 'api', 'input')
 * @param extendHook A function that extends the base hook with custom functionality
 * @param defaultValues Default values for node content properties
 * @returns A custom hook to manage node state and operations
 */
export function createNodeDataHook<
  T extends NodeProperty,
  TExtended = {
    content: T | undefined;
    updateContent: (updates: Partial<T>) => void;
    createChangeHandler: <K extends keyof T>(propName: K) => (value: T[K]) => void;
    getStoreState: () => NodePropertyState;
  }
>(
  nodeType: string,
  extendHook?: (params: {
    nodeId: string;
    content: T | undefined;
    updateContent: (updates: Partial<T>) => void;
    createChangeHandler: <K extends keyof T>(propName: K) => (value: T[K]) => void;
    getStoreState: () => NodePropertyState;
  }) => TExtended,
  defaultValues: Partial<T> = {} as Partial<T>
) {
  return function useNodeData({ nodeId }: { nodeId: string }): TExtended {
    // Get the content using proper selector pattern
    const content = useNodePropertyStore(
      useCallback(
        (state) => state.getNodeProperty(nodeId, nodeType) as T | undefined,
        [nodeId]
      )
    );
    
    // Get the setNodeProperty function
    const setNodeProperty = useNodePropertyStore(state => state.setNodeProperty);

    /**
     * Partial<NodeProperty>만 받아서 병합 업데이트합니다.
     */
    const updateContent = useCallback((updates: Partial<T>) => {
      if (!content) {
        setNodeProperty(nodeId, {...defaultValues, ...updates} as Partial<NodeProperty>);
        return;
      }
      const hasChanges = Object.entries(updates).some(([key, value]) => {
        const currentValue = content[key as keyof T];
        return !isEqual(currentValue, value);
      });
      if (!hasChanges) {
        return;
      }
      setNodeProperty(nodeId, updates as Partial<NodeProperty>);
    }, [nodeId, content, setNodeProperty, defaultValues]);
    
    /**
     * Creates property change handlers for each property
     */
    const createChangeHandler = <K extends keyof T>(propName: K) => {
      return useCallback((value: T[K]) => {
        // Record<string, any>로 먼저 캐스팅한 후 Partial<T>로 캐스팅
        const updates: Record<string, any> = {};
        updates[propName as string] = value;
        updateContent(updates as Partial<T>);
      }, [updateContent]);
    };

    const baseHook = {
      content,
      updateContent,
      createChangeHandler,
      // Method to directly access the store state (for use in cleanup effects)
      getStoreState: useNodePropertyStore.getState,
    };

    // If extendHook is provided, use it to extend the base hook
    if (extendHook) {
      return extendHook({
        nodeId,
        ...baseHook
      });
    }

    // Otherwise, return the base hook
    return baseHook as unknown as TExtended;
  };
} 