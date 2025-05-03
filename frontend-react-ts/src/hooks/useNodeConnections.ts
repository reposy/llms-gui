import { useCallback, useMemo } from 'react';
import { Edge, Node } from '@xyflow/react';
import { useFlowStructureStore } from '../store/useFlowStructureStore';
import { getIncomingConnections } from '../utils/flow/flowUtils';

// 로그를 완전히 비활성화
const DEBUG_LOGS = false;

/**
 * Hook to check if a node has any image input connections
 * This is useful for determining if vision mode can be enabled for LLM nodes
 */
export function useNodeConnections(nodeId: string): NodeConnectionData {
  // Remove shallow from these selector calls
  const nodes = useFlowStructureStore(state => state.nodes);
  const edges = useFlowStructureStore(state => state.edges);

  // Memoize the incoming connections to avoid recalculation
  const incomingConnections = useMemo(() => {
    return getIncomingConnections(nodeId, edges);
  }, [nodeId, edges]);

  // Memoize the incoming nodes to avoid recalculation
  const incomingNodes = useMemo(() => {
    return incomingConnections
      .map(conn => nodes.find(node => node.id === conn.sourceNodeId))
      .filter(Boolean);
  }, [incomingConnections, nodes]);

  /**
   * Check if the node has any image input connections
   * @returns true if the node has at least one input node that could provide an image
   */
  const hasImageInputs = useCallback(() => {
    // DEBUG_LOGS가 true일 때만 로그 출력
    if (DEBUG_LOGS && incomingConnections.length === 0) {
      console.log(`[useNodeConnections] Node ${nodeId} has no incoming connections`);
    }
    
    // Check if any of the incoming nodes are input nodes
    const hasInputNodes = incomingNodes.some(node => node?.type === 'input');
    
    return hasInputNodes;
  }, [nodeId, incomingConnections, incomingNodes]);

  // Memoize the result value to prevent unnecessary re-renders in consuming components
  return useMemo(() => ({
    hasImageInputs,
    incomingConnections,
    incomingNodes
  }), [hasImageInputs, incomingConnections, incomingNodes]);
} 