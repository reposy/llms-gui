import { FileLikeObject } from '../../types/nodes';
import { InputNodeContent } from '../../types/nodes';

/**
 * Base content type for all nodes
 */
export interface BaseNodeContent {
  label?: string;
  isDirty?: boolean;
  _forceUpdate?: number;
}

/**
 * LLM node content
 */
export interface LLMNodeContent extends BaseNodeContent {
  prompt?: string;
  model?: string;
  temperature?: number;
  provider?: 'ollama' | 'openai';
  ollamaUrl?: string;
  openaiApiKey?: string;
  mode?: 'text' | 'vision';
  content?: string;
}

/**
 * API node content
 */
export interface APINodeContent extends BaseNodeContent {
  url?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: string;
  queryParams?: Record<string, string>;
  useInputAsBody?: boolean;
  contentType?: string;
  bodyFormat?: 'key-value' | 'raw';
  bodyParams?: Array<{ key: string; value: string; enabled: boolean }>;
}

/**
 * Output node content
 */
export interface OutputNodeContent extends BaseNodeContent {
  format?: 'json' | 'text';
  content?: string;
  mode?: 'batch' | 'foreach';
}

/**
 * Input node content - REMOVED as now defined in types/nodes.ts
 */
/*
export interface InputNodeContent extends BaseNodeContent {
  items?: string[];
  textBuffer?: string;
  iterateEachRow?: boolean;
  executionMode?: 'batch' | 'foreach';
  chainingUpdateMode?: 'common' | 'replaceCommon' | 'element' | 'none'; 
}
*/

/**
 * JSON Extractor node content
 */
export interface JSONExtractorNodeContent extends BaseNodeContent {
  path?: string;
}

/**
 * Group node content
 */
export interface GroupNodeContent extends BaseNodeContent {
  isCollapsed?: boolean;
}

/**
 * Conditional node content
 */
export interface ConditionalNodeContent extends BaseNodeContent {
  conditionType?: 'contains' | 'greater_than' | 'less_than' | 'equal_to' | 'json_path';
  conditionValue?: string;
}

/**
 * Merger node content
 */
export interface MergerNodeContent extends BaseNodeContent {
  items?: any[];
}

/**
 * Web Crawler node content
 */
export interface WebCrawlerNodeContent extends BaseNodeContent {
  url?: string;
  waitForSelector?: string;
  extractSelectors?: Record<string, string>;
  timeout?: number;
  headers?: Record<string, string>;
  includeHtml?: boolean;
  outputFormat?: 'full' | 'text' | 'extracted' | 'html';
}

/**
 * Union type for all node content types
 */
export type NodeContent = 
  | LLMNodeContent
  | APINodeContent
  | OutputNodeContent
  | JSONExtractorNodeContent
  | GroupNodeContent
  | ConditionalNodeContent
  | MergerNodeContent
  | WebCrawlerNodeContent;

/**
 * Type guard to check if content is InputNodeContent
 */
export const isInputNodeContent = (content: NodeContent): content is InputNodeContent => {
  return content && (content as any).type === 'input';
};

/**
 * Type guard to check if content is LLMNodeContent
 */
export const isLLMNodeContent = (content: NodeContent): content is LLMNodeContent => {
  return !!content && typeof content === 'object' && 'prompt' in content;
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
 * Constants
 */
export const MAX_PERSISTED_CONTENT_LENGTH = 1000; // Limit string content size for persistence 