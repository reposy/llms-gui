import { useCallback, useEffect, useState, useRef } from 'react';
import { shallow } from 'zustand/shallow';
import { useDispatch } from 'react-redux';
import { debounce } from 'lodash';

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
 * 
 * @param nodeId The ID of the node whose content is being managed.
 * @param initialNodeData The initial NodeData from Redux/props, used for persistence.
 * @returns An object with content state and functions to update/save it.
 */
export const useManagedNodeContent = (nodeId: string, initialNodeData: NodeData): UseManagedNodeContentResult => {
  const dispatch = useDispatch();

  // --- State from Zustand Store ---
  // Select multiple fields from the store, using shallow comparison
  const { 
    contentFromStore, 
    isDirtyInStore 
  } = useNodeContentStore(
    state => ({
      contentFromStore: state.nodeContents[nodeId] || {},
      isDirtyInStore: state.nodeContents[nodeId]?.isDirty ?? false,
    }),
    shallow // Use shallow comparison for the selected object
  );

  // --- Internal State ---
  // Local copy of content for editing purposes, initialized from the store
  const [localContent, setLocalContent] = useState<NodeContent>(contentFromStore);
  // Track if local changes have been made since the last load from store
  const [hasLocalChanges, setHasLocalChanges] = useState(false); 

  // Ref to store the initial content loaded from the store to compare for dirtiness
  const initialContentRef = useRef<NodeContent>(contentFromStore);

  // --- Update local state when content from store changes (e.g., due to loadFromReduxNodes) ---
  useEffect(() => {
    // Only update local state if it wasn't triggered by this hook's save action
    // and if the content in the store actually differs from the initial loaded state
    // This helps prevent loops if store updates happen rapidly
    if (!shallow(contentFromStore, localContent) && !shallow(contentFromStore, initialContentRef.current)) {
      console.log(`[useManagedNodeContent ${nodeId}] Syncing localContent from store change`);
      setLocalContent(contentFromStore);
      initialContentRef.current = contentFromStore; // Reset baseline
      setHasLocalChanges(false); // Content came from store, so no local changes pending
    }
  }, [nodeId, contentFromStore]); // Depend only on store content

  // --- Derived State ---
  // The effective content to be displayed/used by the UI component
  const content = localContent; 
  // Determine overall dirtiness: either store marks it dirty OR local changes exist
  const isDirty = isDirtyInStore || hasLocalChanges; 

  // --- Callbacks ---
  /**
   * Updates the local content state and marks it as having local changes.
   * Also updates the Zustand store immediately but doesn't trigger save.
   */
  const updateContent = useCallback((updatedFields: Partial<NodeContent>) => {
    const newContent = { ...localContent, ...updatedFields };
    setLocalContent(newContent);
    setHasLocalChanges(true); // Mark local changes

    // Also update the Zustand store immediately and mark it dirty there too
    setContentInStore(nodeId, updatedFields); 
    // Note: setContentInStore already marks dirty, but explicitly call if needed
    // markContentDirtyInStore(nodeId, true); 

    console.log(`[useManagedNodeContent ${nodeId}] Updated local content & store. Local changes: true`, updatedFields);
  }, [nodeId, localContent]);

  /**
   * Persists the current content from the Zustand store to Redux.
   * Resets the dirty flags after successful persistence.
   */
  const saveContent = useCallback(() => {
    // Only save if there are actual changes marked in the store
    if (isContentDirtyInStore(nodeId)) { 
      console.log(`[useManagedNodeContent ${nodeId}] Saving content to Redux...`);
      // Get the latest content directly from the store to ensure we save what's there
      const contentToSave = getContentFromStore(nodeId); 
      
      if (!contentToSave) {
        console.warn(`[useManagedNodeContent ${nodeId}] No content found in store to save.`);
        return;
      }

      // Prepare the data payload for Redux update
      // Important: Merge the content into the *initial* node data structure
      // provided to the hook to ensure type correctness and avoid overwriting
      // structural properties managed elsewhere.
      const dataPayload: Partial<NodeData> = {
        ...initialNodeData, // Start with the base structure/config
        ...contentToSave,   // Overlay the saved content fields
      };

      // Dispatch the update action to Redux
      dispatch(updateNodeData({ nodeId, data: dataPayload }));

      // Mark content as clean in the Zustand store AFTER dispatching
      markContentDirtyInStore(nodeId, false);

      // Reset local state tracking
      setHasLocalChanges(false);
      initialContentRef.current = contentToSave; // Update baseline to saved content

      console.log(`[useManagedNodeContent ${nodeId}] Content saved to Redux, marked clean.`);
    } else {
      console.log(`[useManagedNodeContent ${nodeId}] No dirty content in store to save.`);
       // Even if store wasn't dirty, ensure local tracking is reset if needed
      if (hasLocalChanges) {
         setHasLocalChanges(false);
         initialContentRef.current = localContent;
      }
    }
  }, [dispatch, nodeId, initialNodeData, hasLocalChanges, localContent]); // Add local state dependencies

  return {
    content,
    isDirty,
    updateContent,
    saveContent,
  };
}; 