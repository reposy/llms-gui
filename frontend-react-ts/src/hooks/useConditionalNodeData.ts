import { useCallback, ChangeEvent } from 'react';
import { useNodeContent, ConditionalNodeContent } from '../store/useNodeContentStore';

/**
 * Custom hook to manage Conditional node state and operations using Zustand store.
 * Centralizes logic for ConditionalNode component
 */
export const useConditionalNodeData = ({ 
  nodeId
}: { 
  nodeId: string
}) => {
  // Use the general NodeContentStore with ConditionalNodeContent type
  const { 
    content: generalContent, 
    setContent,
    isContentDirty
  } = useNodeContent(nodeId);

  // Cast the general content to ConditionalNodeContent type
  const content = generalContent as ConditionalNodeContent;

  // Destructure content for easier access
  const conditionType = content.conditionType || 'contains';
  const conditionValue = content.conditionValue || '';
  const label = content.label || 'Conditional Node';

  /**
   * Handle condition type change
   */
  const handleConditionTypeChange = useCallback((newType: ConditionalNodeContent['conditionType']) => {
    setContent({ conditionType: newType });
  }, [setContent]);

  /**
   * Handle value change
   */
  const handleValueChange = useCallback((newValue: string) => {
    setContent({ conditionValue: newValue });
  }, [setContent]);

  /**
   * Update multiple properties at once
   */
  const updateConditionalContent = useCallback((updates: Partial<ConditionalNodeContent>) => {
    setContent(updates);
  }, [setContent]);

  return {
    // Data
    content,
    conditionType,
    conditionValue,
    label,
    isDirty: isContentDirty,
    
    // Event handlers
    handleConditionTypeChange,
    handleValueChange,
    updateConditionalContent,
  };
}; 