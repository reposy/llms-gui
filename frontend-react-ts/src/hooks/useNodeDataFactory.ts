import { useCallback } from 'react';
import { useNodeContentStore } from '../store/useNodeContentStore';
import { isEqual } from 'lodash';
import { NodeContent } from '../types/nodes';

// NodeContentState 타입 직접 정의
type NodeContentState = {
  getNodeContent: (nodeId: string, nodeType?: string) => NodeContent | undefined;
  setNodeContent: (nodeId: string, updates: Partial<NodeContent>) => void;
  contents: Record<string, NodeContent>;
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
  T extends NodeContent,
  TExtended = {
    content: T | undefined;
    updateContent: (updates: Partial<T>) => void;
    createChangeHandler: <K extends keyof T>(propName: K) => (value: T[K]) => void;
    getStoreState: () => NodeContentState;
  }
>(
  nodeType: string,
  extendHook?: (params: {
    nodeId: string;
    content: T | undefined;
    updateContent: (updates: Partial<T>) => void;
    createChangeHandler: <K extends keyof T>(propName: K) => (value: T[K]) => void;
    getStoreState: () => NodeContentState;
  }) => TExtended,
  defaultValues: Partial<T> = {} as Partial<T>
) {
  return function useNodeData({ nodeId }: { nodeId: string }): TExtended {
    // Get the content using proper selector pattern
    const content = useNodeContentStore(
      useCallback(
        (state) => state.getNodeContent(nodeId, nodeType) as T | undefined,
        [nodeId]
      )
    );
    
    // Get the setNodeContent function
    const setNodeContent = useNodeContentStore(state => state.setNodeContent);

    /**
     * Update content with deep equality check to prevent unnecessary updates
     */
    const updateContent = useCallback((updates: Partial<T>) => {
      // Handle undefined content case - initialize with defaults
      if (!content) {
        console.log(`[${nodeType.toUpperCase()}Node ${nodeId}] Initializing content with:`, {...defaultValues, ...updates});
        setNodeContent(nodeId, {...defaultValues, ...updates} as Partial<NodeContent>);
        return;
      }
      
      // Check if any individual updates differ from current values
      const hasChanges = Object.entries(updates).some(([key, value]) => {
        const currentValue = content[key as keyof T];
        return !isEqual(currentValue, value);
      });
      
      if (!hasChanges) {
        console.log(`[${nodeType.toUpperCase()}Node ${nodeId}] Skipping content update - no changes (deep equal)`);
        return;
      }
      
      console.log(`[${nodeType.toUpperCase()}Node ${nodeId}] Updating content with:`, updates);
      setNodeContent(nodeId, updates as Partial<NodeContent>);
    }, [nodeId, content, setNodeContent, defaultValues]);
    
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
      getStoreState: useNodeContentStore.getState,
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