import { useCallback } from 'react';
import { useNodeContentStore } from '../store/useNodeContentStore';
import { isEqual } from 'lodash';
import { NodeContent } from '../types/nodes';

/**
 * Factory function that creates standardized node data hooks.
 * This provides a consistent pattern for all node data hooks.
 * 
 * @param nodeType The type of node (e.g., 'llm', 'api', 'input')
 * @param defaultValues Default values for node content properties
 * @returns A custom hook to manage node state and operations
 */
export function createNodeDataHook<T extends NodeContent>(
  nodeType: string,
  defaultValues: Partial<T> = {}
) {
  return function useNodeData({ nodeId }: { nodeId: string }) {
    // Get the content using proper selector pattern
    const content = useNodeContentStore(
      useCallback(
        (state) => state.getNodeContent(nodeId, nodeType) as T,
        [nodeId]
      )
    );
    
    // Get the setNodeContent function
    const setNodeContent = useNodeContentStore(state => state.setNodeContent);

    /**
     * Update content with deep equality check to prevent unnecessary updates
     */
    const updateContent = useCallback((updates: Partial<T>) => {
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
      setNodeContent(nodeId, updates);
    }, [nodeId, content, setNodeContent]);
    
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

    return {
      content,
      updateContent,
      createChangeHandler,
      // Method to directly access the store state (for use in cleanup effects)
      getStoreState: useNodeContentStore.getState,
    };
  };
} 