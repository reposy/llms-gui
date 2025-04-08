import { Edge, Node } from 'reactflow';
import { createWithEqualityFn } from 'zustand/traditional';
import { devtools } from 'zustand/middleware';
import { NodeData } from '../types/nodes';
import { useFlowStructureStore } from './useFlowStructureStore';
import { isNodeRoot as isNodeRootUtil } from '../utils/executionUtils';

// Define the state structure for node graph utilities
export interface NodeGraphUtilsState {
  // Node relationship helpers
  isNodeRoot: (nodeId: string) => boolean;
  getRootNodes: (subsetNodeIds?: Set<string>) => string[];
  getDownstreamNodes: (nodeId: string, includeStartNode?: boolean, subsetNodeIds?: Set<string>) => string[];
  getUpstreamNodes: (nodeId: string, subsetNodeIds?: Set<string>) => string[];
  getNodesInGroup: (groupId: string) => Node<NodeData>[];
}

// Create the Zustand store for node graph utilities
export const useNodeGraphUtils = createWithEqualityFn<NodeGraphUtilsState>()(
  devtools(
    (set, get) => ({
      // --- Graph Structure Helpers --- (Using Zustand state directly)
      isNodeRoot: (nodeId) => {
        const { nodes, edges } = useFlowStructureStore.getState();
        // Use the imported utility function
        return isNodeRootUtil(nodeId, nodes, edges);
      },

      getRootNodes: (subsetNodeIds?: Set<string>) => {
        const { nodes, edges } = useFlowStructureStore.getState();
        const targetNodes = subsetNodeIds 
          ? nodes.filter(n => subsetNodeIds.has(n.id)) 
          : nodes;
        
        // Filter edges to only include those connecting nodes *within* the subset
        const targetEdges = edges.filter(e => 
          (subsetNodeIds ? subsetNodeIds.has(e.source) : true) &&
          (subsetNodeIds ? subsetNodeIds.has(e.target) : true)
        );
        
        return targetNodes
          .filter(node => !targetEdges.some(edge => edge.target === node.id))
          .map(node => node.id);
      },

      getDownstreamNodes: (nodeId, includeStartNode = false, subsetNodeIds?: Set<string>) => {
        const { nodes, edges } = useFlowStructureStore.getState();
        const downstream = new Set<string>();
        const queue: string[] = [nodeId];
        const visited = new Set<string>();

        const relevantNodes = subsetNodeIds
          ? nodes.filter(n => subsetNodeIds.has(n.id))
          : nodes;
        const relevantEdges = subsetNodeIds
          ? edges.filter(e => subsetNodeIds.has(e.source) && subsetNodeIds.has(e.target))
          : edges;
        
        const relevantNodeIds = new Set(relevantNodes.map(n => n.id));

        while (queue.length > 0) {
          const current = queue.shift()!;
          if (visited.has(current) || !relevantNodeIds.has(current)) continue; // Ensure node is relevant
          visited.add(current);

          if (current !== nodeId || includeStartNode) {
            downstream.add(current);
          }

          const children = relevantEdges
            .filter(edge => edge.source === current)
            .map(edge => edge.target);

          children.forEach(childId => {
            if (!visited.has(childId) && relevantNodeIds.has(childId)) {
              queue.push(childId);
            }
          });
        }
        return Array.from(downstream);
      },

      getUpstreamNodes: (nodeId, subsetNodeIds?: Set<string>) => {
        const { nodes, edges } = useFlowStructureStore.getState();
        const upstream = new Set<string>();
        const queue: string[] = [nodeId];
        const visited = new Set<string>();

        const relevantNodes = subsetNodeIds
          ? nodes.filter(n => subsetNodeIds.has(n.id))
          : nodes;
        const relevantEdges = subsetNodeIds
          ? edges.filter(e => subsetNodeIds.has(e.source) && subsetNodeIds.has(e.target))
          : edges;
          
        const relevantNodeIds = new Set(relevantNodes.map(n => n.id));

        while (queue.length > 0) {
          const current = queue.shift()!;
          if (visited.has(current) || !relevantNodeIds.has(current)) continue; // Ensure node is relevant
          visited.add(current);

          if (current !== nodeId) {
            upstream.add(current);
          }

          const parents = relevantEdges
            .filter(edge => edge.target === current)
            .map(edge => edge.source);

          parents.forEach(parentId => {
            if (!visited.has(parentId) && relevantNodeIds.has(parentId)) {
              queue.push(parentId);
            }
          });
        }
        return Array.from(upstream);
      },

      getNodesInGroup: (groupId) => {
        const { nodes } = useFlowStructureStore.getState();
        return nodes.filter(node => node.parentNode === groupId);
      },
    })
  )
);

// Hook to check if a node is a root node
export const useIsRootNode = (nodeId: string): boolean => {
  return useNodeGraphUtils.getState().isNodeRoot(nodeId);
};

// Export the utility functions for use outside components
export const { 
  getRootNodes, 
  getDownstreamNodes, 
  getUpstreamNodes, 
  getNodesInGroup, 
  isNodeRoot 
} = useNodeGraphUtils.getState();