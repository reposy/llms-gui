import { useCallback } from 'react';
import { Edge, Node } from 'reactflow';
import { useFlowStructureStore } from '../store/useFlowStructureStore';
import { getIncomingConnections } from '../utils/flowUtils';

/**
 * Hook to check if a node has any image input connections
 * This is useful for determining if vision mode can be enabled for LLM nodes
 */
export const useNodeConnections = (nodeId: string) => {
  const nodes = useFlowStructureStore(state => state.nodes);
  const edges = useFlowStructureStore(state => state.edges);

  /**
   * Check if the node has any image input connections
   * @returns true if the node has at least one input node that could provide an image
   */
  const hasImageInputs = useCallback(() => {
    // Get all incoming connections
    const incomingConnections = getIncomingConnections(nodeId, edges);
    
    if (incomingConnections.length === 0) {
      console.log(`[useNodeConnections] Node ${nodeId} has no incoming connections`);
      return false;
    }
    
    // Check if any of the incoming nodes are input nodes
    // In the future this could be expanded to check for other node types
    // that might provide images
    const incomingNodes = incomingConnections.map(conn => 
      nodes.find(node => node.id === conn.sourceNodeId)
    ).filter(Boolean);
    
    const hasInputNodes = incomingNodes.some(node => node?.type === 'input');
    
    console.log(`[useNodeConnections] Node ${nodeId} has ${incomingNodes.length} incoming nodes, ${hasInputNodes ? 'including' : 'excluding'} input nodes`);
    
    return hasInputNodes;
  }, [nodeId, nodes, edges]);

  return {
    hasImageInputs
  };
}; 