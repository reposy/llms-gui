import { useCallback } from 'react';
import { createNodeDataHook } from './useNodeDataFactory';
import { ConditionalNodeContent, ConditionType } from '../types/nodes';

/**
 * Default values for Conditional node content
 */
const CONDITIONAL_DEFAULTS: Partial<ConditionalNodeContent> = {
  conditionType: 'contains',
  conditionValue: '',
  label: 'Conditional Node'
};

/**
 * Custom hook to manage Conditional node state and operations.
 * Uses the standardized hook factory pattern.
 */
export const useConditionalNodeData = ({ nodeId }: { nodeId: string }) => {
  // Use the factory to create the base hook functionality
  const { 
    content, 
    updateContent: updateConditionalContent, 
    createChangeHandler 
  } = createNodeDataHook<ConditionalNodeContent>('conditional', CONDITIONAL_DEFAULTS)({ nodeId });

  // Extract properties with defaults for easier access
  const conditionType = content?.conditionType || CONDITIONAL_DEFAULTS.conditionType;
  const conditionValue = content?.conditionValue || CONDITIONAL_DEFAULTS.conditionValue;
  const label = content?.label || CONDITIONAL_DEFAULTS.label;

  // Create standard change handlers
  const handleConditionTypeChange = createChangeHandler('conditionType');
  const handleValueChange = createChangeHandler('conditionValue');

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