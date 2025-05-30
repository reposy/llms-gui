import { useCallback } from 'react';
import { shallow } from 'zustand/shallow';
import { isEqual } from 'lodash';

import { NodeProperty } from '../types/nodes';
import {
  useNodePropertyStore,
  setNodeProperty
} from '../store/useNodePropertyStore';
import { pushCurrentSnapshot } from '../utils/ui/historyUtils';

interface UseManagedNodePropertyResult {
  content: NodeProperty; // The current content for the node
  isDirty: boolean; // Is the content different from the last saved state?
  updateContent: (updatedFields: Partial<NodeProperty>, shouldSnapshot?: boolean) => void; // Update content in Zustand, mark as dirty
  saveContent: () => void; // Mark content as clean in Zustand (no longer persists to Redux)
}

/**
 * Hook to manage the content of a specific node, using only Zustand.
 * 
 * @param nodeId The ID of the node whose content is being managed.
 * @returns An object with content state and functions to update/save it.
 */
export const useManagedNodeProperty = (nodeId: string): UseManagedNodePropertyResult => {
  // --- State directly from Zustand Store ---
  const { 
    content, 
    isDirty 
  } = useNodePropertyStore(
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
  const updateContent = useCallback((updatedFields: Partial<NodeProperty>, shouldSnapshot = false) => {
    // Update content in store
    setNodeProperty(nodeId, updatedFields);

    // Create snapshot if requested (default false)
    if (shouldSnapshot) {
      pushCurrentSnapshot();
    }
  }, [nodeId]);

  /**
   * Marks the content as clean in Zustand store.
   */
  const saveContent = useCallback(() => {
    console.warn(`[useManagedNodeProperty ${nodeId}] saveContent called - actual persistence logic not implemented here.`);
  }, [nodeId, content]);

  // Return state directly from Zustand selector and the simplified callbacks
  return {
    content,
    isDirty,
    updateContent,
    saveContent,
  };
}; 