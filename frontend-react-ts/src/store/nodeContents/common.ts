import { 
  FileLikeObject, 
  InputNodeProperty, 
  NodeProperty,
  BaseNodeProperty,
  LlmNodeProperty,
  APINodeProperty,
  OutputNodeProperty,
  JSONExtractorNodeProperty,
  GroupNodeProperty,
  ConditionalNodeProperty,
  MergerNodeProperty,
  WebCrawlerNodeProperty,
  HTMLParserNodeProperty
} from '../../types/nodes';

// Export node content types
export type {
  NodeProperty,
  InputNodeProperty,
  LlmNodeProperty,
  APINodeProperty,
  OutputNodeProperty,
  JSONExtractorNodeProperty,
  GroupNodeProperty, 
  ConditionalNodeProperty,
  MergerNodeProperty,
  WebCrawlerNodeProperty,
  HTMLParserNodeProperty,
  BaseNodeProperty,
  FileLikeObject
};

/**
 * Type guard to check if content is InputNodeProperty
 */
export const isInputNodeProperty = (content: NodeProperty): content is InputNodeProperty => {
  return !!content && typeof content === 'object' && 'items' in content && 'executionMode' in content;
};

/**
 * Type guard to check if content is LlmNodeProperty
 */
export const isLlmNodeProperty = (content: NodeProperty): content is LlmNodeProperty => {
  return !!content && typeof content === 'object' && 'prompt' in content && 'model' in content;
};

/**
 * Type guard to check if content is APINodeProperty
 */
export const isAPINodeProperty = (content: NodeProperty): content is APINodeProperty => {
  return !!content && typeof content === 'object' && 'url' in content && 'method' in content;
};

/**
 * Type guard to check if content is OutputNodeProperty
 */
export const isOutputNodeProperty = (content: NodeProperty): content is OutputNodeProperty => {
  return !!content && typeof content === 'object' && 'format' in content;
};

/**
 * Type guard to check if content is JSONExtractorNodeProperty
 */
export const isJSONExtractorNodeProperty = (content: NodeProperty): content is JSONExtractorNodeProperty => {
  return !!content && typeof content === 'object' && 'path' in content;
};

/**
 * Type guard to check if content is GroupNodeProperty
 */
export const isGroupNodeProperty = (content: NodeProperty): content is GroupNodeProperty => {
  return !!content && typeof content === 'object' && 'isCollapsed' in content;
};

/**
 * Type guard to check if content is ConditionalNodeProperty
 */
export const isConditionalNodeProperty = (content: NodeProperty): content is ConditionalNodeProperty => {
  return !!content && typeof content === 'object' && 'conditionType' in content && 'conditionValue' in content;
};

/**
 * Type guard to check if content is MergerNodeProperty
 */
export const isMergerNodeProperty = (content: NodeProperty): content is MergerNodeProperty => {
  return !!content && typeof content === 'object' && 'strategy' in content;
};

/**
 * Type guard to check if content is WebCrawlerNodeProperty
 */
export const isWebCrawlerNodeProperty = (content: NodeProperty): content is WebCrawlerNodeProperty => {
  return !!content && typeof content === 'object' && 'url' in content && 'extractSelectors' in content;
};

/**
 * Type guard to check if content is HTMLParserNodeProperty
 */
export const isHTMLParserNodeProperty = (content: NodeProperty): content is HTMLParserNodeProperty => {
  return !!content && typeof content === 'object' && 'extractionRules' in content;
};

/**
 * Constants
 */
export const MAX_PERSISTED_CONTENT_LENGTH = 1000; // Limit string content size for persistence 