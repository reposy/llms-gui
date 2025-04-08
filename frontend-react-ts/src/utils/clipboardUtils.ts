import { Node, Edge } from 'reactflow';
import { v4 as uuidv4 } from 'uuid';
import { NodeData } from '../types/nodes';
import { 
  getNodeContent, 
  setNodeContent, 
  NodeContent 
} from '../store/useNodeContentStore';
import { useFlowStructureStore } from '../store/useFlowStructureStore';
import { pushSnapshot } from '../store/useHistoryStore';
import { resetNodeStates } from '../store/useNodeStateStore';

// Interface for copied data
export interface ClipboardData {
  nodes: Node<NodeData>[];
  edges: Edge[];
  nodeContents: Record<string, NodeContent>;
}

// Module-scoped variable to store clipboard data
let clipboardMemory: ClipboardData | null = null;

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
 * Paste clipboard contents into the flow
 * @param position Optional position override for paste operation
 * @returns The number of nodes pasted or null if no data to paste
 */
export const pasteClipboardContents = (position?: { x: number, y: number }): number | null => {
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

  const state = useFlowStructureStore.getState();
  
  // Set default position if not provided - offset from the first node's position
  const firstNodePos = clipboardData.nodes[0]?.position || { x: 0, y: 0 };
  const offsetX = position ? position.x - firstNodePos.x : 40;
  const offsetY = position ? position.y - firstNodePos.y : 40;

  // Create new nodes with new IDs and adjusted positions
  const oldToNewIdMap: Record<string, string> = {};
  
  const newNodes = clipboardData.nodes.map(copiedNode => {
    const id = uuidv4();
    oldToNewIdMap[copiedNode.id] = id;
    
    // Create a deep copy of the node data to avoid reference issues
    const newNodeData = JSON.parse(JSON.stringify(copiedNode.data));
    
    return {
      ...copiedNode,
      id,
      data: newNodeData,
      position: {
        x: copiedNode.position.x + offsetX,
        y: copiedNode.position.y + offsetY,
      },
      selected: true, // Select the newly pasted nodes
      positionAbsolute: {
        x: copiedNode.position.x + offsetX,
        y: copiedNode.position.y + offsetY,
      },
    };
  });

  // Create new edges with updated source/target IDs
  const newEdges = clipboardData.edges.map(copiedEdge => {
    const newSource = oldToNewIdMap[copiedEdge.source];
    const newTarget = oldToNewIdMap[copiedEdge.target];
    
    return {
      ...copiedEdge,
      id: uuidv4(),
      source: newSource,
      target: newTarget,
      selected: true, // Select the newly pasted edges
    };
  });

  // IMPORTANT: Initialize node content BEFORE updating the flow store
  // This ensures the nodes have their content properly set before ReactFlow renders them
  for (const [oldNodeId, content] of Object.entries(clipboardData.nodeContents)) {
    const newNodeId = oldToNewIdMap[oldNodeId];
    if (!newNodeId) continue;
    
    // Find the newly created node to get its type
    const newNode = newNodes.find(node => node.id === newNodeId);
    if (!newNode || !newNode.data?.type) {
      console.warn(`[Clipboard] Skipping content initialization for node ${newNodeId}: No valid type`);
      continue;
    }
    
    // Explicitly include node type in content updates to avoid type resolution issues
    const contentWithType = {
      ...content,
      type: newNode.data.type.toLowerCase(),
      isDirty: false
    };
    
    console.log(`[Clipboard] Initializing content for node ${newNodeId} with type: ${newNode.data.type}`);
    setNodeContent(newNodeId, contentWithType);
  }

  // Add new nodes and edges to the flow
  const updatedNodes = [...state.nodes, ...newNodes];
  const updatedEdges = [...state.edges, ...newEdges];
  
  // Update the store
  state.setNodes(updatedNodes);
  state.setEdges(updatedEdges);
  
  // Set the first pasted node as selected (improves UX and ensures it's visible)
  if (newNodes.length > 0) {
    const firstNewNodeId = newNodes[0].id;
    state.setSelectedNodeId(firstNewNodeId);
    console.log(`[Clipboard] Set selected node to first pasted node: ${firstNewNodeId}`);
  }
  
  // Reset execution state for pasted nodes
  const newNodeIds = newNodes.map(node => node.id);
  resetNodeStates(newNodeIds);
  
  // Push snapshot to history
  pushSnapshot({
    nodes: updatedNodes,
    edges: updatedEdges,
    selectedNodeId: newNodes.length > 0 ? newNodes[0].id : null
  });
  
  console.log(`[Clipboard] Pasted ${newNodes.length} nodes and ${newEdges.length} edges`);
  return newNodes.length;
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