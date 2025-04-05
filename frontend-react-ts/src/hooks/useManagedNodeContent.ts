import { useCallback, useEffect, useState, useRef } from 'react';
import { shallow } from 'zustand/shallow';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store/store';

import { 
  useNodeContentStore, 
  NodeContent, 
  setNodeContent as setContentInStore,
  markNodeDirty as markContentDirtyInStore,
  isNodeDirty as isContentDirtyInStore,
  getNodeContent as getContentFromStore
} from '../store/nodeContentStore';
import { updateNodeData } from '../store/flowSlice';
import { NodeData } from '../types/nodes'; // Assuming NodeData exists and is relevant

interface UseManagedNodeContentResult {
  content: NodeContent; // The current content for the node
  isDirty: boolean; // Is the content different from the last saved state?
  updateContent: (updatedFields: Partial<NodeContent>) => void; // Update content in Zustand, mark as dirty
  saveContent: () => void; // Persist content from Zustand to Redux
}

/**
 * Hook to manage the content of a specific node, abstracting interaction 
 * with the nodeContentStore and persistence to Redux.
 * Simplified version relying directly on Zustand store state.
 * 
 * @param nodeId The ID of the node whose content is being managed.
 * @param initialNodeData The initial NodeData from Redux/props, used for persistence.
 * @returns An object with content state and functions to update/save it.
 */
export const useManagedNodeContent = (nodeId: string, initialNodeData: NodeData): UseManagedNodeContentResult => {
  const dispatch = useDispatch();

  // Get current node data from Redux store
  const currentNodeDataFromRedux = useSelector((state: RootState) => state.flow.nodes.find(n => n.id === nodeId)?.data);

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
   * Persists the current content from the Zustand store to Redux if dirty.
   * Resets the dirty flag in Zustand after successful persistence.
   */
  const saveContent = useCallback(() => {
    // Check dirtiness directly from the Zustand store state/selector
    if (isContentDirtyInStore(nodeId)) { 
      console.log(`[useManagedNodeContent ${nodeId}] Saving dirty content to Redux...`);
      // Get the latest content directly from the store
      const contentToSave = getContentFromStore(nodeId); 
      
      // Ensure we have both the content to save and the current data from Redux
      if (!contentToSave || !currentNodeDataFromRedux) {
        console.warn(`[useManagedNodeContent ${nodeId}] Cannot save: Content from Zustand or current Redux data missing.`);
        // Optionally, try falling back to initialNodeData or handle error
        // For now, just return to prevent incorrect merge
        return; 
      }

      // Prepare the data payload using CURRENT Redux data as base
      const dataPayload: Partial<NodeData> = {
        ...currentNodeDataFromRedux, // Use current Redux data as base
        ...contentToSave,           // Merge latest content changes on top
      };

      // Dispatch the update action to Redux
      dispatch(updateNodeData({ nodeId, data: dataPayload }));

      // Mark content as clean in the Zustand store AFTER dispatching
      markContentDirtyInStore(nodeId, false);

      console.log(`[useManagedNodeContent ${nodeId}] Content saved to Redux, marked clean.`);
    } else {
      console.log(`[useManagedNodeContent ${nodeId}] No dirty content in store to save.`);
    }
  }, [dispatch, nodeId, initialNodeData, currentNodeDataFromRedux]);

  // Return state directly from Zustand selector and the simplified callbacks
  return {
    content,
    isDirty,
    updateContent,
    saveContent,
  };
}; 