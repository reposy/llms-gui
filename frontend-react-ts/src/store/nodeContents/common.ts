import { 
  FileLikeObject, 
  InputNodeContent, 
  NodeContent,
  BaseNodeContent,
  LLMNodeContent,
  APINodeContent,
  OutputNodeContent,
  JSONExtractorNodeContent,
  GroupNodeContent,
  ConditionalNodeContent,
  MergerNodeContent,
  WebCrawlerNodeContent,
  HTMLParserNodeContent
} from '../../types/nodes';

// Export node content types
export type {
  NodeContent,
  InputNodeContent,
  LLMNodeContent,
  APINodeContent,
  OutputNodeContent,
  JSONExtractorNodeContent,
  GroupNodeContent, 
  ConditionalNodeContent,
  MergerNodeContent,
  WebCrawlerNodeContent,
  HTMLParserNodeContent,
  BaseNodeContent,
  FileLikeObject
};

/**
 * Type guard to check if content is InputNodeContent
 */
export const isInputNodeContent = (content: NodeContent): content is InputNodeContent => {
  return !!content && typeof content === 'object' && 'items' in content && 'executionMode' in content;
};

/**
 * Type guard to check if content is LLMNodeContent
 */
export const isLLMNodeContent = (content: NodeContent): content is LLMNodeContent => {
  return !!content && typeof content === 'object' && 'prompt' in content && 'model' in content;
};

/**
 * Type guard to check if content is APINodeContent
 */
export const isAPINodeContent = (content: NodeContent): content is APINodeContent => {
  return !!content && typeof content === 'object' && 'url' in content && 'method' in content;
};

/**
 * Type guard to check if content is OutputNodeContent
 */
export const isOutputNodeContent = (content: NodeContent): content is OutputNodeContent => {
  return !!content && typeof content === 'object' && 'format' in content;
};

/**
 * Type guard to check if content is JSONExtractorNodeContent
 */
export const isJSONExtractorNodeContent = (content: NodeContent): content is JSONExtractorNodeContent => {
  return !!content && typeof content === 'object' && 'path' in content;
};

/**
 * Type guard to check if content is GroupNodeContent
 */
export const isGroupNodeContent = (content: NodeContent): content is GroupNodeContent => {
  return !!content && typeof content === 'object' && 'isCollapsed' in content;
};

/**
 * Type guard to check if content is ConditionalNodeContent
 */
export const isConditionalNodeContent = (content: NodeContent): content is ConditionalNodeContent => {
  return !!content && typeof content === 'object' && 'conditionType' in content && 'conditionValue' in content;
};

/**
 * Type guard to check if content is MergerNodeContent
 */
export const isMergerNodeContent = (content: NodeContent): content is MergerNodeContent => {
  return !!content && typeof content === 'object' && 'strategy' in content;
};

/**
 * Type guard to check if content is WebCrawlerNodeContent
 */
export const isWebCrawlerNodeContent = (content: NodeContent): content is WebCrawlerNodeContent => {
  return !!content && typeof content === 'object' && 'url' in content && 'extractSelectors' in content;
};

/**
 * Type guard to check if content is HTMLParserNodeContent
 */
export const isHTMLParserNodeContent = (content: NodeContent): content is HTMLParserNodeContent => {
  return !!content && typeof content === 'object' && 'extractionRules' in content;
};

/**
 * Constants
 */
export const MAX_PERSISTED_CONTENT_LENGTH = 1000; // Limit string content size for persistence 