import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';
import { shallow } from 'zustand/shallow';
import { sanitizeInputItems } from '../utils/inputUtils';
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
import { useFlowStructureStore } from './useFlowStructureStore';

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
  mode?: 'batch' | 'foreach';
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

/**
 * Type guard to check if content is InputNodeContent
 */
const isInputNodeContent = (content: NodeContent): content is InputNodeContent => {
  return content && typeof content === 'object' && 'items' in content;
};

/**
 * Sanitizes input node content if applicable
 */
const sanitizeNodeContent = (content: NodeContent): NodeContent => {
  if (isInputNodeContent(content)) {
    // Log content state before sanitization
    console.log('[NodeContentStore] Pre-sanitization content:', {
      hasItems: 'items' in content,
      itemCount: content.items?.length,
      items: content.items?.map(item => ({
        value: item,
        type: typeof item
      }))
    });

    const sanitizedItems = sanitizeInputItems(content.items || []);
    
    // Log sanitization results
    if (!isEqual(sanitizedItems, content.items)) {
      console.log('[NodeContentStore] Items changed after sanitization:', {
        before: content.items?.map(item => ({
          value: item,
          type: typeof item
        })),
        after: sanitizedItems.map(item => ({
          value: item,
          type: typeof item
        }))
      });
      return { ...content, items: sanitizedItems };
    }
  }
  return content;
};

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
        content: '',
        mode: 'batch'
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
  persist(
    immer((set, get) => ({
      // Initial state - empty record
      nodeContents: {},
      
      // Get content for a node, with default values if not found
      getNodeContent: (nodeId) => {
        const state = get();
        const existingContent = state.nodeContents[nodeId];
        
        if (!existingContent) {
          console.log(`[NodeContentStore] No content found for ${nodeId}`);
          return {};
        }

        // Always sanitize content before returning
        return sanitizeNodeContent(existingContent);
      },
      
      // Set or update content for a node
      setNodeContent: (nodeId, updates) => {
        set(state => {
          // Get current node content
          const currentContent = state.nodeContents[nodeId];
          
          if (!currentContent) {
            // Initialize with proper node type if content doesn't exist
            const nodes = useFlowStructureStore.getState().nodes;
            const node = nodes.find(n => n.id === nodeId);
            const nodeType = node?.type?.toLowerCase() || undefined;
            
            console.log(`[NodeContentStore] Initializing new content for ${nodeId}:`, {
              nodeType,
              foundNode: !!node
            });
            
            state.nodeContents[nodeId] = createDefaultContent(nodeType);
          }

          // Create new content by merging current and updates
          const newContent = {
            ...state.nodeContents[nodeId],
            ...updates
          };

          // Always sanitize the entire content if it's an input node
          const sanitizedContent = sanitizeNodeContent(newContent);
          
          // Log if content was modified by sanitization
          if (!isEqual(sanitizedContent, newContent)) {
            console.log(`[NodeContentStore] Content sanitized for ${nodeId}:`, {
              before: newContent,
              after: sanitizedContent
            });
          }

          state.nodeContents[nodeId] = sanitizedContent;
          
          // Mark as dirty unless explicitly set
          if (updates.isDirty === undefined) {
            state.nodeContents[nodeId].isDirty = true;
          }
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
      
      // Load content from nodes (e.g., during initialization)
      loadFromNodes: (nodes) => {
        set(state => {
          nodes.forEach(node => {
            if (!node) return;
            
            // Extract node ID and data based on type
            const nodeId = 'id' in node ? node.id : undefined;
            if (!nodeId) {
              console.warn('[NodeContentStore] Node without ID encountered:', node);
              return;
            }
            
            const nodeData = 'data' in node ? node.data : node;
            let content: NodeContent = {};

            switch (nodeData.type?.toLowerCase()) {
              case 'input':
                const inputData = nodeData as InputNodeData;
                // Log input data before sanitization
                console.log(`[NodeContentStore] Loading input node ${nodeId}:`, {
                  rawItems: inputData.items?.map(item => ({
                    value: item,
                    type: typeof item
                  }))
                });
                
                content = {
                  ...content,
                  items: sanitizeInputItems(inputData.items || []), // Sanitize during load
                  textBuffer: inputData.textBuffer || '',
                  iterateEachRow: !!inputData.iterateEachRow,
                  label: inputData.label
                };
                
                // Log sanitized content
                console.log(`[NodeContentStore] Sanitized input node ${nodeId}:`, {
                  sanitizedItems: content.items?.map(item => ({
                    value: item,
                    type: typeof item
                  }))
                });
                break;
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
                  mode: outputData.mode,
                  label: outputData.label
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
            
            // Store the sanitized content
            state.nodeContents[nodeId] = content;
          });
        });
      },
      
      // Load content from imported flow
      loadFromImportedContents: (contents) => {
        console.log('[NodeContentStore] Loading imported contents:', contents);
        
        set(state => {
          // Sanitize all content during import
          Object.entries(contents).forEach(([nodeId, content]) => {
            state.nodeContents[nodeId] = sanitizeNodeContent(content);
          });
        });
        
        // Log final state after import
        const finalState = get().nodeContents;
        console.log('[NodeContentStore] Final state after import:', finalState);
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
    })),
    {
      name: 'node-content-storage',
      partialize: (state) => ({
        nodeContents: state.nodeContents
      }),
      version: 1
    }
  )
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