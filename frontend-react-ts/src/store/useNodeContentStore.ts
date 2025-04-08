import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { shallow } from 'zustand/shallow';
import { 
  NodeData, 
  FileLikeObject, 
  LLMNodeData, 
  APINodeData, 
  OutputNodeData, 
  InputNodeData,
  JSONExtractorNodeData,
  GroupNodeData,
  ConditionalNodeData,
  MergerNodeData
} from '../types/nodes';
import { Node as ReactFlowNode } from 'reactflow';
import { isEqual } from 'lodash';

// Base content type for all nodes
export interface BaseNodeContent {
  label?: string;
  isDirty?: boolean;
}

// LLM node content
export interface LLMNodeContent extends BaseNodeContent {
  prompt?: string;
  model?: string;
  temperature?: number;
  provider?: 'ollama' | 'openai';
  ollamaUrl?: string;
}

// API node content
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

// Output node content
export interface OutputNodeContent extends BaseNodeContent {
  format?: 'json' | 'text';
  content?: string;
}

// JSON Extractor node content
export interface JSONExtractorNodeContent extends BaseNodeContent {
  path?: string;
}

// Input node content
export interface InputNodeContent extends BaseNodeContent {
  items?: (string | FileLikeObject)[];
  textBuffer?: string;
  iterateEachRow?: boolean;
}

// Group node content
export interface GroupNodeContent extends BaseNodeContent {
  isCollapsed?: boolean;
}

// Conditional node content
export interface ConditionalNodeContent extends BaseNodeContent {
  conditionType?: 'contains' | 'greater_than' | 'less_than' | 'equal_to' | 'json_path';
  conditionValue?: string;
}

// Merger node content
export interface MergerNodeContent extends BaseNodeContent {
  items?: string[];
}

// Union type for all node content types
export type NodeContent = 
  | LLMNodeContent
  | APINodeContent
  | OutputNodeContent
  | InputNodeContent
  | JSONExtractorNodeContent
  | GroupNodeContent
  | ConditionalNodeContent
  | MergerNodeContent;

// Store type definition
interface NodeContentStore {
  // State
  nodeContents: Record<string, NodeContent>;
  
  // Actions
  getNodeContent: (nodeId: string) => NodeContent;
  setNodeContent: (nodeId: string, updates: Partial<NodeContent>) => void;
  resetNodeContent: (nodeId: string) => void;
  
  // Utility
  markNodeDirty: (nodeId: string, isDirty?: boolean) => void;
  isNodeDirty: (nodeId: string) => boolean;
  
  // Migration / Import / Export
  loadFromNodes: (nodes: (NodeData | ReactFlowNode<NodeData>)[]) => void;
  loadFromImportedContents: (contents: Record<string, NodeContent>) => void;
  cleanupDeletedNodes: (existingNodeIds: string[]) => void;
  getAllNodeContents: () => Record<string, NodeContent>;
  reset: () => void;
}

// Create default content for various node types
const createDefaultContent = (nodeType?: string): NodeContent => {
  const baseContent: BaseNodeContent = {
    isDirty: false,
    label: nodeType ? `${nodeType.charAt(0).toUpperCase() + nodeType.slice(1)} Node` : 'Node'
  };

  switch (nodeType) {
    case 'llm':
      return {
        ...baseContent,
        prompt: '',
        model: 'llama3',
        temperature: 0.7,
        provider: 'ollama'
      };
    
    case 'api':
      return {
        ...baseContent,
        url: '',
        method: 'GET',
        headers: {},
        queryParams: {}
      };
    
    case 'output':
      return {
        ...baseContent,
        format: 'text',
        content: ''
      };
    
    case 'input':
      return {
        ...baseContent,
        items: [],
        textBuffer: '',
        iterateEachRow: false
      };
    
    case 'json-extractor':
      return {
        ...baseContent,
        path: ''
      };
    
    case 'conditional':
      return {
        ...baseContent,
        conditionType: 'contains',
        conditionValue: ''
      };
    
    case 'group':
      return {
        ...baseContent,
        isCollapsed: false
      };
    
    case 'merger':
      return {
        ...baseContent,
        items: []
      };
    
    default:
      return baseContent;
  }
};

