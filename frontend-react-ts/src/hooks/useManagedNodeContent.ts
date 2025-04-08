import { useCallback } from 'react';
import { shallow } from 'zustand/shallow';

import { 
  useNodeContentStore, 
  NodeContent, 
  setNodeContent as setContentInStore,
  markNodeDirty as markContentDirtyInStore,
  isNodeDirty as isContentDirtyInStore,
  getNodeContent as getContentFromStore
} from '../store/nodeContentStore';
import { NodeData } from '../types/nodes'; // Assuming NodeData exists and is relevant

interface UseManagedNodeContentResult {
  content: NodeContent; // The current content for the node
  isDirty: boolean; // Is the content different from the last saved state?
  updateContent: (updatedFields: Partial<NodeContent>) => void; // Update content in Zustand, mark as dirty
  saveContent: () => void; // Mark content as clean in Zustand (no longer persists to Redux)
}

/**
 * Hook to manage the content of a specific node, using only Zustand.
 * 
 * @param nodeId The ID of the node whose content is being managed.
 * @param initialNodeData The initial NodeData, maintained for API compatibility.
 * @returns An object with content state and functions to update/save it.
 */
export const useManagedNodeContent = (nodeId: string, initialNodeData?: NodeData): UseManagedNodeContentResult => {
  // --- State directly from Zustand Store ---
  const { 
    content, 
    isDirty 
  } = useNodeContentStore(
    state => ({
      // Provide default empty object if content doesn't exist
      content: state.nodeContents[nodeId] ?? {},
      // Access isDirty flag directly, default to false
      isDirty: state.nodeContents[nodeId]?.isDirty ?? false,
    }),
    shallow // Use shallow comparison for the selected object
  );

  // --- Callbacks ---
  /**
   * Updates the content in the Zustand store and marks it as dirty.
   */
  const updateContent = useCallback((updatedFields: Partial<NodeContent>) => {
    // Directly call the Zustand action to update content and handle dirtiness
    setContentInStore(nodeId, updatedFields); 
    console.log(`[useManagedNodeContent ${nodeId}] Updated store content.`, updatedFields);
  }, [nodeId]);

  /**
   * Marks the content as clean in Zustand store.
   */
  const saveContent = useCallback(() => {
    // Check dirtiness directly from the Zustand store state/selector
    if (isContentDirtyInStore(nodeId)) { 
      console.log(`[useManagedNodeContent ${nodeId}] Marking content as clean...`);
      
      // Mark content as clean in the Zustand store
      markContentDirtyInStore(nodeId, false);

      console.log(`[useManagedNodeContent ${nodeId}] Content marked clean.`);
    } else {
      console.log(`[useManagedNodeContent ${nodeId}] No dirty content in store to save.`);
    }
  }, [nodeId]);

  // Return state directly from Zustand selector and the simplified callbacks
  return {
    content,
    isDirty,
    updateContent,
    saveContent,
  };
}; 