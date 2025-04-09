import { useCallback } from 'react';
import { useNodeContent, GroupNodeContent } from '../store/useNodeContentStore';
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
  // Use the general NodeContentStore with GroupNodeContent type
  const { 
    content: generalContent, 
    setContent,
    isContentDirty
  } = useNodeContent(nodeId);

  // Cast the general content to GroupNodeContent type
  const content = generalContent as GroupNodeContent;

  // Destructure content for easier access
  const label = content.label || 'Group';
  const isCollapsed = content.isCollapsed || false;

  /**
   * Handle label change with deep equality check
   */
  const handleLabelChange = useCallback((newLabel: string) => {
    if (isEqual(newLabel, label)) {
      console.log(`[GroupNode ${nodeId}] Skipping label update - no change (deep equal)`);
      return;
    }
    setContent({ label: newLabel });
  }, [nodeId, label, setContent]);

  /**
   * Toggle collapse state with deep equality check
   */
  const toggleCollapse = useCallback(() => {
    const newCollapsed = !isCollapsed;
    if (isEqual(newCollapsed, isCollapsed)) {
      console.log(`[GroupNode ${nodeId}] Skipping collapse toggle - no change (deep equal)`);
      return;
    }
    setContent({ isCollapsed: newCollapsed });
  }, [nodeId, isCollapsed, setContent]);

  /**
   * Update multiple properties at once with deep equality check
   */
  const updateGroupContent = useCallback((updates: Partial<GroupNodeContent>) => {
    // Skip update if no actual changes using deep equality
    const hasChanges = Object.entries(updates).some(([key, value]) => {
      const currentValue = content[key as keyof GroupNodeContent];
      return !isEqual(currentValue, value);
    });
    
    if (!hasChanges) {
      console.log(`[GroupNode ${nodeId}] Skipping content update - no changes in update object (deep equal)`);
      return;
    }
    
    // Create new content object with updates
    const newContent = {
      ...content,
      ...updates
    };

    // Final deep equality check against current content
    if (isEqual(newContent, content)) {
      console.log(`[GroupNode ${nodeId}] Skipping content update - merged content unchanged (deep equal)`);
      return;
    }
    
    console.log(`[GroupNode ${nodeId}] Updating content with:`, updates);
    setContent(updates);
  }, [nodeId, content, setContent]);

  return {
    // Data
    content,
    label,
    isCollapsed,
    isDirty: isContentDirty,
    
    // Event handlers
    handleLabelChange,
    toggleCollapse,
    updateGroupContent,
  };
}; 