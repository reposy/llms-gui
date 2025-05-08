import { useCallback } from 'react';
import { createNodeDataHook } from './useNodeDataFactory';
import { GroupNodeContent } from '../types/nodes';

/**
 * Default values for Group node content
 */
const GROUP_DEFAULTS: Partial<GroupNodeContent> = {
  isCollapsed: false,
  label: ''
};

/**
 * Custom hook to manage Group node state and operations.
 * Uses the standardized hook factory pattern.
 */
export const useGroupNodeData = ({ nodeId }: { nodeId: string }) => {
  // Use the factory to create the base hook functionality
  const { 
    content, 
    updateContent: updateGroupContent 
  } = createNodeDataHook<GroupNodeContent>('group', GROUP_DEFAULTS)({ nodeId });

  // Extract properties with defaults for easier access
  const isCollapsed = content?.isCollapsed || GROUP_DEFAULTS.isCollapsed;
  const label = content?.label || GROUP_DEFAULTS.label;

  /**
   * Handle label change to match EditableNodeLabel signature
   * Note: This has a special signature different from standard handlers
   */
  const handleLabelChange = useCallback((_nodeId: string, newLabel: string) => {
    updateGroupContent({ label: newLabel });
  }, [updateGroupContent]);

  /**
   * Toggle collapse state
   */
  const toggleCollapse = useCallback(() => {
    updateGroupContent({ isCollapsed: !isCollapsed });
  }, [isCollapsed, updateGroupContent]);

  return {
    // Data
    content,
    label,
    isCollapsed,
    
    // Event handlers
    handleLabelChange,
    toggleCollapse,
    updateContent: updateGroupContent,
  };
}; 