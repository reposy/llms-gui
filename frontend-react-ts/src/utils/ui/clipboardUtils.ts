import { Node, Edge } from '@xyflow/react';
import { v4 as uuidv4 } from 'uuid';
import { NodeProperty } from '../../types/nodes';
import { cloneDeep } from 'lodash';

// Interface for copied data
export interface ClipboardData {
  nodes: Node<NodeProperty>[];
  edges: Edge[];
  nodeContents: Record<string, NodeProperty>;
}

// Interface for paste result
export interface PasteResult {
  newNodes: Node<NodeProperty>[];
  newEdges: Edge[];
  nodeContents: Record<string, {content: NodeProperty, nodeId: string, nodeType: string}>;
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
 * (DEPRECATED or REMOVED) Copy selected nodes and their contents to the clipboard
 * @returns The number of nodes copied
 */
// export const copySelectedNodes = (): number => { ... }; // 기존 함수 제거 또는 주석 처리

/**
 * Copy selected nodes and their contents from React Flow instance state
 * @param selectedNodes Array of selected node objects from React Flow
 * @param allEdges Array of all edge objects from React Flow
 * @returns The number of nodes copied
 */
export const copyNodesAndEdgesFromInstance = (selectedNodes: Node<NodeProperty>[], allEdges: Edge[]): number => {
  if (selectedNodes.length === 0) {
    return 0;
  }
  const selectedNodeIds = new Set(selectedNodes.map(node => node.id));
  const relevantEdges = allEdges.filter(edge => 
    selectedNodeIds.has(edge.source) && selectedNodeIds.has(edge.target)
  );
  const nodeContents: Record<string, NodeProperty> = {};
  selectedNodes.forEach(node => {
    if (node.data) {
      nodeContents[node.id] = cloneDeep(node.data); 
    }
  });

  try {
    // Store data in memory (deep copy nodes/edges as well for safety)
    clipboardMemory = {
      nodes: cloneDeep(selectedNodes), // 노드 구조도 깊은 복사
      edges: cloneDeep(relevantEdges), // 엣지 구조도 깊은 복사
      nodeContents // 콘텐츠는 이미 위에서 깊은 복사됨
    };

    // Persist to localStorage if available
    localStorage.setItem(CLIPBOARD_STORAGE_KEY, JSON.stringify(clipboardMemory)); 
  } catch (error) {
    console.error('[Clipboard] Failed to save clipboard data:', error);
  }

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
    const newNode: Node<NodeProperty> = {
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
      newNode.data = { type: copiedNode.type || 'unknown' } as NodeProperty;
    }
    
    // Ensure type consistency between node.type and node.data.type
    if (newNode.type && (!newNode.data.type || newNode.data.type !== newNode.type)) {
      // NodeType 유니언에 속하는 값만 허용
      const allowedTypes = [
        'llm', 'api', 'output', 'json-extractor', 'input', 'group', 'conditional', 'merger', 'web-crawler', 'html-parser'
      ];
      newNode.data.type = allowedTypes.includes(newNode.type) ? (newNode.type as import('../../types/nodes').NodeType) : 'output';
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
    
    // Update parentId reference if this node belongs to a copied group
    if (newNode.parentId) {
      if (oldToNewIdMap[newNode.parentId]) {
        // Parent was also copied, update the reference
        newNode.parentId = oldToNewIdMap[newNode.parentId];
        
        // For nodes within groups, position is already relative
        if (typeof copiedNode.parentId === 'string' && groupNodeIds.has(copiedNode.parentId)) {
        }
      } else {
        // If the parent wasn't copied, remove the parentId reference
        delete newNode.parentId;
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
  const nodeContents: Record<string, {content: NodeProperty, nodeId: string, nodeType: string}> = {};
  for (const [oldNodeId, content] of Object.entries(clipboardData.nodeContents)) {
    const newNodeId = oldToNewIdMap[oldNodeId];
    if (!newNodeId) continue;
    
    // Find the newly created node to get its type
    const newNode = newNodes.find(node => node.id === newNodeId);
    if (!newNode || !newNode.data?.type) {
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
    }, 500); // 500ms should be enough to prevent re-initialization
  }

  const newNodeIds = newNodes.map(node => node.id);
  
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
    // ignore
  }
} 