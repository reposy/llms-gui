import { useCallback } from 'react';
import { useNodeContent, ConditionalNodeContent, useNodeContentStore } from '../store/useNodeContentStore';
import { isEqual } from 'lodash';
import { ConditionType } from '../types/nodes';

/**
 * Custom hook to manage Conditional node state and operations using Zustand store.
 * Centralizes logic for ConditionalNode component
 */
export const useConditionalNodeData = ({ 
  nodeId
}: { 
  nodeId: string
}) => {
  // Use the general NodeContent hook with correct type and nodeType
  const { 
    content: generalContent, 
    updateContent,
  } = useNodeContent<ConditionalNodeContent>(nodeId, 'conditional');
  
  // const isContentDirty = useNodeContentStore(state => state.isNodeDirty(nodeId)); // Removed: Use useDirtyTracker instead

  // Cast the general content to ConditionalNodeContent type
  const content = generalContent as ConditionalNodeContent;

  // Destructure content for easier access
  const conditionType = content.conditionType || 'contains';
  const conditionValue = content.conditionValue || '';
  const label = content.label || 'Conditional Node';

  /**
   * Handle condition type change with deep equality check
   */
  const handleConditionTypeChange = useCallback((newType: ConditionType) => {
    if (isEqual(newType, conditionType)) {
      console.log(`[ConditionalNode ${nodeId}] Skipping condition type update - no change (deep equal)`);
      return;
    }
    updateContent({ conditionType: newType });
  }, [nodeId, conditionType, updateContent]);

  /**
   * Handle condition value change with deep equality check
   */
  const handleValueChange = useCallback((newValue: string) => {
    if (isEqual(newValue, conditionValue)) {
      console.log(`[ConditionalNode ${nodeId}] Skipping condition value update - no change (deep equal)`);
      return;
    }
    updateContent({ conditionValue: newValue });
  }, [nodeId, conditionValue, updateContent]);

  /**
   * Update multiple properties at once with deep equality check
   */
  const updateConditionalContent = useCallback((updates: Partial<ConditionalNodeContent>) => {
    const hasChanges = Object.entries(updates).some(([key, value]) => {
      const currentValue = content[key as keyof ConditionalNodeContent];
      return !isEqual(currentValue, value);
    });
    
    if (!hasChanges) {
      console.log(`[ConditionalNode ${nodeId}] Skipping content update - no changes in update object (deep equal)`);
      return;
    }
    
    const newContent = { ...content, ...updates };

    if (isEqual(newContent, content)) {
      console.log(`[ConditionalNode ${nodeId}] Skipping content update - merged content unchanged (deep equal)`);
      return;
    }
    
    console.log(`[ConditionalNode ${nodeId}] Updating content with:`, updates);
    updateContent(updates);
  }, [nodeId, content, updateContent]);

  return {
    // Data
    content,
    conditionType,
    conditionValue,
    label,
    // isDirty: isContentDirty, // Removed
    
    // Event handlers
    handleConditionTypeChange,
    handleValueChange,
    updateConditionalContent,
  };
}; 