import { useCallback } from 'react';
import { createNodeDataHook } from './useNodeDataFactory';
import { GroupNodeContent } from '../types/nodes';

/**
 * Default values for Group node content
 */
const GROUP_DEFAULTS: Partial<GroupNodeContent> = {
  isCollapsed: false,
  label: '',
  items: []
};

/**
 * Return type for useGroupNodeData hook
 * Explicitly defining return type helps TypeScript understand the guarantees we're making
 */
interface GroupNodeDataHook {
  content: GroupNodeContent | undefined;
  label: string; // Explicitly marked as string (not string | undefined)
  isCollapsed: boolean;
  items: any[];
  handleLabelChange: (nodeId: string, newLabel: string) => void;
  toggleCollapse: () => void;
  updateContent: (updates: Partial<GroupNodeContent>) => void;
  updateItems: (newItems: any[]) => void;
}

/**
 * Custom hook to manage Group node state and operations.
 * Uses the standardized hook factory pattern.
 */
export const useGroupNodeData = ({ nodeId }: { nodeId: string }): GroupNodeDataHook => {
  // Use the factory to create the base hook functionality
  return createNodeDataHook<GroupNodeContent, GroupNodeDataHook>(
    'group', 
    (params) => {
      const { 
        content, 
        updateContent: updateGroupContent 
      } = params;

      // Extract properties with defaults for easier access
      const isCollapsed = content?.isCollapsed || GROUP_DEFAULTS.isCollapsed || false;
      // Ensure label is always a string
      const label = content?.label || GROUP_DEFAULTS.label || '';
      const items = content?.items || GROUP_DEFAULTS.items || [];

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

      /**
       * Update items (execution results)
       */
      const updateItems = useCallback((newItems: any[]) => {
        updateGroupContent({ items: newItems });
      }, [updateGroupContent]);

      return {
        // Data
        content,
        label,
        isCollapsed,
        items,
        
        // Event handlers
        handleLabelChange,
        toggleCollapse,
        updateContent: updateGroupContent,
        updateItems
      };
    },
    GROUP_DEFAULTS
  )({ nodeId });
}; 