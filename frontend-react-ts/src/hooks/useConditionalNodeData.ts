import { useCallback } from 'react';
import { useNodeContentStore } from '../store/useNodeContentStore';
import { isEqual } from 'lodash';
import { ConditionalNodeContent, ConditionType } from '../types/nodes';

/**
 * Custom hook to manage Conditional node state and operations using Zustand store.
 * Centralizes logic for ConditionalNode component
 */
export const useConditionalNodeData = ({ 
  nodeId
}: { 
  nodeId: string
}) => {
  // Get the content using proper selector pattern
  const content = useNodeContentStore(
    useCallback(
      (state) => state.getNodeContent(nodeId, 'conditional') as ConditionalNodeContent,
      [nodeId]
    )
  );
  
  // Get the setNodeContent function
  const setNodeContent = useNodeContentStore(state => state.setNodeContent);

  // Extract properties with defaults for safety
  const conditionType = content?.conditionType || 'contains';
  const conditionValue = content?.conditionValue || '';
  const label = content?.label || 'Conditional Node';

  /**
   * Update content with deep equality check to prevent unnecessary updates
   */
  const updateConditionalContent = useCallback((updates: Partial<ConditionalNodeContent>) => {
    // Check if any individual updates differ from current values
    const hasChanges = Object.entries(updates).some(([key, value]) => {
      const currentValue = content[key as keyof ConditionalNodeContent];
      return !isEqual(currentValue, value);
    });
    
    if (!hasChanges) {
      console.log(`[ConditionalNode ${nodeId}] Skipping content update - no changes (deep equal)`);
      return;
    }
    
    console.log(`[ConditionalNode ${nodeId}] Updating content with:`, updates);
    setNodeContent(nodeId, updates);
  }, [nodeId, content, setNodeContent]);

  /**
   * Handle condition type change
   */
  const handleConditionTypeChange = useCallback((newType: ConditionType) => {
    updateConditionalContent({ conditionType: newType });
  }, [updateConditionalContent]);

  /**
   * Handle condition value change
   */
  const handleValueChange = useCallback((newValue: string) => {
    updateConditionalContent({ conditionValue: newValue });
  }, [updateConditionalContent]);

  return {
    // Data
    content,
    conditionType,
    conditionValue,
    label,
    
    // Event handlers
    handleConditionTypeChange,
    handleValueChange,
    updateContent: updateConditionalContent,
  };
}; 