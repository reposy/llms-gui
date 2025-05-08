import { useCallback } from 'react';
import { useNodeContentStore } from '../store/useNodeContentStore';
import { GroupNodeContent } from '../types/nodes';
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
  // Get the content directly from store with proper typing
  const content = useNodeContentStore(
    useCallback(
      (state) => state.getNodeContent(nodeId, 'group') as GroupNodeContent,
      [nodeId]
    )
  );
  
  // Get the setNodeContent function
  const setNodeContent = useNodeContentStore(state => state.setNodeContent);

  // Extract properties with defaults for safety
  const isCollapsed = content?.isCollapsed || false;
  const label = content?.label || '';

  /**
   * Update content with deep equality check to prevent unnecessary updates
   */
  const updateGroupContent = useCallback((updates: Partial<GroupNodeContent>) => {
    // Check if any individual updates differ from current values
    const hasChanges = Object.entries(updates).some(([key, value]) => {
      const currentValue = content[key as keyof GroupNodeContent];
      return !isEqual(currentValue, value);
    });
    
    if (!hasChanges) {
      console.log(`[GroupNode ${nodeId}] Skipping content update - no changes (deep equal)`);
      return;
    }
    
    console.log(`[GroupNode ${nodeId}] Updating content with:`, updates);
    setNodeContent(nodeId, updates);
  }, [nodeId, content, setNodeContent]);

  /**
   * Handle label change to match EditableNodeLabel signature
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