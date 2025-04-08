import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { shallow } from 'zustand/shallow';
import { FileLikeObject, InputNodeData } from '../types/nodes';
import { isEqual, cloneDeep } from 'lodash';

// Define the content structure for input nodes
export interface InputNodeContent {
  items?: (string | FileLikeObject)[];
  textBuffer?: string;
  iterateEachRow?: boolean;
  isDirty?: boolean;
  label?: string;
}

// Define the store structure
interface InputNodeContentStore {
  // State
  nodeContents: Record<string, InputNodeContent>;
  
  // Actions
  getNodeContent: (nodeId: string) => InputNodeContent;
  setNodeContent: (nodeId: string, updates: Partial<InputNodeContent>) => void;
  resetNodeContent: (nodeId: string) => void;
  
  // Utility
  markNodeDirty: (nodeId: string, isDirty?: boolean) => void;
  isNodeDirty: (nodeId: string) => boolean;
  
  // Migration / Import / Export
  loadFromReduxNodes: (nodes: InputNodeData[]) => void;
  cleanupDeletedNodes: (existingNodeIds: string[]) => void;
  getAllNodeContents: () => Record<string, InputNodeContent>;
  reset: () => void;
}

// Default empty content
const defaultNodeContent: InputNodeContent = {
  items: [],
  textBuffer: '',
  iterateEachRow: false,
  isDirty: false,
  label: 'Input'
};

// Create the store with immer for easier state updates
export const useInputNodeContentStore = create<InputNodeContentStore>()(
  immer((set, get) => ({
    // Initial state - empty record
    nodeContents: {},
    
    // Get content for a node, with default values if not found
    getNodeContent: (nodeId) => {
      return get().nodeContents[nodeId] || { ...defaultNodeContent };
    },
    
    // Set or update content for a node
    setNodeContent: (nodeId, updates) => {
      set((state) => {
        const currentContent = state.nodeContents[nodeId] || { ...defaultNodeContent };
        console.log(`[InputNodeContentStore] setNodeContent START - Node: ${nodeId}`, { 
          currentContent, 
          updates 
        });
        
        // Ensure the node content exists
        if (!state.nodeContents[nodeId]) {
          state.nodeContents[nodeId] = { ...defaultNodeContent };
        }
        
        // Apply updates
        Object.assign(state.nodeContents[nodeId], updates);
        
        // Mark as dirty unless explicitly set
        if (updates.isDirty === undefined) {
          state.nodeContents[nodeId].isDirty = true;
        }
        
        console.log(`[InputNodeContentStore] setNodeContent END - Node: ${nodeId}`, { 
          result: state.nodeContents[nodeId] 
        });
        
        return state;
      });
    },
    
    // Reset a node's content to default values
    resetNodeContent: (nodeId) => {
      set((state) => {
        state.nodeContents[nodeId] = { ...defaultNodeContent };
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
    
    // Load content from Redux nodes
    loadFromReduxNodes: (nodes) => {
      set((state) => {
        nodes.forEach(node => {
          if (node.type !== 'input') return;
          
          // Skip if node doesn't have an ID
          const nodeId = 'id' in node ? node.id : (node as any).id;
          if (!nodeId) return;
          
          // Extract input node content
          const content: InputNodeContent = {
            items: node.items || [],
            textBuffer: node.textBuffer || '',
            iterateEachRow: !!node.iterateEachRow,
            label: node.label || 'Input',
            isDirty: false
          };
          
          // Store the content
          state.nodeContents[nodeId] = content;
        });
        
        return state;
      });
    },
    
    // Clean up deleted nodes
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
    
    // Get all node contents for export
    getAllNodeContents: () => {
      return get().nodeContents;
    },
    
    // Reset the store
    reset: () => {
      set({ nodeContents: {} });
    }
  }))
);

// Create a hook to use node content for a specific node
export const useInputNodeContent = (nodeId: string) => {
  return useInputNodeContentStore(
    (state) => ({
      content: state.getNodeContent(nodeId),
      isContentDirty: state.isNodeDirty(nodeId),
      setContent: (updates: Partial<InputNodeContent>) => state.setNodeContent(nodeId, updates),
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
  loadFromReduxNodes,
  cleanupDeletedNodes,
  getAllNodeContents,
  reset: resetAllContent
} = useInputNodeContentStore.getState(); 