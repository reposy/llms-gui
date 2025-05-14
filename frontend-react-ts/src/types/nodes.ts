import { Node, Edge } from '@xyflow/react';
import { NodeViewMode } from '../store/viewModeStore';
// import { LLMMode } from '../api/llm'; // Remove deleted import

// =========== 공통 타입 정의 ===========

// 노드 타입 (사용 가능한 모든 노드 타입)
export type NodeType = 'llm' | 'api' | 'output' | 'json-extractor' | 'input' | 'group' | 'conditional' | 'merger' | 'web-crawler' | 'html-parser';

// 출력 포맷 타입
export type OutputFormat = 'json' | 'text';

// API 메소드 타입
export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

// LLM 모드 타입
export type LLMMode = 'text' | 'vision';

// 요청 바디 타입
export type RequestBodyType = 'none' | 'json' | 'form-data' | 'x-www-form-urlencoded' | 'raw';

// 조건 타입
export type ConditionType = 'contains' | 'greater_than' | 'less_than' | 'equal_to' | 'json_path';

// HTML 추출 규칙 인터페이스
export interface ExtractionRule {
  id?: string;
  name: string;
  target: 'text' | 'html' | 'attribute';
  selector: string;
  attribute_name?: string;
  multiple: boolean;
  pathSteps?: { level: number; tag: string; details: string }[];
}

// 파일형 객체 인터페이스
export interface FileLikeObject {
  file: string; 
  type: string;
  content?: string | ArrayBuffer;
}

// LLM 결과 인터페이스
export interface LLMResult {
  text?: string;
  completion?: string;
  response?: string;
  [key: string]: any;
}

// API 응답 인터페이스
export interface APIResponse {
  data: any;
  headers: Record<string, string>;
  status?: number;
  statusText?: string;
}

// 플로우 실행 상태 인터페이스
export interface FlowExecutionState {
  isExecuting: boolean;
  currentNodeId?: string;
  executionOrder: string[];
  nodeStates: Record<string, any>;
}

// 확장된 노드 속성 인터페이스
export interface ExtendedNodeProps {
  parentId?: string;
}

// =========== 노드 데이터 타입 정의 (React Flow 노드 타입) ===========

// 기본 노드 데이터 인터페이스 - 모든 노드 데이터 타입의 기반
export interface BaseNodeData {
  label?: string;
  // 향후 모든 노드가 공유할 속성을 여기에 추가
  [key: string]: any;
}

// LLM 노드 데이터
export interface LLMNodeData extends BaseNodeData {
  type: 'llm';
  provider: 'ollama' | 'openai';
  model: string;
  prompt: string;
  temperature: number;
  ollamaUrl?: string;
  openaiApiKey?: string;
  mode?: LLMMode;
  viewMode?: NodeViewMode;
}

// API 노드 데이터
export interface APINodeData extends BaseNodeData {
  type: 'api';
  method: HTTPMethod;
  url: string;
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
  body?: string;
  useInputAsBody?: boolean;
  contentType?: string;
  bodyFormat?: 'key-value' | 'raw';
  bodyParams?: Array<{ key: string; value: string; enabled: boolean }>;
  viewMode?: NodeViewMode;
}

// Output 노드 데이터
export interface OutputNodeData extends BaseNodeData {
  type: 'output';
  format?: OutputFormat;
  content?: string;
  mode?: 'read' | 'write';
  viewMode?: NodeViewMode;
}

// JSON Extractor 노드 데이터
export interface JSONExtractorNodeData extends BaseNodeData {
  type: 'json-extractor';
  path: string;
  defaultValue?: any;
  viewMode?: NodeViewMode;
}

// Input 노드 데이터
export interface InputNodeData extends BaseNodeData {
  type: 'input';
  inputType?: 'text' | 'file' | 'list';
  text?: string;
  textBuffer?: string;
  items?: (string | File)[];
  commonItems?: (string | File)[];
  chainingItems?: (string | File)[];
  iterateEachRow?: boolean;
  executionMode?: 'batch' | 'foreach';
  chainingUpdateMode?: 'common' | 'replaceCommon' | 'element' | 'replaceElement' | 'none';
  iterationStatus?: {
    currentIndex: number;
    totalItems: number;
    completed: boolean;
  };
}

// Group 노드 데이터
export interface GroupNodeData extends BaseNodeData {
  type: 'group';
  isCollapsed?: boolean;
  iterationConfig?: {
    sourceNodeId: string;
  };
}

// Conditional 노드 데이터
export interface ConditionalNodeData extends BaseNodeData {
  type: 'conditional';
  conditionType: ConditionType;
  conditionValue: string;
  lastEvaluationResult?: boolean | null;
}

// Merger 노드 데이터
export interface MergerNodeData extends BaseNodeData {
  type: 'merger';
  mergeMode?: 'concat' | 'join' | 'object';
  joinSeparator?: string;
  arrayStrategy?: 'flatten' | 'preserve';
  propertyNames?: string[];
  waitForAll?: boolean;
  items?: any[];
}

// Web Crawler 노드 데이터
export interface WebCrawlerNodeData extends BaseNodeData {
  type: 'web-crawler';
  url?: string;
  waitForSelector?: string;
  extractSelectors?: Record<string, string>;
  timeout?: number;
  headers?: Record<string, string>;
  includeHtml?: boolean;
  outputFormat?: 'full' | 'text' | 'extracted' | 'html';
}

// HTML Parser 노드 데이터
export interface HTMLParserNodeData extends BaseNodeData {
  type: 'html-parser';
  extractionRules?: ExtractionRule[];
}

