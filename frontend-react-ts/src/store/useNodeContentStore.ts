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
  MergerNodeData,
  BaseNodeData
} from '../types/nodes';
import { Node as ReactFlowNode } from 'reactflow';
import { isEqual } from 'lodash';
import { useFlowStructureStore } from './useFlowStructureStore';
import { recentlyPastedNodes, explicitlyInitializedNodeIds } from '../utils/clipboardUtils';

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
  executionMode?: 'batch' | 'foreach';
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
  setNodeContent: (nodeId: string, updates: Partial<NodeContent>, allowFallback?: boolean) => void;
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
  return !!content && typeof content === 'object' && 'items' in content;
};

/**
 * Sanitizes input node content if applicable
 */
const sanitizeNodeContent = (content: NodeContent): NodeContent => {
  if (!content) return {};
  
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
  if (!nodeType) {
    console.warn('[NodeContentStore] Creating default content with undefined type');
    return { isDirty: false, label: 'Unknown Node' };
  }

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
        iterateEachRow: false,
        executionMode: 'batch'
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

/**
 * Resolves the node type from various sources without fallbacks
 */
const resolveNodeType = (nodeId: string, updates?: Partial<NodeContent>): string | undefined => {
  // First try to get the type from existing nodes in the store
  const nodes = useFlowStructureStore.getState().nodes;
  const node = nodes.find(n => n.id === nodeId);
  const nodeType = (node?.data as BaseNodeData)?.type?.toLowerCase();
  
  // If not found in store nodes, try to get from updates if provided
  const updatesType = (updates as BaseNodeData)?.type?.toLowerCase();
  
  // Check if the node exists but doesn't have a type
  const hasNodeButNoType = !!node && !nodeType;
  
  // Log resolution attempt with detailed diagnostics
  console.log(`[NodeContentStore] Resolving type for ${nodeId}:`, {
    fromNode: nodeType,
    fromUpdates: updatesType,
    foundNode: !!node,
    hasNodeButNoType,
    nodeData: node?.data ? { ...node.data } : undefined,
    updatesKeys: updates ? Object.keys(updates) : []
  });
  
  // Return the first valid type found (no fallbacks)
  return nodeType || updatesType;
};

/**
 * Safely initializes node content with proper type validation
 */
const safelyInitializeContent = (
  nodeId: string, 
  updates?: Partial<NodeContent>, 
  allowFallback = false
): NodeContent | undefined => {
  // Check if this node was recently pasted - if so, we should skip initialization
  // as the clipboardUtils will handle content creation for pasted nodes
  if (recentlyPastedNodes.has(nodeId)) {
    console.log(`[NodeContentStore] Skipping initialization for recently pasted node ${nodeId}`);
    return updates as NodeContent; // Return the updates directly if provided
  }
  
  // Check if this node was explicitly initialized elsewhere
  if (explicitlyInitializedNodeIds.has(nodeId)) {
    console.log(`[NodeContentStore] Skipping initialization for explicitly initialized node ${nodeId}`);
    return updates as NodeContent; // Return the updates directly if provided
  }

  const nodeType = resolveNodeType(nodeId, updates);
  
  // If no valid type was found and fallbacks aren't allowed, return undefined
  if (!nodeType && !allowFallback) {
    console.warn(`[NodeContentStore] Cannot initialize content for ${nodeId}: No valid type found`);
    return undefined;
  }
  
  // Only use fallback if explicitly allowed
  const finalType = nodeType || (allowFallback ? 'input' : undefined);
  
  if (!finalType) {
    return undefined;
  }
  
  // Create default content with the resolved type
  const defaultContent = createDefaultContent(finalType);
  
  // Mark content if it was created with a fallback type (for debugging)
  if (!nodeType && allowFallback) {
    console.warn(`[NodeContentStore] Using fallback type '${finalType}' for ${nodeId}`);
    
    // Log instead of storing in the object to avoid type issues
    console.log(`[NodeContentStore] Content initialization metadata:`, {
      nodeId,
      usedFallbackType: true,
      initializationTimestamp: Date.now()
    });
  } else {
    console.log(`[NodeContentStore] Content initialization metadata:`, {
      nodeId,
      initializationTimestamp: Date.now()
    });
  }
  
  // Mark node as explicitly initialized
  explicitlyInitializedNodeIds.add(nodeId);
  
  // Merge with updates if provided
  return updates ? { ...defaultContent, ...updates } : defaultContent;
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
      setNodeContent: (nodeId, updates, allowFallback = false) => {
        set(state => {
          // Get current node content
          const currentContent = state.nodeContents[nodeId];
          
          if (!currentContent) {
            // Initialize only if we can determine a valid type
            const initialContent = safelyInitializeContent(nodeId, updates, allowFallback);
            
            // If we couldn't resolve a valid node type, exit early to prevent infinite loops
            if (!initialContent) {
              console.warn(`[NodeContentStore] Skipping content initialization for ${nodeId}: No valid type available`);
              return;
            }
            
            console.log(`[NodeContentStore] Initializing new content for ${nodeId} with type: ${(initialContent as any).type || 'unknown'}`);
            state.nodeContents[nodeId] = initialContent;
          }

          // Only proceed with updates if content exists (either pre-existing or newly initialized)
          if (state.nodeContents[nodeId]) {
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
          }
        });
      },
      
      // Reset a node's content to default values
      resetNodeContent: (nodeId) => {
        set((state) => {
          // Get the current node content
          const currentContent = state.nodeContents[nodeId];
          
          // If no content exists, try to initialize with proper type
          if (!currentContent) {
            const initialContent = safelyInitializeContent(nodeId, undefined, false);
            if (!initialContent) {
              console.warn(`[NodeContentStore] Cannot reset content for ${nodeId}: No valid type available`);
              return state;
            }
            state.nodeContents[nodeId] = initialContent;
            return state;
          }
          
          // If content exists, try to get type from existing content
          const nodeType = resolveNodeType(nodeId);
          if (!nodeType) {
            console.warn(`[NodeContentStore] Cannot reset content for ${nodeId}: Unable to determine type`);
            return state;
          }
          
          // Reset with the resolved type
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
        // Track how many nodes are actually loaded vs skipped
        let loadedCount = 0;
        let skippedCount = 0;
        let recentlyPastedSkipped = 0;
        let explicitlyInitializedSkipped = 0;
        let existingContentSkipped = 0;
        
        set(state => {
          nodes.forEach(node => {
            if (!node) return;
            
            // Extract node ID and data based on type
            const nodeId = 'id' in node ? node.id : undefined;
            if (!nodeId) {
              console.warn('[NodeContentStore] Node without ID encountered:', node);
              return;
            }
            
            // Skip if this node was recently pasted (content already initialized by clipboard utils)
            if (recentlyPastedNodes.has(nodeId)) {
              console.log(`[NodeContentStore] Skipping recently pasted node ${nodeId} in loadFromNodes`);
              recentlyPastedSkipped++;
              skippedCount++;
              return;
            }
            
            // Skip if this node was explicitly initialized elsewhere
            if (explicitlyInitializedNodeIds.has(nodeId)) {
              console.log(`[NodeContentStore] Skipping explicitly initialized node ${nodeId} in loadFromNodes`);
              explicitlyInitializedSkipped++;
              skippedCount++;
              return;
            }
            
            // Skip if content already exists for this node
            if (state.nodeContents[nodeId]) {
              console.log(`[NodeContentStore] Node ${nodeId} already has content, skipping initialization`);
              existingContentSkipped++;
              skippedCount++;
              return;
            }
            
            const nodeData = 'data' in node ? node.data : node;
            const nodeType = nodeData.type?.toLowerCase();
            
            // Skip nodes without a valid type
            if (!nodeType) {
              console.warn(`[NodeContentStore] Skipping node ${nodeId} with no type:`, nodeData);
              skippedCount++;
              return;
            }
            
            let content: NodeContent = {};

            // Prepare content based on node type
            switch (nodeType) {
              case 'input':
                const inputData = nodeData as InputNodeData;
                // Log input data before sanitization (only if not a bulk operation)
                if (nodes.length < 5) {
                  console.log(`[NodeContentStore] Loading input node ${nodeId}:`, {
                    rawItems: inputData.items?.map(item => ({
                      value: item,
                      type: typeof item
                    }))
                  });
                }
                
                content = {
                  ...content,
                  items: sanitizeInputItems(inputData.items || []), // Sanitize during load
                  textBuffer: inputData.textBuffer || '',
                  iterateEachRow: !!inputData.iterateEachRow,
                  label: inputData.label
                };
                
                // Log sanitized content (only if not a bulk operation)
                if (nodes.length < 5) {
                  console.log(`[NodeContentStore] Sanitized input node ${nodeId}:`, {
                    sanitizedItems: content.items?.map(item => ({
                      value: item,
                      type: typeof item
                    }))
                  });
                }
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
            
            // Mark as explicitly initialized to avoid duplicate initialization
            explicitlyInitializedNodeIds.add(nodeId);
            
            loadedCount++;
          });
        });
        
        // Log detailed summary statistics
        console.log(`[NodeContentStore] loadFromNodes summary: ${loadedCount} loaded, ${skippedCount} skipped (${recentlyPastedSkipped} recently pasted, ${explicitlyInitializedSkipped} explicitly initialized, ${existingContentSkipped} existing content), ${nodes.length} total`);
      },
      
      // Load content from imported flow
      loadFromImportedContents: (contents) => {
        console.log('[NodeContentStore] Loading imported contents:', contents);
        
        set(state => {
          // Sanitize all content during import
          Object.entries(contents).forEach(([nodeId, content]) => {
            // Skip entries with no valid content
            if (!content || typeof content !== 'object') {
              console.warn(`[NodeContentStore] Skipping invalid content for ${nodeId}:`, content);
              return;
            }
            
            // Validate node type consistency if possible
            const existingType = resolveNodeType(nodeId);
            const contentType = (content as any)?.type?.toLowerCase();
            
            if (existingType && contentType && existingType !== contentType) {
              console.warn(`[NodeContentStore] Type mismatch for ${nodeId}:`, {
                existingType,
                importedType: contentType
              });
            }
            
            // Store the sanitized content
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