import { createNodeDataHook } from './useNodeDataFactory';
import { JSONExtractorNodeContent } from '../types/nodes';

/**
 * Default values for JSON Extractor node content
 */
const JSON_EXTRACTOR_DEFAULTS: Partial<JSONExtractorNodeContent> = {
  path: '',
  label: 'JSON Extractor'
};

/**
 * Return type for useJsonExtractorNodeData hook
 */
interface JsonExtractorNodeDataHook {
  content: JSONExtractorNodeContent | undefined;
  path: string;
  label: string;
  defaultValue: any;
  handlePathChange: (value: string) => void;
  handleLabelChange: (value: string) => void;
  handleDefaultValueChange: (value: any) => void;
  updateContent: (updates: Partial<JSONExtractorNodeContent>) => void;
}

/**
 * Custom hook to manage JSON Extractor node state and operations.
 * Uses the standardized hook factory pattern.
 */
export const useJsonExtractorNodeData = (nodeId: string): JsonExtractorNodeDataHook => {
  // Use the factory to create the base hook functionality
  return createNodeDataHook<JSONExtractorNodeContent, JsonExtractorNodeDataHook>(
    'json-extractor',
    (params) => {
      const { 
        content, 
        updateContent: updateExtractorContent, 
        createChangeHandler 
      } = params;

      // Extract properties with defaults for safety
      const path = content?.path || JSON_EXTRACTOR_DEFAULTS.path || '';
      const label = content?.label || JSON_EXTRACTOR_DEFAULTS.label || '';
      const defaultValue = content?.defaultValue; // Optional, no default

      // Create standard change handlers
      const handlePathChange = createChangeHandler('path');
      const handleLabelChange = createChangeHandler('label');
      const handleDefaultValueChange = createChangeHandler('defaultValue');

      return {
        // Data
        content,
        path,
        label,
        defaultValue,
        
        // Change Handlers
        handlePathChange,
        handleLabelChange,
        handleDefaultValueChange,
        
        // Direct update method
        updateContent: updateExtractorContent
      };
    },
    JSON_EXTRACTOR_DEFAULTS
  )({ nodeId });
}; 