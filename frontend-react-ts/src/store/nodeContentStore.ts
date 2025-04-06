import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { shallow } from 'zustand/shallow';
import { LLMNodeData, APINodeData, OutputNodeData, NodeData, ConditionalNodeData } from '../types/nodes';

// Type for content that will be stored in this store instead of Redux
export interface NodeContent {
  // LLM node content
  prompt?: string;
  model?: string;
  temperature?: number;
  provider?: 'ollama' | 'openai';
  ollamaUrl?: string;
  
  // API node content
  url?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: string;
  queryParams?: Record<string, string>;
  useInputAsBody?: boolean;
  contentType?: string;
  bodyFormat?: 'key-value' | 'raw';
  bodyParams?: Array<{ key: string; value: string; enabled: boolean }>;
  
  // Output node content
  format?: 'json' | 'text';
  content?: string;
  
  // Conditional node content
  conditionType?: 'contains' | 'greater_than' | 'less_than' | 'equal_to' | 'json_path';
  conditionValue?: string;
  
  // Common fields
  label?: string;
  // Track if content has been modified since last commit
  isDirty?: boolean;
}

interface NodeContentStore {
  // The content store mapped by nodeId
  nodeContents: Record<string, NodeContent>;
  
  // Get content for a specific node
  getNodeContent: (nodeId: string) => NodeContent | undefined;
  
  // Set or update content for a node
  setNodeContent: (nodeId: string, content: Partial<NodeContent>) => void;
  
  // Mark a node's content as dirty or clean
  markNodeDirty: (nodeId: string, isDirty?: boolean) => void;
  
  // Check if a node's content is dirty
  isNodeDirty: (nodeId: string) => boolean;
  
  // Load content from Redux nodes (initial load or after import)
  loadFromReduxNodes: (nodes: NodeData[]) => void;
  
  // Load content directly from imported contents (for flow import)
  loadFromImportedContents: (contents: Record<string, NodeContent>) => void;
  
  // Clear content for nodes that no longer exist
  cleanupDeletedNodes: (existingNodeIds: string[]) => void;
  
  // Get content for all nodes (for export or saving)
  getAllNodeContents: () => Record<string, NodeContent>;
  
  // Reset the store (clear all contents)
  reset: () => void;
}

export const useNodeContentStore = create<NodeContentStore>()(
  immer((set, get) => ({
    nodeContents: {},
    
    getNodeContent: (nodeId) => {
      return get().nodeContents[nodeId];
    },
    
    setNodeContent: (nodeId, contentUpdate) => {
      set((state) => {
        const currentState = state.nodeContents[nodeId];
        console.log(`[nodeContentStore] setNodeContent START - Node: ${nodeId}`, { 
          currentState, 
          update: contentUpdate 
        });
        
        if (!state.nodeContents[nodeId]) {
          state.nodeContents[nodeId] = { isDirty: true };
        }
        
        const beforeAssign = { ...state.nodeContents[nodeId] };
        Object.assign(state.nodeContents[nodeId], contentUpdate);
        state.nodeContents[nodeId].isDirty = true;
        
        console.log(`[nodeContentStore] setNodeContent END - Node: ${nodeId}`, { 
          before: beforeAssign, 
          after: state.nodeContents[nodeId] 
        });
        
        return state;
      });
    },
    
    markNodeDirty: (nodeId, isDirty = true) => {
      set((state) => {
        if (state.nodeContents[nodeId]) {
          state.nodeContents[nodeId].isDirty = isDirty;
        }
        return state;
      });
    },
    
    isNodeDirty: (nodeId) => {
      const content = get().nodeContents[nodeId];
      return content ? !!content.isDirty : false;
    },
    
    loadFromReduxNodes: (nodes) => {
      set((state) => {
        // Process node data and extract content based on node type
        nodes.forEach(node => {
          // In ReactFlow, Node<NodeData> contains node.data of type NodeData 
          // But when passed directly as NodeData, it is the data object itself
          const nodeData = ('data' in node ? node.data : node) as NodeData;
          if (!nodeData) return;
          
          const nodeContent: NodeContent = { isDirty: false };
          
          // Extract content based on node type
          switch (nodeData.type) {
            case 'llm':
              const llmData = nodeData as LLMNodeData;
              nodeContent.prompt = llmData.prompt;
              nodeContent.model = llmData.model;
              nodeContent.temperature = llmData.temperature;
              nodeContent.provider = llmData.provider;
              nodeContent.ollamaUrl = llmData.ollamaUrl;
              nodeContent.label = llmData.label;
              break;
              
            case 'api':
              const apiData = nodeData as APINodeData;
              nodeContent.url = apiData.url;
              nodeContent.method = apiData.method;
              nodeContent.headers = apiData.headers;
              nodeContent.queryParams = apiData.queryParams;
              nodeContent.body = apiData.body;
              nodeContent.useInputAsBody = apiData.useInputAsBody;
              nodeContent.contentType = apiData.contentType;
              nodeContent.bodyFormat = apiData.bodyFormat;
              nodeContent.bodyParams = apiData.bodyParams;
              nodeContent.label = apiData.label;
              break;
              
            case 'output':
              const outputData = nodeData as OutputNodeData;
              nodeContent.format = outputData.format;
              nodeContent.content = outputData.content;
              nodeContent.label = outputData.label;
              break;
              
            case 'conditional':
              const conditionalData = nodeData as ConditionalNodeData;
              nodeContent.conditionType = conditionalData.conditionType;
              nodeContent.conditionValue = conditionalData.conditionValue;
              nodeContent.label = conditionalData.label;
              break;
              
            default:
              // For other node types, extract common fields
              nodeContent.label = nodeData.label;
              break;
          }
          
          // Get the node ID either from node.id (if Node<NodeData>) or nodeData.id
          const nodeId = 'id' in node ? node.id : (nodeData as any).id;
          if (nodeId) {
            state.nodeContents[nodeId] = nodeContent;
          }
        });
        
        return state;
      });
    },
    
    loadFromImportedContents: (contents) => {
      set((state) => {
        console.log('[nodeContentStore] Loading contents from imported flow', contents);
        Object.entries(contents).forEach(([nodeId, content]) => {
          console.log(`[nodeContentStore] Loading content for node ${nodeId}:`, content);
          state.nodeContents[nodeId] = {
            ...content,
            isDirty: false
          };
        });
        return state;
      });
    },
    
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
    
    getAllNodeContents: () => {
      return get().nodeContents;
    },
    
    reset: () => {
      set({ nodeContents: {} });
    }
  }))
);

// Create a hook to use node content for a specific node
export const useNodeContent = (nodeId: string) => {
  return useNodeContentStore(
    (state) => ({
      content: state.getNodeContent(nodeId) || {},
      isContentDirty: state.isNodeDirty(nodeId),
      setContent: (content: Partial<NodeContent>) => state.setNodeContent(nodeId, content),
      markDirty: (isDirty: boolean = true) => state.markNodeDirty(nodeId, isDirty)
    }),
    shallow
  );
};

// Export functions for direct usage
export const {
  getNodeContent,
  setNodeContent,
  markNodeDirty,
  isNodeDirty,
  loadFromReduxNodes,
  loadFromImportedContents,
  cleanupDeletedNodes,
  getAllNodeContents,
  reset: resetNodeContents
} = useNodeContentStore.getState(); 