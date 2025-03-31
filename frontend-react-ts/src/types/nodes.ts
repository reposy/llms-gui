import { Node, Edge } from 'reactflow';

export type NodeType = 'llm' | 'api' | 'output';
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
  type: NodeType;
  label: string;
  isExecuting: boolean;
  error?: string;
  result?: LLMResult | string;
}

// LLM 노드 데이터
export interface LLMNodeData extends BaseNodeData {
  type: 'llm';
  provider: 'ollama' | 'openai';
  model: string;
  prompt: string;
  temperature: number;
  ollamaUrl?: string;
}

// API 노드 데이터
export interface APINodeData extends BaseNodeData {
  type: 'api';
  method: APIMethod;
  url: string;
  headers: Record<string, string>;
  body?: string;
  useInputAsBody: boolean;
}

// Output 노드 데이터
export interface OutputNodeData extends BaseNodeData {
  type: 'output';
  format: OutputFormat;
  content?: string;
}

export type NodeData = LLMNodeData | APINodeData | OutputNodeData;

// 플로우 상태 관리
export interface FlowState {
  nodes: Node<NodeData>[];
  edges: Edge[];
  nodeExecutionStates: Record<string, NodeExecutionState>;
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