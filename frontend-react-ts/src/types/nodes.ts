import { Node, Edge } from '@xyflow/react';
import { NodeViewMode } from '../store/viewModeStore';
// import { LLMMode } from '../api/llm'; // Remove deleted import

export type NodeType = 'llm' | 'api' | 'output' | 'json-extractor' | 'input' | 'group' | 'conditional' | 'merger' | 'web-crawler' | 'html-parser';
export type OutputFormat = 'json' | 'text';
export type APIMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
export type LLMMode = 'text' | 'vision'; // Define LLMMode directly here

// Define ExtractionRule interface
export interface ExtractionRule {
  id?: string;
  name: string;
  target: 'text' | 'html' | 'attribute';
  selector: string;
  attribute_name?: string;
  multiple: boolean;
  pathSteps?: { level: number; tag: string; details: string }[]; // Optional: Path steps from DOM selection
}

// Define a FileLikeObject type for file content
export interface FileLikeObject {
  file: string; // File name
  type: string; // MIME type
  content?: string | ArrayBuffer; // Optional file content
}

// LLM 응답 타입 정의
export interface LLMResult {
  text?: string;
  completion?: string;
  response?: string;
  [key: string]: any;
}

// 플로우 실행 상태 관리
export interface FlowExecutionState {
  isExecuting: boolean;
  currentNodeId?: string;
  executionOrder: string[];
  nodeStates: Record<string, any>;
}

// React Flow Node 타입에 부모 관계 타입을 명시적으로 추가
export interface ExtendedNodeProps {
  parentId?: string;  // 부모 노드 ID (React Flow의 parentNode와 일관성을 위해 사용)
  // parentNode 속성은 내부적으로만 사용되므로 타입에서 제거
  // React Flow 전달 시 필요한 경우 parentId를 parentNode로 복사하는 헬퍼 함수 사용
}

// 공통 노드 데이터 타입
export interface BaseNodeData {
  label?: string;
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
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
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
  format?: 'json' | 'text';
  content?: string;
  mode?: 'read' | 'write';
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
  items?: (string | File)[]; // Allow Files in items array
  commonItems?: (string | File)[]; // Added for common items
  chainingItems?: (string | File)[]; // Added for chaining items
  iterateEachRow?: boolean; // Whether to execute downstream nodes for each row
  executionMode?: 'batch' | 'foreach'; // Mode of execution, set by the UI
  // Add chainingUpdateMode to InputNodeData as well
  chainingUpdateMode?: 'common' | 'replaceCommon' | 'element' | 'none'; 
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

// HTML Parser Node 데이터 인터페이스
export interface HTMLParserNodeData extends BaseNodeData {
  type: 'html-parser';
  label?: string;
  extractionRules?: ExtractionRule[];
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
  | WebCrawlerNodeData
  | HTMLParserNodeData;

export interface FlowState {
  nodes: Node<NodeData>[];
  edges: Edge[];
  selectedNodeId: string | null;
}

export type FlowNode = Node<NodeData>;
export type FlowEdge = Edge;

export type LLMProvider = 'ollama' | 'openai';

// Add these types if they don't exist or modify if they do

export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

export type RequestBodyType = 'none' | 'json' | 'form-data' | 'x-www-form-urlencoded' | 'raw';

export interface APIResponse {
  data: any; // Or define a more specific type
  headers: Record<string, string>;
  // Add other relevant response properties if needed (e.g., status, statusText)
}

// ... ensure other node data types like APINodeContent, ConditionalNodeContent etc. exist ...

// If APINodeContent exists, ensure it includes the necessary fields
export interface APINodeContent extends BaseNodeData {
  url: string;
  method: HTTPMethod;
  requestBodyType: RequestBodyType;
  requestBody?: string; // For JSON, raw text
  requestHeaders?: Record<string, string>;
  // Add fields for form-data or x-www-form-urlencoded if needed
  // Response data
  response?: APIResponse | null;
  statusCode?: number | null;
  executionTime?: number | null;
  // Internal state
  // _flash?: number; // Removed for visual feedback separation
}

// Define other specific node content types - CONSOLIDATE HERE
export interface InputNodeContent extends BaseNodeData {
  label?: string; // Inherited, make optional
  items?: (string | File)[]; // Use the same type as InputNodeData
  commonItems?: (string | File)[]; // Use the same type as InputNodeData
  chainingItems?: (string | File)[]; // Use the same type as InputNodeData
  textBuffer?: string;
  iterateEachRow?: boolean;
  executionMode?: 'batch' | 'foreach';
  // Ensure chainingUpdateMode is defined here consistently
  chainingUpdateMode?: 'common' | 'replaceCommon' | 'element' | 'none'; 
}

export interface OutputNodeContent extends BaseNodeData {
  // Output specific fields
}

export interface TextNodeContent extends BaseNodeData {
  text: string;
}

export interface ConditionalNodeContent extends BaseNodeData {
  conditionType: 'contains' | 'equals' | 'startsWith' | 'endsWith' | 'regex'; // Example types
  conditionValue: string;
}

export interface GroupNodeContent extends BaseNodeData {
  isCollapsed: boolean;
}

// Union type for all possible node content types
export type NodeContent = 
  | APINodeContent 
  | InputNodeContent 
  | OutputNodeContent
  | TextNodeContent
  | ConditionalNodeContent
  | GroupNodeContent;

// Overwrite React Flow's Node type to use our specific data structure
// Ensure this aligns with how nodes are created/used in React Flow
export type CustomNode<T extends BaseNodeData = BaseNodeData> = Node<T, NodeType>;

// Type mapping for content based on node type
export type NodeTypeMap = {
  api: APINodeContent;
  input: InputNodeContent;
  output: OutputNodeContent;
  text: TextNodeContent;
  conditional: ConditionalNodeContent;
  group: GroupNodeContent;
};

export interface LLMNodeContent extends NodeContent {
  // ... existing code ...
}