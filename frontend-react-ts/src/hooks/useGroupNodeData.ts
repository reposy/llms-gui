import { useCallback } from 'react';
import { useNodeContent, GroupNodeContent } from '../store/useNodeContentStore';

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
   * Handle label change
   */
  const handleLabelChange = useCallback((newLabel: string) => {
    setContent({ label: newLabel });
  }, [setContent]);

  /**
   * Toggle collapse state
   */
  const toggleCollapse = useCallback(() => {
    setContent({ isCollapsed: !isCollapsed });
  }, [isCollapsed, setContent]);

  /**
   * Update multiple properties at once
   */
  const updateGroupContent = useCallback((updates: Partial<GroupNodeContent>) => {
    setContent(updates);
  }, [setContent]);

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