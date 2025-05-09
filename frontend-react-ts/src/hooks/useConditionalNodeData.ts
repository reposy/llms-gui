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
 * Return type for useConditionalNodeData hook
 */
interface ConditionalNodeDataHook {
  content: ConditionalNodeContent | undefined;
  conditionType: ConditionType | undefined;
  conditionValue: string;
  label: string;
  handleConditionTypeChange: (value: ConditionType) => void;
  handleValueChange: (value: string) => void;
  updateContent: (updates: Partial<ConditionalNodeContent>) => void;
}

/**
 * Custom hook to manage Conditional node state and operations.
 * Uses the standardized hook factory pattern.
 */
export const useConditionalNodeData = ({ nodeId }: { nodeId: string }): ConditionalNodeDataHook => {
  // Use the factory to create the base hook functionality
  return createNodeDataHook<ConditionalNodeContent, ConditionalNodeDataHook>(
    'conditional',
    (params) => {
      const { 
        content, 
        updateContent: updateConditionalContent, 
        createChangeHandler 
      } = params;

      // Extract properties with defaults for easier access
      const conditionType = content?.conditionType || CONDITIONAL_DEFAULTS.conditionType;
      const conditionValue = content?.conditionValue || CONDITIONAL_DEFAULTS.conditionValue || '';
      const label = content?.label || CONDITIONAL_DEFAULTS.label || '';

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
    },
    CONDITIONAL_DEFAULTS
  )({ nodeId });
}; 