// Create the Zustand store
export const useNodeContentStore = create<NodeContentStore>()(
  immer((set, get) => ({
    // Initial state - empty record
    nodeContents: {},
    
    // Get content for a node, with default values if not found
    getNodeContent: (nodeId) => {
      return get().nodeContents[nodeId] || createDefaultContent();
    },
    
    // Set or update content for a node
    setNodeContent: (nodeId, updates) => {
      set((state) => {
        // Get current node content or initialize with default
        const currentContent = state.nodeContents[nodeId] || createDefaultContent();
        
        console.log(`[NodeContentStore] setNodeContent START - Node: ${nodeId}`, { 
          currentContent, 
          updates 
        });
        
        // Ensure the node content exists
        if (!state.nodeContents[nodeId]) {
          state.nodeContents[nodeId] = currentContent;
        }
        
        // Apply updates
        Object.assign(state.nodeContents[nodeId], updates);
        
        // Mark as dirty unless explicitly set
        if (updates.isDirty === undefined) {
          state.nodeContents[nodeId].isDirty = true;
        }
        
        console.log(`[NodeContentStore] setNodeContent END - Node: ${nodeId}`, { 
          result: state.nodeContents[nodeId] 
        });
        
        // Trigger history snapshot on significant content changes
        // This will be executed after the state update is applied
        setTimeout(() => {
          try {
            const { pushCurrentSnapshot } = require('../utils/historyUtils');
            pushCurrentSnapshot();
          } catch (error) {
            console.warn('[NodeContentStore] Failed to push snapshot:', error);
          }
        }, 0);
        
        return state;
      });
    },
    
    // Reset a node's content to default values
    resetNodeContent: (nodeId) => {
      set((state) => {
        // Get the node type from existing content if available
        const nodeContent = state.nodeContents[nodeId];
        const nodeType = nodeContent ? (nodeContent as any).type : undefined;
        state.nodeContents[nodeId] = createDefaultContent(nodeType);
        return state;
      });
    },
    
    // Mark a node as dirty or clean
    markNodeDirty: (nodeId, isDirty = true) => {
      set((state) => {
        if (state.nodeContents[nodeId]) {
          state.nodeContents[nodeId].isDirty = isDirty;
        }
        return state;
      });
    },
    
    // Check if a node is dirty
    isNodeDirty: (nodeId) => {
      const content = get().nodeContents[nodeId];
      return content ? !!content.isDirty : false;
    },
    
    // Load content from nodes
    loadFromNodes: (nodes) => {
      set((state) => {
        nodes.forEach(node => {
          if (!node) return;
          
          // Extract node ID, type, and data, handling both ReactFlowNode and NodeData
          const nodeId = 'id' in node ? node.id : (node as any).id;
          if (!nodeId) return;
          
          // Extract type and data based on whether it's a ReactFlow Node or NodeData
          const nodeType = node.type;
          const nodeData = 'data' in node ? node.data : node;
          
          // Create content based on node type
          let content: NodeContent = createDefaultContent(nodeType);
          
          // Extract specific data based on node type
          switch (nodeType) {
            case 'llm':
              const llmData = nodeData as LLMNodeData;
              content = {
                ...content,
                prompt: llmData.prompt,
                model: llmData.model,
                temperature: llmData.temperature,
                provider: llmData.provider,
                ollamaUrl: llmData.ollamaUrl,
                label: llmData.label
              };
              break;
              
            case 'api':
              const apiData = nodeData as APINodeData;
              content = {
                ...content,
                url: apiData.url,
                method: apiData.method,
                headers: apiData.headers,
                queryParams: apiData.queryParams,
                body: apiData.body,
                useInputAsBody: apiData.useInputAsBody,
                contentType: apiData.contentType,
                bodyFormat: apiData.bodyFormat,
                bodyParams: apiData.bodyParams,
                label: apiData.label
              };
              break;
              
            case 'output':
              const outputData = nodeData as OutputNodeData;
              content = {
                ...content,
                format: outputData.format,
                content: outputData.content,
                label: outputData.label
              };
              break;
              
            case 'input':
              const inputData = nodeData as InputNodeData;
              content = {
                ...content,
                items: inputData.items || [],
                textBuffer: inputData.textBuffer || '',
                iterateEachRow: !!inputData.iterateEachRow,
                label: inputData.label
              };
              break;
              
            case 'json-extractor':
              const extractorData = nodeData as JSONExtractorNodeData;
              content = {
                ...content,
                path: extractorData.path,
                label: extractorData.label
              };
              break;
              
            case 'group':
              const groupData = nodeData as GroupNodeData;
              content = {
                ...content,
                isCollapsed: groupData.isCollapsed,
                label: groupData.label
              };
              break;
              
            case 'conditional':
              const conditionalData = nodeData as ConditionalNodeData;
              content = {
                ...content,
                conditionType: conditionalData.conditionType,
                conditionValue: conditionalData.conditionValue,
                label: conditionalData.label
              };
              break;
              
            case 'merger':
              const mergerData = nodeData as MergerNodeData;
              content = {
                ...content,
                items: mergerData.items,
                label: mergerData.label
              };
              break;
          }
          
          // Set dirty flag to false for imported content
          content.isDirty = false;
          
          // Store the content
          state.nodeContents[nodeId] = content;
        });
        
        return state;
      });
    },
    
    // Load content from imported flow
    loadFromImportedContents: (contents) => {
      set((state) => {
        console.log('[NodeContentStore] Loading contents from imported flow', contents);
        
        Object.entries(contents).forEach(([nodeId, content]) => {
          console.log(`[NodeContentStore] Loading content for node ${nodeId}:`, content);
          
          state.nodeContents[nodeId] = {
            ...content,
            isDirty: false
          };
        });
        
        return state;
      });
    },
    
    // Clean up content for deleted nodes
    cleanupDeletedNodes: (existingNodeIds) => {
      set((state) => {
        const existingNodeIdSet = new Set(existingNodeIds);
        const nodeIdsToRemove = Object.keys(state.nodeContents).filter(
          nodeId => !existingNodeIdSet.has(nodeId)
        );
        
        nodeIdsToRemove.forEach(nodeId => {
          delete state.nodeContents[nodeId];
        });
        
        return state;
      });
    },
    
    // Get all node contents
    getAllNodeContents: () => {
      return get().nodeContents;
    },
    
    // Reset the store
    reset: () => {
      set({ nodeContents: {} });
    }
  }))
);

// Create a hook to use content for a specific node
export const useNodeContent = (nodeId: string) => {
  return useNodeContentStore(
    (state) => ({
      content: state.getNodeContent(nodeId),
      isContentDirty: state.isNodeDirty(nodeId),
      setContent: (updates: Partial<NodeContent>) => state.setNodeContent(nodeId, updates),
      resetContent: () => state.resetNodeContent(nodeId)
    }),
    shallow
  );
};

// Export functions for direct usage
export const {
  getNodeContent,
  setNodeContent,
  resetNodeContent,
  markNodeDirty,
  isNodeDirty,
  loadFromNodes,
  loadFromImportedContents,
  cleanupDeletedNodes,
  getAllNodeContents,
  reset: resetAllContent
} = useNodeContentStore.getState(); 