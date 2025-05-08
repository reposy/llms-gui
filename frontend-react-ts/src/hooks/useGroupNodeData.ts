import { useCallback } from 'react';
import { useNodeContent, GroupNodeContent, useNodeContentStore, createDefaultNodeContent } from '../store/useNodeContentStore';
import { isEqual } from 'lodash';

/**
 * Custom hook to manage Group node state and operations using Zustand store.
 * Centralizes logic for GroupNode component
 */
export const useGroupNodeData = ({ 
  nodeId
}: { 
  nodeId: string
}) => {
  const contentSelector = useCallback(
    (state) => state.getNodeContent(nodeId, 'group') as GroupNodeContent,
    [nodeId]
  );
  const content = useNodeContentStore(contentSelector);

  // Use optional chaining for safety
  const isCollapsed = content?.isCollapsed || false;
  const label = content?.label || ''; // Get the current label

  const updateContent = useNodeContentStore(state => state.setNodeContent);

  // Ensure content is defined and provide defaults defensively
  const contentFromHook = content || createDefaultNodeContent('group', nodeId) as GroupNodeContent;

  /**
   * Handle label change to match EditableNodeLabel signature
   */
  const handleLabelChange = useCallback((_nodeId: string, newLabel: string) => {
    console.log(`[GroupNode ${nodeId}] Handling label change with new label:`, newLabel);
    updateContent(nodeId, { label: newLabel });
  }, [nodeId, updateContent]);

  /**
   * Toggle collapse state with deep equality check
   */
  const toggleCollapse = useCallback(() => {
    const newCollapsed = !isCollapsed;
    if (isEqual(newCollapsed, isCollapsed)) {
      console.log(`[GroupNode ${nodeId}] Skipping collapse toggle - no change (deep equal)`);
      return;
    }
    updateContent(nodeId, { isCollapsed: newCollapsed });
  }, [nodeId, isCollapsed, updateContent]);

  /**
   * Update multiple properties at once with deep equality check
   */
  const updateGroupContent = useCallback((updates: Partial<GroupNodeContent>) => {
    const hasChanges = Object.entries(updates).some(([key, value]) => {
      const currentValue = content[key as keyof GroupNodeContent];
      return !isEqual(currentValue, value);
    });
    
    if (!hasChanges) {
      console.log(`[GroupNode ${nodeId}] Skipping content update - no changes in update object (deep equal)`);
      return;
    }
    
    const newContent = { ...content, ...updates };

    if (isEqual(newContent, content)) {
      console.log(`[GroupNode ${nodeId}] Skipping content update - merged content unchanged (deep equal)`);
      return;
    }
    
    console.log(`[GroupNode ${nodeId}] Updating content with:`, updates);
    updateContent(nodeId, updates);
  }, [nodeId, content, updateContent]);

  return {
    // Data
    content,
    label,
    isCollapsed,
    
    // Event handlers
    handleLabelChange,
    toggleCollapse,
    updateGroupContent,
  };
}; 