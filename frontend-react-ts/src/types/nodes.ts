import { Node, Edge } from 'reactflow';
import { NodeViewMode } from '../store/viewModeStore';

export type NodeType = 'llm' | 'api' | 'output' | 'json-extractor' | 'input' | 'group' | 'conditional' | 'merger' | 'web-crawler';
export type OutputFormat = 'json' | 'text';
export type APIMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

// Define a FileLikeObject type for file content
export interface FileLikeObject {
  file: string; // File name
  type: string; // MIME type
  content?: string | ArrayBuffer; // Optional file content
}

// LLM 응답 타입 정의
export interface LLMResult {
  content?: string;
  text?: string;
  [key: string]: any;
}

// 플로우 실행 상태 관리
export interface FlowExecutionState {
  isExecuting: boolean;
  currentNodeId?: string;
  executionOrder: string[];
  nodeStates: Record<string, any>;
}

// 공통 노드 데이터 타입
export interface BaseNodeData {
  type: string;
  isExecuting?: boolean;
  error?: string;
  result?: string | object;
}

// LLM 노드 데이터
export interface LLMNodeData extends BaseNodeData {
  type: 'llm';
  provider: 'ollama' | 'openai';
  model: string;
  prompt: string;
  temperature: number;
  ollamaUrl?: string;
  label: string;
  viewMode?: NodeViewMode;
}

// API 노드 데이터
export interface APINodeData extends BaseNodeData {
  type: 'api';
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
  body?: string;
  useInputAsBody?: boolean;
  contentType?: string;
  bodyFormat?: 'key-value' | 'raw';
  bodyParams?: Array<{ key: string; value: string; enabled: boolean }>;
  label?: string;
  viewMode?: NodeViewMode;
}

// Output 노드 데이터
export interface OutputNodeData extends BaseNodeData {
  type: 'output';
  format: 'json' | 'text';
  content?: string;
  mode?: 'batch' | 'foreach';
  label?: string;
  viewMode?: NodeViewMode;
}

// JSON Extractor node data
export interface JSONExtractorNodeData extends BaseNodeData {
  label?: string;
  path: string;
  viewMode?: NodeViewMode;
}

// Add InputNodeData
export interface InputNodeData extends BaseNodeData {
  type: 'input';
  label: string;
  inputType?: 'text' | 'file' | 'list'; // Type of input
  text?: string; // For single text input
  textBuffer?: string; // Buffer for in-progress text entry
  items?: (string | FileLikeObject)[]; // For mixed array of text and file rows
  iterateEachRow?: boolean; // Whether to execute downstream nodes for each row
  iterationStatus?: {
    currentIndex: number;
    totalItems: number;
    completed: boolean;
  };
}

// Add GroupNodeData
export interface GroupNodeData extends BaseNodeData {
  type: 'group';
  label?: string;
  isCollapsed?: boolean; // For UI later
  // Config to link this group to an iterable data source for looping
  iterationConfig?: {
    sourceNodeId: string; // ID of the node providing the array (e.g., an InputNode)
    // sourceHandleId?: string; // Optional: specify which output handle if source has multiple
  };
}

// Add ConditionalNodeData
export type ConditionType = 'contains' | 'greater_than' | 'less_than' | 'equal_to' | 'json_path';
export interface ConditionalNodeData extends BaseNodeData {
  type: 'conditional';
  label?: string;
  conditionType: ConditionType;
  conditionValue: string; // Value to compare against or JSON path
  lastEvaluationResult?: boolean | null; // Store the result of the last evaluation
}

// Add MergerNodeData
export interface MergerNodeData extends BaseNodeData {
  type: 'merger';
  label?: string;
  // Merge mode determines how values are combined
  mergeMode?: 'concat' | 'join' | 'object';
  // Join string for join mode
  joinSeparator?: string;
  // Strategy for handling array items
  arrayStrategy?: 'flatten' | 'preserve';
  // Custom property names for object mode
  propertyNames?: string[];
  // Whether to wait for all inputs or process as they arrive
  waitForAll?: boolean;
  // Array to store manually edited/managed items via sidebar
  items?: string[];
}

// Add WebCrawlerNodeData
export interface WebCrawlerNodeData extends BaseNodeData {
  type: 'web-crawler';
  label?: string;
  url?: string;
  waitForSelector?: string;
  extractSelectors?: Record<string, string>;
  timeout?: number;
  headers?: Record<string, string>;
  includeHtml?: boolean;
  outputFormat?: 'full' | 'text' | 'extracted' | 'html';
}

// Update NodeData union type
export type NodeData = 
  | LLMNodeData 
  | APINodeData 
  | OutputNodeData
  | JSONExtractorNodeData
  | InputNodeData
  | GroupNodeData
  | ConditionalNodeData
  | MergerNodeData
  | WebCrawlerNodeData;

export interface FlowState {
  nodes: Node<NodeData>[];
  edges: Edge[];
  selectedNodeId: string | null;
}

export type FlowNode = Node<NodeData>;
export type FlowEdge = Edge;

export type LLMProvider = 'ollama' | 'openai';