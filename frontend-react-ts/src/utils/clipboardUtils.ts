import { Node, Edge } from '@xyflow/react';
import { v4 as uuidv4 } from 'uuid';
import { NodeData } from '../types/nodes';
import { getNodeContent, NodeContent } from '../store/useNodeContentStore';
import { useFlowStructureStore } from '../store/useFlowStructureStore';

// Interface for copied data
export interface ClipboardData {
  nodes: Node<NodeData>[];
  edges: Edge[];
  nodeContents: Record<string, NodeContent>;
}

// Interface for paste result
export interface PasteResult {
  newNodes: Node<NodeData>[];
  newEdges: Edge[];
  nodeContents: Record<string, {content: NodeContent, nodeId: string, nodeType: string}>;
  oldToNewIdMap: Record<string, string>;
  newNodeIds: string[];
}

// Module-scoped variable to store clipboard data
let clipboardMemory: ClipboardData | null = null;

// Module-level clipboard tracking set to prevent double-initialization
export const recentlyPastedNodes = new Set<string>();

// Set to track nodes that have been explicitly initialized
export const explicitlyInitializedNodeIds = new Set<string>();

// Key for localStorage persistence
const CLIPBOARD_STORAGE_KEY = 'flow-editor-clipboard';

/**
 * Copy selected nodes and their contents to the clipboard
 * @returns The number of nodes copied
 */
export const copySelectedNodes = (): number => {
  const state = useFlowStructureStore.getState();
  const selectedNodes = state.nodes.filter(node => node.selected);
  
  if (selectedNodes.length === 0) {
    console.log('[Clipboard] No selected nodes to copy');
    return 0;
  }

  // Collect node IDs for filtering edges
  const selectedNodeIds = new Set(selectedNodes.map(node => node.id));
  
  // Only copy edges where both source and target are selected nodes
  const relevantEdges = state.edges.filter(edge => 
    selectedNodeIds.has(edge.source) && selectedNodeIds.has(edge.target)
  );

  // Fetch and store the content for each selected node
  const nodeContents: Record<string, NodeContent> = {};
  selectedNodes.forEach(node => {
    const content = getNodeContent(node.id);
    if (content) {
      nodeContents[node.id] = content;
    }
  });

  // Store data in memory
  clipboardMemory = {
    nodes: selectedNodes,
    edges: relevantEdges,
    nodeContents
  };

  // Persist to localStorage if available
  try {
    localStorage.setItem(CLIPBOARD_STORAGE_KEY, JSON.stringify(clipboardMemory));
  } catch (error) {
    console.warn('[Clipboard] Failed to persist to localStorage:', error);
  }

  console.log(`[Clipboard] Copied ${selectedNodes.length} nodes`);
  return selectedNodes.length;
};

/**
 * Prepare clipboard contents for pasting but don't actually modify state
 * @param position Optional position override for paste operation
 * @returns PasteResult with all necessary data for paste operation, or null if no data to paste
 */
