import { useCallback, useRef } from 'react';
import { Node, Edge, useReactFlow, getConnectedEdges } from 'reactflow';
import { NodeData } from '../types/nodes';
import { cloneDeep } from 'lodash';

// Type for clipboard
interface CopiedData {
  nodes: Node<NodeData>[];
  edges: Edge[];
}

interface UseClipboardReturn {
  clipboard: React.MutableRefObject<CopiedData | null>;
  handleCopy: () => void;
  handlePaste: () => void;
  cloneNodeWithNewId: (node: Node<NodeData>) => Node<NodeData>;
}

export const useClipboard = (
  pushToHistory: (nodes: Node<NodeData>[], edges: Edge[]) => void
): UseClipboardReturn => {
  const clipboard = useRef<CopiedData | null>(null);
  const { getNodes, getEdges, setNodes, setEdges } = useReactFlow();

  // Helper function to clone a node with a new unique id and offset position
  const cloneNodeWithNewId = useCallback((node: Node<NodeData>): Node<NodeData> => ({
    ...node,
    id: crypto.randomUUID(), // Use built-in crypto API
    position: { x: node.position.x + 50, y: node.position.y + 50 }, // Offset position
    data: cloneDeep(node.data), // Use deep copy instead of shallow copy
    selected: true, // Select the newly created node for immediate editing
  }), []);

  const handleCopy = useCallback(() => {
    const selectedNodes = getNodes().filter(node => node.selected);
    if (selectedNodes.length === 0) return;

    const selectedNodeIds = new Set(selectedNodes.map(node => node.id));
    // Only copy edges that connect selected nodes
    const relevantEdges = getConnectedEdges(selectedNodes, getEdges()).filter(
      edge => selectedNodeIds.has(edge.source) && selectedNodeIds.has(edge.target)
    );

    clipboard.current = {
      nodes: cloneDeep(selectedNodes),
      edges: cloneDeep(relevantEdges)
    };
    console.log('Copied to clipboard:', clipboard.current);
  }, [getNodes, getEdges]);

  const handlePaste = useCallback(() => {
    if (!clipboard.current) return;
    
    // Get current flow state
    const currentNodes = getNodes();
    const currentEdges = getEdges();
    
    // Clone nodes with new IDs
    const newNodes = clipboard.current.nodes.map(cloneNodeWithNewId);
    
    // Create a map of old node IDs to new node IDs
    const idMap = clipboard.current.nodes.reduce((map, originalNode, index) => {
      map[originalNode.id] = newNodes[index].id;
      return map;
    }, {} as Record<string, string>);
    
    // Clone edges and update source/target to use new node IDs
    const newEdges = clipboard.current.edges.map(edge => ({
      ...edge,
      id: crypto.randomUUID(),
      source: idMap[edge.source],
      target: idMap[edge.target]
    }));
    
    // Update flow state
    const updatedNodes = [...currentNodes, ...newNodes];
    const updatedEdges = [...currentEdges, ...newEdges];
    
    setNodes(updatedNodes);
    setEdges(updatedEdges);
    
    // Add to history
    pushToHistory(updatedNodes, updatedEdges);
    
    console.log('Pasted from clipboard:', { newNodes, newEdges });
  }, [getNodes, getEdges, setNodes, setEdges, cloneNodeWithNewId, pushToHistory]);

  return { clipboard, handleCopy, handlePaste, cloneNodeWithNewId };
}; 