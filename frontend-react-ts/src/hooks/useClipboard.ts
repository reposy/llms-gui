import { useCallback } from 'react';
import { Node, Edge, useReactFlow, XYPosition, useStoreApi } from 'reactflow';
import { v4 as uuidv4 } from 'uuid';
import { NodeData } from '../types/nodes';
import { getNodeContent, setNodeContent, NodeContent } from '../store/useNodeContentStore';
import { resetNodeStates } from '../store/useNodeStateStore';
import { useFlowStructureStore } from '../store/useFlowStructureStore';

interface CopiedData {
  nodes: Node<NodeData>[];
  edges: Edge[];
  nodeContents: Record<string, NodeContent>; // Add this field to store node contents
}

export interface UseClipboardReturnType {
  handleCopy: () => void;
  handlePaste: (position?: XYPosition) => void;
}

export const useClipboard = (): UseClipboardReturnType => {
  const { getNodes, getEdges, setNodes, setEdges, getNode } = useReactFlow<NodeData>();
  const store = useStoreApi();
  const { setNodes: setZustandNodes, setEdges: setZustandEdges } = useFlowStructureStore();

  const handleCopy = useCallback(() => {
    const selectedNodes = getNodes().filter(node => node.selected);
    if (selectedNodes.length === 0) return;

    // Collect node IDs for filtering edges
    const selectedNodeIds = new Set(selectedNodes.map(node => node.id));
    
    // Only copy edges where both source and target are selected nodes
    const relevantEdges = getEdges().filter(edge => 
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

    const data: CopiedData = {
      nodes: selectedNodes,
      edges: relevantEdges,
      nodeContents
    };

    // Store in clipboard or localStorage
    localStorage.setItem('reactflow-clipboard', JSON.stringify(data));
    console.log('Copied to clipboard:', data);
  }, [getNodes, getEdges]);

  const handlePaste = useCallback((mousePosition?: XYPosition) => {
    const clipboardData = localStorage.getItem('reactflow-clipboard');
    if (!clipboardData) return;

    try {
      const { nodes: copiedNodes, edges: copiedEdges, nodeContents } = JSON.parse(clipboardData) as CopiedData;
      const reactFlowBounds = store.getState().domNode?.getBoundingClientRect();
      
      // Use mouse position if provided, otherwise calculate center position
      const position = mousePosition || {
        x: (reactFlowBounds?.width || 800) / 2,
        y: (reactFlowBounds?.height || 600) / 2,
      };

      // Calculate the offset based on the first node's position
      const firstNodePos = copiedNodes[0]?.position || { x: 0, y: 0 };
      const offsetX = position.x - firstNodePos.x;
      const offsetY = position.y - firstNodePos.y;

      // Create new nodes with new IDs and adjusted positions
      const oldToNewIdMap: Record<string, string> = {};
      
      const newNodes = copiedNodes.map(copiedNode => {
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
          selected: false,
          positionAbsolute: {
            x: copiedNode.position.x + offsetX,
            y: copiedNode.position.y + offsetY,
          },
        };
      });

      // Create new edges with updated source/target IDs
      const newEdges = copiedEdges.map(copiedEdge => {
        const newSource = oldToNewIdMap[copiedEdge.source];
        const newTarget = oldToNewIdMap[copiedEdge.target];
        
        return {
          ...copiedEdge,
          id: uuidv4(),
          source: newSource,
          target: newTarget,
          selected: false,
        };
      });

      // Copy node contents to the new nodes and ensure all existing content properties are preserved
      Object.entries(nodeContents).forEach(([oldNodeId, content]) => {
        const newNodeId = oldToNewIdMap[oldNodeId];
        if (newNodeId) {
          setNodeContent(newNodeId, { ...content, isDirty: false });
        }
      });

      // Add new nodes and edges to the flow
      setNodes(nodes => [...nodes, ...newNodes]);
      setEdges(edges => [...edges, ...newEdges]);
      
      // Update Zustand state to make sure the execution engine has access to the new nodes and edges
      const updatedNodes = [...getNodes(), ...newNodes];
      const updatedEdges = [...getEdges(), ...newEdges];
      setZustandNodes(updatedNodes);
      setZustandEdges(updatedEdges);
      
      // Reset execution state for pasted nodes
      const newNodeIds = newNodes.map(node => node.id);
      console.log('[Clipboard] Resetting execution state for pasted nodes:', newNodeIds);
      resetNodeStates(newNodeIds);
      
      console.log('[Clipboard] Paste operation completed successfully:', { 
        newNodesCount: newNodes.length, 
        newEdgesCount: newEdges.length 
      });
    } catch (error) {
      console.error('Error pasting from clipboard:', error);
    }
  }, [setNodes, setEdges, store, setZustandNodes, setZustandEdges, getNodes, getEdges]);

  return {
    handleCopy,
    handlePaste,
  };
}; 