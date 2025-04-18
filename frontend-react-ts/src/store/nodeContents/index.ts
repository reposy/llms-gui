import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';
import { shallow } from 'zustand/shallow';
import { isEqual } from 'lodash';
import { createIDBStorage } from '../../utils/idbStorage';
import { NodeData } from '../../types/nodes';
import { Node as ReactFlowNode } from '@xyflow/react';

// Import all node content types and utilities
import { 
  NodeContent, 
  isInputNodeContent,
  MAX_PERSISTED_CONTENT_LENGTH
} from './common';

// Import node-specific utilities
import { sanitizeNodeContent } from './inputNodeContent';
import { truncateLlmContentForStorage } from './llmNodeContent';
import { truncateOutputContentForStorage } from './outputNodeContent';
import { 
  createDefaultInputNodeContent, 
  createDefaultLlmNodeContent, 
  createDefaultApiNodeContent, 
  createDefaultOutputNodeContent 
} from './nodeTypeDefaults';

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
 * Creates default content for a node type
 */
export const createDefaultContent = (nodeType?: string): NodeContent => {
  if (!nodeType) {
    console.warn('[NodeContentStore] Creating default content with undefined type');
    return { isDirty: false, label: 'Unknown Node' };
  }

  switch (nodeType.toLowerCase()) {
    case 'input':
      return createDefaultInputNodeContent();
    
    case 'llm':
      return createDefaultLlmNodeContent();
    
    case 'api':
      return createDefaultApiNodeContent();
    
    case 'output':
      return createDefaultOutputNodeContent();
    
    // Add other node types as needed
    
    default:
      return { isDirty: false, label: `${nodeType.charAt(0).toUpperCase() + nodeType.slice(1)} Node` };
  }
};

/**
 * Resolves a node's type based on its ID and content
 */
export const resolveNodeType = (nodeId: string, content?: Partial<NodeContent>): string | undefined => {
  // Try to determine type from existing content
  if (content) {
    // Type checks for each content type
    if ('items' in content && 'iterateEachRow' in content) {
      return 'input';
    }
    
    if ('prompt' in content && 'model' in content) {
      return 'llm';
    }
    
    if ('url' in content && 'method' in content) {
      return 'api';
    }
    
    if ('format' in content) {
      return 'output';
    }
  }
  
  // Try to determine type from node ID patterns
  if (nodeId.startsWith('input')) {
    return 'input';
  } else if (nodeId.startsWith('llm')) {
    return 'llm';
  } else if (nodeId.startsWith('api')) {
    return 'api';
  } else if (nodeId.startsWith('output')) {
    return 'output';
  }
  
  // Couldn't determine type
  return undefined;
};

/**
 * Safely initializes node content with proper type validation
 */