export const pasteClipboardContents = (position?: { x: number, y: number }): PasteResult | null => {
  // Try to get data from memory first, then fallback to localStorage
  let clipboardData = clipboardMemory;
  if (!clipboardData) {
    try {
      const storedData = localStorage.getItem(CLIPBOARD_STORAGE_KEY);
      if (storedData) {
        clipboardData = JSON.parse(storedData) as ClipboardData;
      }
    } catch (error) {
      console.error('[Clipboard] Failed to retrieve from localStorage:', error);
    }
  }

  if (!clipboardData || clipboardData.nodes.length === 0) {
    console.log('[Clipboard] No data to paste');
    return null;
  }

  // Set default position if not provided - offset from the first node's position
  const firstNodePos = clipboardData.nodes[0]?.position || { x: 0, y: 0 };
  const offsetX = position ? position.x - firstNodePos.x : 40;
  const offsetY = position ? position.y - firstNodePos.y : 40;

  // Identify and collect group nodes for special handling
  const groupNodeIds = new Set(
    clipboardData.nodes
      .filter(node => node.type === 'group')
      .map(node => node.id)
  );
  
  // Create mapping from old IDs to new IDs
  const oldToNewIdMap: Record<string, string> = {};
  
  // First pass: create new IDs for all nodes
  clipboardData.nodes.forEach(node => {
    oldToNewIdMap[node.id] = uuidv4();
  });
  
  // Second pass: create new nodes with updated references
  const newNodes = clipboardData.nodes.map(copiedNode => {
    const newId = oldToNewIdMap[copiedNode.id];
    
    // Make a full deep copy of the original node to preserve ALL properties
    const nodeCopy = JSON.parse(JSON.stringify(copiedNode));
    
    // Update the node with new ID and position
    const newNode: Node<NodeData> = {
      ...nodeCopy,
      id: newId,
      position: {
        x: copiedNode.position.x + offsetX,
        y: copiedNode.position.y + offsetY,
      },
      selected: true, // Select the newly pasted nodes
    };
    
    // Ensure data property exists
    if (!newNode.data) {
      newNode.data = { type: copiedNode.type || 'unknown' } as NodeData;
    }
    
    // Ensure type consistency between node.type and node.data.type
    if (newNode.type && (!newNode.data.type || newNode.data.type !== newNode.type)) {
      newNode.data.type = newNode.type;
    }
    
    // Update positionAbsolute if it exists
    if (newNode.positionAbsolute) {
      newNode.positionAbsolute = {
        x: (copiedNode.positionAbsolute?.x || copiedNode.position.x) + offsetX,
        y: (copiedNode.positionAbsolute?.y || copiedNode.position.y) + offsetY,
      };
    } else {
      // Ensure positionAbsolute is set (required by ReactFlow)
      newNode.positionAbsolute = {
        x: copiedNode.position.x + offsetX,
        y: copiedNode.position.y + offsetY,
      };
    }
    
    // Special handling for group nodes
    if (newNode.type === 'group') {
      // Ensure group nodes have required properties
      if (!newNode.style) {
        newNode.style = { width: 800, height: 400 };
      }
      // Ensure dragHandle is set for proper ReactFlow dragging
      if (!newNode.dragHandle) {
        newNode.dragHandle = '.group-drag-handle';
      }
    }
    
    // Update parentNode reference if this node belongs to a copied group
    if (newNode.parentNode) {
      if (oldToNewIdMap[newNode.parentNode]) {
        // Parent was also copied, update the reference
        newNode.parentNode = oldToNewIdMap[newNode.parentNode];
        console.log(`[Clipboard] Updated parentNode reference for ${newId} to ${newNode.parentNode}`);
        
        // For nodes within groups, we need to ensure the position is relative to the group
        if (typeof copiedNode.parentNode === 'string' && groupNodeIds.has(copiedNode.parentNode)) {
          // Position should already be relative, no need to adjust
          console.log(`[Clipboard] Node ${newId} is within copied group ${newNode.parentNode}, preserving relative position`);
        }
      } else {
        // If the parent wasn't copied, remove the parentNode reference
        // to avoid invalid references to nodes that don't exist
        console.log(`[Clipboard] Removing parentNode reference for ${newId} as parent wasn't copied`);
        delete newNode.parentNode;
        
        // Since the parent is gone, ensure the position is now absolute
        // This was already handled above when setting position and positionAbsolute
      }
    }
    
    // Ensure zIndex is preserved or set to a default
    if (typeof newNode.zIndex !== 'number') {
      newNode.zIndex = copiedNode.type === 'group' ? 0 : 1;
    }
    
    return newNode;
  });

  // Create new edges with updated source/target IDs and preserved metadata
  const newEdges = clipboardData.edges.map(copiedEdge => {
    const newSource = oldToNewIdMap[copiedEdge.source];
    const newTarget = oldToNewIdMap[copiedEdge.target];
    
    // Skip if either source or target wasn't copied or doesn't exist
    if (!newSource || !newTarget) {
      console.warn(`[Clipboard] Skipping edge from ${copiedEdge.source} to ${copiedEdge.target} as one of the nodes wasn't copied`);
      return null;
    }
    
    // Make a deep copy of the edge to preserve all properties
    const edgeCopy = JSON.parse(JSON.stringify(copiedEdge));
    
    // Update with new IDs
    return {
      ...edgeCopy,
      id: uuidv4(),
      source: newSource,
      target: newTarget,
      selected: true, // Select the newly pasted edges
    };
  }).filter(Boolean) as Edge[]; // Remove null edges (skipped edges)

  // Prepare node contents with type information
  const nodeContents: Record<string, {content: NodeContent, nodeId: string, nodeType: string}> = {};
  for (const [oldNodeId, content] of Object.entries(clipboardData.nodeContents)) {
    const newNodeId = oldToNewIdMap[oldNodeId];
    if (!newNodeId) continue;
    
    // Find the newly created node to get its type
    const newNode = newNodes.find(node => node.id === newNodeId);
    if (!newNode || !newNode.data?.type) {
      console.warn(`[Clipboard] Skipping content preparation for node ${newNodeId}: No valid type`);
      continue;
    }
    
    // Create a deep copy of the content
    const contentCopy = JSON.parse(JSON.stringify(content));
    
    // Explicitly include node type in content updates to avoid type resolution issues
    const contentWithType = {
      ...contentCopy,
      type: newNode.data.type.toLowerCase(),
      isDirty: false
    };
    
    nodeContents[newNodeId] = {
      content: contentWithType,
      nodeId: newNodeId,
      nodeType: newNode.data.type.toLowerCase()
    };
    
    // Add to tracking sets to prevent re-initialization
    recentlyPastedNodes.add(newNodeId);
    explicitlyInitializedNodeIds.add(newNodeId);
    
    // Set a timeout to remove from tracking set after a short delay
    setTimeout(() => {
      recentlyPastedNodes.delete(newNodeId);
      console.log(`[Clipboard] Removed ${newNodeId} from paste tracking`);
    }, 500); // 500ms should be enough to prevent re-initialization
  }

  const newNodeIds = newNodes.map(node => node.id);
  
  console.log(`[Clipboard] Prepared ${newNodes.length} nodes and ${newEdges.length} edges for pasting`);
  console.log('[Clipboard] ID mapping:', oldToNewIdMap);
  
  return {
    newNodes,
    newEdges,
    nodeContents,
    oldToNewIdMap,
    newNodeIds
  };
};

/**
 * Check if there's any data available to paste
 */
export const hasClipboardData = (): boolean => {
  if (clipboardMemory?.nodes.length) {
    return true;
  }
  
  try {
    const storedData = localStorage.getItem(CLIPBOARD_STORAGE_KEY);
    if (storedData) {
      const data = JSON.parse(storedData) as ClipboardData;
      return data.nodes.length > 0;
    }
  } catch (error) {
    console.error('[Clipboard] Error checking localStorage:', error);
  }
  
  return false;
};

/**
 * Clear clipboard data
 */
export const clearClipboard = (): void => {
  clipboardMemory = null;
  try {
    localStorage.removeItem(CLIPBOARD_STORAGE_KEY);
  } catch (error) {
    console.warn('[Clipboard] Failed to clear localStorage:', error);
  }
  console.log('[Clipboard] Clipboard cleared');
}; 