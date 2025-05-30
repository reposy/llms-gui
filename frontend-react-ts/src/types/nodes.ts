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

// 모든 노드의 공통 속성 (isDirty는 선택적으로 사용)
export interface BaseNodeData {
  label?: string;
  isDirty?: boolean;
  [key: string]: any;
}

export interface LlmNodeProperty extends BaseNodeData {
  type: 'llm';
  provider: 'ollama' | 'openai';
  model: string;
  prompt: string;
  temperature: number;
  ollamaUrl?: string;
  openaiApiKey?: string;
  mode?: LLMMode;
  viewMode?: NodeViewMode;
  maxTokens?: number;
  responseContent?: LLMResult | string;
  isStreaming?: boolean;
  streamingResult?: string;
  selectedFiles?: File[];
  hasImageInputs?: boolean;
}

export interface OutputNodeProperty extends BaseNodeData {
  type: 'output';
  format?: OutputFormat;
  content?: string;
  mode?: 'read' | 'write';
  viewMode?: NodeViewMode;
}

export interface APINodeProperty extends BaseNodeData {
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

export interface JSONExtractorNodeProperty extends BaseNodeData {
  type: 'json-extractor';
  path: string;
  defaultValue?: any;
  viewMode?: NodeViewMode;
}

export interface InputNodeProperty extends BaseNodeData {
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

export interface GroupNodeProperty extends BaseNodeData {
  type: 'group';
  isCollapsed?: boolean;
  iterationConfig?: {
    sourceNodeId: string;
  };
}

export interface ConditionalNodeProperty extends BaseNodeData {
  type: 'conditional';
  conditionType: ConditionType;
  conditionValue: string;
  lastEvaluationResult?: boolean | null;
}

export interface MergerNodeProperty extends BaseNodeData {
  type: 'merger';
  mergeMode?: 'concat' | 'join' | 'object';
  joinSeparator?: string;
  arrayStrategy?: 'flatten' | 'preserve';
  propertyNames?: string[];
  waitForAll?: boolean;
  items?: any[];
}

export interface WebCrawlerNodeProperty extends BaseNodeData {
  type: 'web-crawler';
  url?: string;
  waitForSelector?: string;
  extractSelectors?: Record<string, string>;
  timeout?: number;
  headers?: Record<string, string>;
  includeHtml?: boolean;
  outputFormat?: 'full' | 'text' | 'extracted' | 'html';
}

export interface HTMLParserNodeProperty extends BaseNodeData {
  type: 'html-parser';
  extractionRules?: ExtractionRule[];
}

// 전체 노드 데이터 유니온 타입
export type NodeProperty =
  | LlmNodeProperty
  | APINodeProperty
  | OutputNodeProperty
  | JSONExtractorNodeProperty
  | InputNodeProperty
  | GroupNodeProperty
  | ConditionalNodeProperty
  | MergerNodeProperty
  | WebCrawlerNodeProperty
  | HTMLParserNodeProperty;

// =========== 유틸리티 타입 정의 ===========

// 플로우 상태 인터페이스
export interface FlowState {
  nodes: Node<NodeProperty>[];
  edges: Edge[];
  selectedNodeId: string | null;
}

// 플로우 노드 및 엣지 타입
export type FlowNode = Node<NodeProperty>;
export type FlowEdge = Edge;

// 커스텀 노드 타입
export type CustomNode<T extends BaseNodeData = BaseNodeData> = Node<T, NodeType>;

// 노드 타입과 컨텐츠 타입 매핑
export type NodeTypeMap = {
  'api': APINodeProperty;
  'input': InputNodeProperty;
  'output': OutputNodeProperty;
  'conditional': ConditionalNodeProperty;
  'group': GroupNodeProperty;
  'merger': MergerNodeProperty;
  'llm': LlmNodeProperty;
  'web-crawler': WebCrawlerNodeProperty;
  'json-extractor': JSONExtractorNodeProperty;
  'html-parser': HTMLParserNodeProperty;
};

export type LLMProvider = 'ollama' | 'openai';

// Flow 그래프 인터페이스
export interface FlowGraph {
  nodes: Node<NodeProperty>[];
  edges: Edge[];
  selectedNodeId: string | null;
}