const safelyInitializeContent = (
  nodeId: string, 
  updates?: Partial<NodeContent>, 
  allowFallback = false
): NodeContent | undefined => {
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
  }
  
  // Return default content merged with updates if provided
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
            
            console.log(`[NodeContentStore] Initializing new content for ${nodeId} with type: ${resolveNodeType(nodeId, initialContent) || 'unknown'}`);
            state.nodeContents[nodeId] = initialContent;
          }

          // Only proceed with updates if content exists (either pre-existing or newly initialized)
          if (state.nodeContents[nodeId]) {
            // Force update for content changes by always creating a new reference
            const hasContentUpdate = 'content' in updates;
            
            // Create new content by merging current and updates
            const newContent = {
              ...state.nodeContents[nodeId],
              ...updates,
              // Force a new object reference when 'content' is updated
              // This ensures the shallow equality check in useNodeContent hook doesn't prevent re-renders
              _forceUpdate: hasContentUpdate ? Date.now() : state.nodeContents[nodeId]._forceUpdate
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

            if (hasContentUpdate) {
              console.log(`[NodeContentStore] Forcing update for content change on node ${nodeId}`);
            }

            state.nodeContents[nodeId] = sanitizedContent;
            
            // Mark as dirty unless explicitly set
            if (updates.isDirty === undefined) {
              state.nodeContents[nodeId].isDirty = true;
            }
          }
        });
      },
      
      // Reset a node's content to default
      resetNodeContent: (nodeId) => {
        set(state => {
          const currentContent = state.nodeContents[nodeId];
          
          if (!currentContent) {
            console.log(`[NodeContentStore] No content to reset for ${nodeId}`);
            return;
          }
          
          const nodeType = resolveNodeType(nodeId, currentContent);
          
          if (!nodeType) {
            console.warn(`[NodeContentStore] Cannot reset content for ${nodeId}: Unknown node type`);
            return;
          }
          
          console.log(`[NodeContentStore] Resetting content for ${nodeId} of type ${nodeType}`);
          state.nodeContents[nodeId] = createDefaultContent(nodeType);
        });
      },
      
      // Mark a node as dirty or clean
      markNodeDirty: (nodeId, isDirty = true) => {
        set(state => {
          if (state.nodeContents[nodeId]) {
            state.nodeContents[nodeId].isDirty = isDirty;
          }
        });
      },
      
      // Check if a node is dirty
      isNodeDirty: (nodeId) => {
        const content = get().nodeContents[nodeId];
        return content ? !!content.isDirty : false;
      },
      
      // Load content from various node sources
      loadFromNodes: (nodes) => {
        console.log(`[NodeContentStore] Loading content from ${nodes.length} nodes`);
        
        set(state => {
          nodes.forEach(node => {
            // Extract node data from ReactFlow node if needed
            const nodeData = 'data' in node ? node.data : node;
            if (!nodeData) return;
            
            // Extract node ID and type
            const nodeId = nodeData.id || '';
            const nodeType = nodeData.type?.toLowerCase() || '';
            
            if (!nodeId || !nodeType) {
              console.warn(`[NodeContentStore] Skipping invalid node: ID=${nodeId}, Type=${nodeType}`);
              return;
            }

            // Initialize with default content for this node type
            let content = createDefaultContent(nodeType);
            
            // Transfer properties from node data to content
            // This would typically be handled by node-specific utils but is simplified here
            Object.entries(nodeData).forEach(([key, value]) => {
              if (key !== 'id' && key !== 'type' && key !== 'position') {
                (content as any)[key] = value;
              }
            });
            
            // Sanitize content before storing
            content = sanitizeNodeContent(content);
            
            // Store the content
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
            // Skip entries with no valid content
            if (!content || typeof content !== 'object') {
              console.warn(`[NodeContentStore] Skipping invalid content for ${nodeId}:`, content);
              return;
            }
            
            // Validate node type consistency if possible
            const existingType = resolveNodeType(nodeId);
            const contentType = resolveNodeType(nodeId, content);
            
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
      },
      
      // Clean up content for deleted nodes
      cleanupDeletedNodes: (existingNodeIds) => {
        set((state) => {
          const existingNodeIdSet = new Set(existingNodeIds);
          const nodeIdsToRemove = Object.keys(state.nodeContents).filter(
            nodeId => !existingNodeIdSet.has(nodeId)
          );
          
          console.log(`[NodeContentStore] Cleaning up ${nodeIdsToRemove.length} deleted nodes`);
          
          nodeIdsToRemove.forEach(nodeId => {
            delete state.nodeContents[nodeId];
          });
        });
      },
      
      // Get all node contents
      getAllNodeContents: () => {
        return get().nodeContents;
      },
      
      // Reset the store
      reset: () => {
        console.log('[NodeContentStore] Resetting all content');
        set({ nodeContents: {} });
      }
    })),
    {
      name: 'node-content-storage',
      storage: createIDBStorage(),
      partialize: (state) => {
        // Create a filtered copy of nodeContents with potentially large values truncated
        const filteredContents: Record<string, NodeContent> = {};
        
        Object.entries(state.nodeContents).forEach(([nodeId, content]) => {
          // Create a copy of the content to modify
          let filteredContent = { ...content };
          
          // Apply node-specific truncation based on type
          const nodeType = resolveNodeType(nodeId, content);
          
          if (nodeType === 'llm') {
            filteredContent = truncateLlmContentForStorage(filteredContent as any, MAX_PERSISTED_CONTENT_LENGTH);
          } else if (nodeType === 'output') {
            filteredContent = truncateOutputContentForStorage(filteredContent as any, MAX_PERSISTED_CONTENT_LENGTH);
          }
          
          // Store the filtered content
          filteredContents[nodeId] = filteredContent;
        });
        
        return {
          nodeContents: filteredContents
        };
      }
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

// Re-export node-specific utilities and types for convenience
export * from './common'; 