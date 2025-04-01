import { Node, Edge } from 'reactflow';

export type NodeType = 'llm' | 'api' | 'output' | 'json-extractor' | 'input' | 'group';
export type OutputFormat = 'json' | 'text';
export type APIMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

// LLM 응답 타입 정의
export interface LLMResult {
  content?: string;
  text?: string;
  [key: string]: any;
}

// 노드 실행 상태 관리
export interface NodeExecutionStateData {
  status: 'idle' | 'running' | 'completed' | 'success' | 'error';
  result?: LLMResult | string;
  error?: string;
  timestamp?: number;
}

export interface NodeExecutionState {
  nodeId: string;
  state: NodeExecutionStateData;
}

// 플로우 실행 상태 관리
export interface FlowExecutionState {
  isExecuting: boolean;
  currentNodeId?: string;
  executionOrder: string[];
  nodeStates: Record<string, NodeExecutionState>;
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
  viewMode?: ViewMode;
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
  viewMode?: ViewMode;
}

// Output 노드 데이터
export interface OutputNodeData extends BaseNodeData {
  type: 'output';
  format: 'json' | 'text';
  content?: string;
  label?: string;
  viewMode?: ViewMode;
}

// JSON Extractor node data
export interface JSONExtractorNodeData extends BaseNodeData {
  label?: string;
  path: string;
  viewMode?: ViewMode;
}

// Add InputNodeData
export interface InputNodeData extends BaseNodeData {
  type: 'input';
  label: string;
  inputType?: 'text' | 'file' | 'list'; // Type of input
  text?: string; // For single text input
  items?: string[]; // For list/file input (e.g., lines from a file)
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

// Update NodeData union type
export type NodeData = 
  | LLMNodeData 
  | APINodeData 
  | OutputNodeData
  | JSONExtractorNodeData
  | InputNodeData
  | GroupNodeData; // Add GroupNodeData

export type ViewMode = 'compact' | 'expanded' | 'auto';

export interface FlowState {
  nodes: Node<NodeData>[];
  edges: Edge[];
  nodeExecutionStates: Record<string, NodeExecutionState>;
  selectedNodeId: string | null;
  globalViewMode: ViewMode;
  nodeViewModes: Record<string, ViewMode>;
  lastManualViewMode: 'compact' | 'expanded';
}

export type FlowNode = Node<NodeData>;
export type FlowEdge = Edge;

export type NodeTypes = {
  llm: {
    provider: 'ollama' | 'openai';
    model: string;
    prompt: string;
    temperature?: number;
    ollamaUrl?: string;
  };
  api: {
    url: string;
    method: APIMethod;
    headers?: Record<string, string>;
    body?: string;
  };
  output: {
    format: OutputFormat;
  };
};

export type LLMProvider = 'ollama' | 'openai';