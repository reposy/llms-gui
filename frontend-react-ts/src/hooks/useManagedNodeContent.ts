import { useCallback } from 'react';
import { shallow } from 'zustand/shallow';
import { isEqual } from 'lodash';

import { NodeContent } from '../types/nodes';
import {
  useNodeContentStore,
  setNodeContent
} from '../store/useNodeContentStore';
import { pushCurrentSnapshot } from '../utils/ui/historyUtils';

interface UseManagedNodeContentResult {
  content: NodeContent; // The current content for the node
  isDirty: boolean; // Is the content different from the last saved state?
  updateContent: (updatedFields: Partial<NodeContent>, shouldSnapshot?: boolean) => void; // Update content in Zustand, mark as dirty
  saveContent: () => void; // Mark content as clean in Zustand (no longer persists to Redux)
}

/**
 * Hook to manage the content of a specific node, using only Zustand.
 * 
 * @param nodeId The ID of the node whose content is being managed.
 * @returns An object with content state and functions to update/save it.
 */
export const useManagedNodeContent = (nodeId: string): UseManagedNodeContentResult => {
  // --- State directly from Zustand Store ---
  const { 
    content, 
    isDirty 
  } = useNodeContentStore(
    state => ({
      // Provide default empty object if content doesn't exist using state.contents
      content: state.contents[nodeId] ?? {},
      // Access isDirty flag directly from state.contents, default to false
      isDirty: state.contents[nodeId]?.isDirty ?? false,
    }),
    shallow // Use shallow comparison for the selected object
  );

  // --- Callbacks ---
  /**
   * Updates the content in the Zustand store and marks it as dirty.
   */
  const updateContent = useCallback((updatedFields: Partial<NodeContent>, shouldSnapshot = false) => {
    console.log(`[useManagedNodeContent ${nodeId}] Updating content:`, {
      updatedFields,
      shouldSnapshot
    });

    // Update content in store
    setNodeContent(nodeId, updatedFields);

    // Create snapshot if requested (default false)
    if (shouldSnapshot) {
      console.log(`[useManagedNodeContent ${nodeId}] Creating history snapshot after update`);
      pushCurrentSnapshot();
    }
  }, [nodeId]);

  /**
   * Marks the content as clean in Zustand store.
   */
  const saveContent = useCallback(() => {
    /* Removed: Rely on useDirtyTracker
    if (isNodeDirty(nodeId)) {
      // Logic to persist the changes, e.g., save to backend or local storage
      // This is a placeholder - actual save logic depends on application needs
      console.log(`[useManagedNodeContent ${nodeId}] Saving changes...`, content);
      // After saving, mark the node as not dirty
      // markNodeNotDirty(nodeId); // Assuming such a function exists
    } else {
      console.log(`[useManagedNodeContent ${nodeId}] No changes to save.`);
    }
    */
    console.warn(`[useManagedNodeContent ${nodeId}] saveContent called - actual persistence logic not implemented here.`);
  }, [nodeId, content]);

  // Return state directly from Zustand selector and the simplified callbacks
  return {
    content,
    isDirty,
    updateContent,
    saveContent,
  };
}; 