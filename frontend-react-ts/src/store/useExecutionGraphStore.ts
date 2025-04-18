import { createWithEqualityFn } from 'zustand/traditional';
import { shallow } from 'zustand/shallow';
import { Node, Edge } from '@xyflow/react';
import { buildExecutionGraph, GraphNode } from '../utils/flowUtils';

interface ExecutionGraphState {
  // The execution graph
  graph: Map<string, GraphNode>;
  
  // Actions
  buildGraph: (nodes: Node[], edges: Edge[]) => void;
  getNodeLevel: (nodeId: string) => number;
  getChildNodeIds: (nodeId: string) => string[];
  getParentNodeIds: (nodeId: string) => string[];
  getRootNodeIds: () => string[];
}

export const useExecutionGraphStore = createWithEqualityFn<ExecutionGraphState>()(
  (set, get) => ({
    // Initial state
    graph: new Map<string, GraphNode>(),
    
    // Build or rebuild the execution graph
    buildGraph: (nodes: Node[], edges: Edge[]) => {
      const graph = buildExecutionGraph(nodes, edges);
      console.log(`[ExecutionGraphStore] Built graph with ${graph.size} nodes`);
      
      // Log some basic statistics about the graph
      const levels = new Map<number, number>();
      let maxLevel = 0;
      
      graph.forEach(node => {
        maxLevel = Math.max(maxLevel, node.level);
        const count = levels.get(node.level) || 0;
        levels.set(node.level, count + 1);
      });
      
      console.log(`[ExecutionGraphStore] Graph levels: ${maxLevel + 1}`);
      levels.forEach((count, level) => {
        console.log(`[ExecutionGraphStore] Level ${level}: ${count} nodes`);
      });
      
      set({ graph });
    },
    
    // Get the level (depth) of a node in the graph
    getNodeLevel: (nodeId: string) => {
      const { graph } = get();
      const node = graph.get(nodeId);
      return node ? node.level : -1;
    },
    
    // Get child node IDs for a given node
    getChildNodeIds: (nodeId: string) => {
      const { graph } = get();
      const node = graph.get(nodeId);
      return node ? node.childIds : [];
    },
    
    // Get parent node IDs for a given node
    getParentNodeIds: (nodeId: string) => {
      const { graph } = get();
      const node = graph.get(nodeId);
      return node ? node.parentIds : [];
    },
    
    // Get all root node IDs (nodes with no parents)
    getRootNodeIds: () => {
      const { graph } = get();
      const rootNodeIds: string[] = [];
      
      graph.forEach((node, id) => {
        if (node.parentIds.length === 0) {
          rootNodeIds.push(id);
        }
      });
      
      return rootNodeIds;
    }
  }),
  shallow
);

// Export key actions and selectors
export const buildExecutionGraphFromFlow = (nodes: Node[], edges: Edge[]) => {
  useExecutionGraphStore.getState().buildGraph(nodes, edges);
};

export const getExecutionGraph = () => useExecutionGraphStore.getState().graph;
export const getNodeLevel = (nodeId: string) => useExecutionGraphStore.getState().getNodeLevel(nodeId);
export const getChildNodeIds = (nodeId: string) => useExecutionGraphStore.getState().getChildNodeIds(nodeId);
export const getParentNodeIds = (nodeId: string) => useExecutionGraphStore.getState().getParentNodeIds(nodeId);
export const getRootNodeIds = () => useExecutionGraphStore.getState().getRootNodeIds(); 