// 전체 노드 데이터 유니온 타입
export type NodeData = 
  | LLMNodeData 
  | APINodeData 
  | OutputNodeData
  | JSONExtractorNodeData
  | InputNodeData
  | GroupNodeData
  | ConditionalNodeData
  | MergerNodeData
  | WebCrawlerNodeData
  | HTMLParserNodeData;

// =========== 노드 컨텐츠 타입 정의 (상태 관리) ===========

// 기본 노드 컨텐츠 인터페이스 - 모든 노드 컨텐츠 타입의 기반
export interface BaseNodeContent {
  label?: string;
  isDirty?: boolean;
  _forceUpdate?: number;
}

// LLM 노드 컨텐츠
export interface LLMNodeContent extends BaseNodeContent {
  provider: 'ollama' | 'openai';
  model: string;
  prompt: string;
  temperature: number;
  maxTokens?: number;
  ollamaUrl?: string;
  openaiApiKey?: string;
  mode?: LLMMode;
  responseContent?: LLMResult | string;
  isStreaming?: boolean;
  streamingResult?: string;
  selectedFiles?: File[];
  hasImageInputs?: boolean;
}

// API 노드 컨텐츠
export interface APINodeContent extends BaseNodeContent { 
  url: string;
  method: HTTPMethod;
  requestBodyType: RequestBodyType;
  requestBody?: string;
  requestHeaders?: Record<string, string>;
  queryParams?: Record<string, string>;
  useInputAsBody?: boolean;
  contentType?: string;
  response?: APIResponse | undefined;
  statusCode?: number | undefined;
  executionTime?: number | undefined;
  errorMessage?: string | undefined;
  isRunning?: boolean;
}

// Input 노드 컨텐츠
export interface InputNodeContent extends BaseNodeContent {
  items?: (string | File)[];
  commonItems?: (string | File)[];
  chainingItems?: (string | File)[];
  textBuffer?: string;
  iterateEachRow?: boolean;
  executionMode?: 'batch' | 'foreach';
  chainingUpdateMode?: 'common' | 'replaceCommon' | 'element' | 'replaceElement' | 'none';
  accumulationMode?: 'always' | 'oncePerContext' | 'none';
}

// Output 노드 컨텐츠
export interface OutputNodeContent extends BaseNodeContent {
  format?: OutputFormat;
  content?: any;
  mode?: 'read' | 'write';
}

// Text 노드 컨텐츠
export interface TextNodeContent extends BaseNodeContent {
  text: string;
}

// Conditional 노드 컨텐츠
export interface ConditionalNodeContent extends BaseNodeContent {
  conditionType: ConditionType;
  conditionValue: string;
}

// Group 노드 컨텐츠
export interface GroupNodeContent extends BaseNodeContent {
  isCollapsed: boolean;
  items?: any[];
}

// Merger 노드 컨텐츠
export interface MergerNodeContent extends BaseNodeContent {
  mergeMode?: 'concat' | 'join' | 'object';
  joinSeparator?: string;
  strategy?: 'array' | 'object';
  keys?: string[];
  waitForAll?: boolean;
  items?: any[];
  mode?: string;
  params?: any[];
  result?: any[];
}

// Web Crawler 노드 컨텐츠
export interface WebCrawlerNodeContent extends BaseNodeContent {
  url?: string;
  waitForSelectorOnPage?: string;
  iframeSelector?: string;
  waitForSelectorInIframe?: string;
  timeout?: number;
  headers?: Record<string, string>;
  extractSelectors?: Record<string, string>;
  extractElementSelector?: string;
  outputFormat?: 'text' | 'html' | 'markdown' | 'json';
}

// JSON Extractor 노드 컨텐츠
export interface JSONExtractorNodeContent extends BaseNodeContent {
  path: string;
  defaultValue?: any;
}

// HTML Parser 노드 컨텐츠
export interface HTMLParserNodeContent extends BaseNodeContent {
  url?: string;
  selector?: string;
  responseText?: string;
  extractionRules?: ExtractionRule[];
}

// 전체 노드 컨텐츠 유니온 타입
export type NodeContent = 
  | LLMNodeContent
  | APINodeContent 
  | InputNodeContent 
  | OutputNodeContent
  | TextNodeContent
  | ConditionalNodeContent
  | GroupNodeContent
  | MergerNodeContent
  | WebCrawlerNodeContent
  | JSONExtractorNodeContent
  | HTMLParserNodeContent;

// =========== 유틸리티 타입 정의 ===========

// 플로우 상태 인터페이스
export interface FlowState {
  nodes: Node<NodeData>[];
  edges: Edge[];
  selectedNodeId: string | null;
}

// 플로우 노드 및 엣지 타입
export type FlowNode = Node<NodeData>;
export type FlowEdge = Edge;

// 커스텀 노드 타입
export type CustomNode<T extends BaseNodeData = BaseNodeData> = Node<T, NodeType>;

// 노드 타입과 컨텐츠 타입 매핑
export type NodeTypeMap = {
  'api': APINodeContent;
  'input': InputNodeContent;
  'output': OutputNodeContent;
  'text': TextNodeContent;
  'conditional': ConditionalNodeContent;
  'group': GroupNodeContent;
  'merger': MergerNodeContent;
  'llm': LLMNodeContent;
  'web-crawler': WebCrawlerNodeContent;
  'json-extractor': JSONExtractorNodeContent;
  'html-parser': HTMLParserNodeContent;
};

export type LLMProvider = 'ollama' | 'openai';

// Flow 그래프 인터페이스
export interface FlowGraph {
  nodes: Node<NodeData>[];
  edges: Edge[];
  selectedNodeId: string | null;
}