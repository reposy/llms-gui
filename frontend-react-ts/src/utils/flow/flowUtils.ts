import { Node, Edge } from '@xyflow/react';
import { NodeType, NodeProperty } from '../../types/nodes';
import { ExecutableNode } from '../../core/ExecutableNode';

// Constants for node positioning
const NODE_WIDTH = 350; // Adjusted based on current node styling (w-[350px])
const NODE_HEIGHT = 150; // Approximate height, adjust if needed
const NODE_SPACING_X = 300; // Increased from 200 to 300 for more horizontal space
const NODE_SPACING_Y = 150; // Increased from 100 to 150 for more vertical space

// Helper function to calculate position for a new node
export const calculateNodePosition = (
  nodes: Node<NodeProperty>[],
  selectedNodeId: string | null,
  viewport?: { x: number; y: number; zoom: number }
) => {
  // If there's a selected node, position relative to it
  if (selectedNodeId) {
    const selectedNode = nodes.find(node => node.id === selectedNodeId);
    if (selectedNode) {
      return {
        x: selectedNode.position.x + NODE_WIDTH + NODE_SPACING_X,
        y: selectedNode.position.y // Place next to it vertically aligned initially
      };
    }
  }

  // If there are existing nodes but none selected, position near the last node added
  if (nodes.length > 0) {
    // Find the node with the maximum x position to place the new node to its right
    // This is slightly better than just using the last node in the array
    const rightmostNode = nodes.reduce((prev, current) => (prev.position.x > current.position.x) ? prev : current);
    return {
      x: rightmostNode.position.x + NODE_WIDTH + NODE_SPACING_X,
      y: rightmostNode.position.y
    };
  }

  // If viewport is provided, try to center in viewport
  if (viewport && typeof window !== 'undefined') { // Check for window existence for safety
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const viewportCenter = {
      x: -viewport.x / viewport.zoom + viewportWidth / 2 / viewport.zoom,
      y: -viewport.y / viewport.zoom + viewportHeight / 2 / viewport.zoom
    };
    return {
      x: viewportCenter.x - NODE_WIDTH / 2,
      y: viewportCenter.y - NODE_HEIGHT / 2
    };
  }

  // Default position if no other conditions are met (e.g., first node, no viewport)
  return { x: 100, y: 100 };
};

// Utility to resolve simple {{item}} templates
export const resolveTemplate = (template: string | undefined, context: { item: any }): string => {
  if (template === undefined) return '';
  try {
    const itemString = typeof context.item === 'object' 
                      ? JSON.stringify(context.item) 
                      : String(context.item);
    return template.replace(/\{\{\s*item\s*\}\}/g, itemString);
  } catch (e) {
      return template;
  }
};

// Helper function to create a new node
export const createNewNode = (
  type: NodeType,
  position: { x: number; y: number }
): Node<NodeProperty> => {
  console.log(`[createNewNode] Creating new node of type: ${type} at position:`, position);
  // Generate a unique ID for the node
  const newNodeId = `${type}-${crypto.randomUUID()}`;
  console.log(`[createNewNode] Generated new node ID: ${newNodeId}`);
  // Get the default data for the node type from the store (type, id)
  const defaultData = require('../../store/useNodePropertyStore').createDefaultNodeProperty(type, newNodeId);
  console.log(`[createNewNode] Created default data for ${type} node:`, defaultData);
  // Create the base node
  const newNode: Node<NodeProperty> = {
    id: newNodeId,
    type,
    position,
    data: defaultData,
  };
  // Apply special properties for specific node types
  if (type === 'group') {
    newNode.style = { width: 1200, height: 700 };
    newNode.dragHandle = '.group-node-container';
    console.log(`[createNewNode] Applied special properties for group node:`, newNode.style);
  }
  console.log(`[createNewNode] Final node object:`, newNode);
  return newNode;
};

// Helper function to remove edges connected to deleted nodes
export const removeConnectedEdges = (
  nodesToDelete: Node<NodeProperty>[],
  edges: Edge[]
): Edge[] => {
  const nodeIds = new Set(nodesToDelete.map(n => n.id));
  return edges.filter(e => !nodeIds.has(e.source) && !nodeIds.has(e.target));
};

/**
 * Ensures ReactFlow nodes' visual selection state matches Zustand's selectedNodeIds
 * 
 * @param nodes - The ReactFlow nodes to update
 * @param selectedNodeIds - Array of node IDs that should be visually selected
 * @returns A new array of nodes with updated selection states
 */
export function syncVisualSelectionToReactFlow(
  nodes: Node<NodeProperty>[],
  selectedNodeIds: string[]
): Node<NodeProperty>[] {
  // Create a Set for faster lookups
  const selectedIdsSet = new Set(selectedNodeIds);
  
  // Return a new array where each node has a correct selection state
  return nodes.map(node => {
    const shouldBeSelected = selectedIdsSet.has(node.id);
    
    // Only create a new node object if selection state needs to change
    if (!!node.selected !== shouldBeSelected) {
      return {
        ...node,
        selected: shouldBeSelected
      };
    }
    
    // Return unchanged node if selection state already matches
    return node;
  });
}

// Get a specific node by ID from a collection of nodes
export function getNodeById(nodes: Node<NodeProperty>[], nodeId: string): Node<NodeProperty> | undefined {
  return nodes.find(node => node.id === nodeId);
}

// Updated functions with enhanced return types
export function getOutgoingEdges(edges: Edge[], nodeId: string): Edge[] {
  return edges.filter(edge => edge.source === nodeId);
}

export function getIncomingEdges(edges: Edge[], nodeId: string): Edge[] {
  return edges.filter(edge => edge.target === nodeId);
}

export function getConnectedEdges(edges: Edge[], nodeId: string): Edge[] {
  return edges.filter(edge => edge.source === nodeId || edge.target === nodeId);
}

// Get all direct child nodes connected to a specified node
export function getChildNodes(nodes: Node<NodeProperty>[], edges: Edge[], nodeId: string): Node<NodeProperty>[] {
  const outgoingEdges = getOutgoingEdges(edges, nodeId);
  const childNodeIds = outgoingEdges.map(edge => edge.target);
  return nodes.filter(node => childNodeIds.includes(node.id));
}

// Get child nodes connected via a specific handle (for conditional nodes)
export function getChildNodesByHandle(nodes: Node<NodeProperty>[], edges: Edge[], nodeId: string, handle: string): Node<NodeProperty>[] {
  const outgoingEdges = edges.filter(edge => 
    edge.source === nodeId && edge.sourceHandle === handle
  );
  const childNodeIds = outgoingEdges.map(edge => edge.target);
  return nodes.filter(node => childNodeIds.includes(node.id));
}

// Create executable nodes for all child nodes
export function createExecutableChildNodes(nodes: Node<NodeProperty>[], edges: Edge[], nodeId: string): ExecutableNode[] {
  const childNodes = getChildNodes(nodes, edges, nodeId);
  return childNodes.map(node => {
    return {
      nodeId: node.id,
      execute: async () => null,
      getChildNodes: () => [],
      process: async () => null
    };
  });
}

// Create executable nodes for children connected via a specific handle
export function createExecutableChildNodesByHandle(
  nodes: Node<NodeProperty>[], 
  edges: Edge[], 
  nodeId: string, 
  handle: string
): ExecutableNode[] {
  const childNodes = getChildNodesByHandle(nodes, edges, nodeId, handle);
  return childNodes.map(node => {
    return {
      nodeId: node.id,
      execute: async () => null,
      getChildNodes: () => [],
      process: async () => null
    };
  });
}

// Remove existing implementations of these functions and update with enhanced versions
export function getNodeConnections(
  nodes: Node<NodeProperty>[],
  edges: Edge[],
  nodeId: string,
  direction: 'incoming' | 'outgoing' = 'outgoing'
): string[] {
  if (direction === 'incoming') {
    return edges
      .filter(edge => edge.target === nodeId)
      .map(edge => edge.source);
  } else {
    return edges
      .filter(edge => edge.source === nodeId)
      .map(edge => edge.target);
  }
}

export function findNodeById(nodeId: string, nodes: Node<NodeProperty>[]): Node<NodeProperty> | undefined {
  return nodes.find(node => node.id === nodeId);
}

/**
 * Get detailed outgoing connections from a node
 */
export function getOutgoingConnections(
  nodeId: string, 
  edges: Edge[]
): { sourceHandle: string | null; targetNodeId: string; targetHandle: string | null }[] {
  return edges
    .filter(edge => edge.source === nodeId)
    .map(edge => ({
      sourceHandle: edge.sourceHandle ?? null,
      targetNodeId: edge.target,
      targetHandle: edge.targetHandle ?? null
    }));
}

/**
 * Get detailed incoming connections to a node
 */
export function getIncomingConnections(
  nodeId: string,
  edges: Edge[]
): { sourceNodeId: string; sourceHandle: string | null; targetHandle: string | null }[] {
  return edges
    .filter(edge => edge.target === nodeId)
    .map(edge => ({
      sourceNodeId: edge.source,
      sourceHandle: edge.sourceHandle ?? null,
      targetHandle: edge.targetHandle ?? null
    }));
}

/**
 * Get all output nodes (nodes with no outgoing connections)
 */
export function getOutputNodes(nodes: Node<NodeProperty>[], edges: Edge[]): Node<NodeProperty>[] {
  const nodesWithOutgoing = new Set(edges.map(edge => edge.source));
  return nodes.filter(node => !nodesWithOutgoing.has(node.id));
}

/**
 * Get all input nodes (nodes with no incoming connections)
 */
export function getInputNodes(nodes: Node<NodeProperty>[], edges: Edge[]): Node<NodeProperty>[] {
  const nodesWithIncoming = new Set(edges.map(edge => edge.target));
  return nodes.filter(node => !nodesWithIncoming.has(node.id));
}

/**
 * Finds all root nodes in a given set of nodes and edges.
 * Root nodes are those with no incoming edges.
 * Handles Group nodes correctly (a Group node can be a root, but nodes inside it are not global roots).
 * 
 * @param nodes Array of all nodes
 * @param edges Array of all edges
 * @returns Array of root node IDs
 */
export function getRootNodeIds(nodes: Node<NodeProperty>[], edges: Edge[]): string[] {
  // Create a set of all target nodes
  const incomingTargets = new Set(edges.map(edge => edge.target));

  // Filter out nodes that don't have any incoming edges and aren't a child of any node
  return nodes
    .filter(node => {
      return !incomingTargets.has(node.id) && !node.parentId; // Check parentId for group membership
    })
    .map(node => node.id);
}

/**
 * Represents a node in the execution graph with its relationships
 */
export interface GraphNode {
  id: string;
  type: string;
  data: any;
  parentIds: string[];
  childIds: string[];
  level: number; // Depth in the graph (0 for root nodes)
}

/**
 * Builds a complete execution graph structure from nodes and edges
 * This provides a runtime-accessible representation of the flow structure
 * 
 * @param nodes Array of nodes in the flow
 * @param edges Array of edges connecting the nodes
 * @returns Map of node IDs to GraphNode objects with relationship information
 */
export function buildExecutionGraph(nodes: Node<NodeProperty>[], edges: Edge[]): Map<string, GraphNode> {
  const graph = new Map<string, GraphNode>();
  
  // Initialize all nodes in the graph with empty relationships
  nodes.forEach(node => {
    graph.set(node.id, {
      id: node.id,
      type: node.type as string,
      data: node.data,
      parentIds: [],
      childIds: [],
      level: -1 // Will be calculated later
    });
  });
  
  // Build relationships from edges
  edges.forEach(edge => {
    const sourceNode = graph.get(edge.source);
    const targetNode = graph.get(edge.target);
    
    if (sourceNode && targetNode) {
      // Add child relationship
      if (!sourceNode.childIds.includes(targetNode.id)) {
        sourceNode.childIds.push(targetNode.id);
      }
      
      // Add parent relationship
      if (!targetNode.parentIds.includes(sourceNode.id)) {
        targetNode.parentIds.push(sourceNode.id);
      }
    }
  });
  
  // Calculate node levels (depth from root)
  const rootNodeIds = getRootNodeIds(nodes, edges);
  
  // Set all root nodes to level 0
  rootNodeIds.forEach(id => {
    const node = graph.get(id);
    if (node) {
      node.level = 0;
    }
  });
  
  // Propagate levels through the graph using a breadth-first approach
  let currentNodes = [...rootNodeIds];
  let currentLevel = 0;
  
  while (currentNodes.length > 0) {
    currentLevel++;
    const nextNodes: string[] = [];
    
    // Process all nodes at the current level
    for (const nodeId of currentNodes) {
      const node = graph.get(nodeId);
      if (!node) continue;
      
      // Add all children to the next level
      for (const childId of node.childIds) {
        const childNode = graph.get(childId);
        if (childNode) {
          // Only update the level if it's not set yet or this path is shorter
          if (childNode.level === -1 || childNode.level > currentLevel) {
            childNode.level = currentLevel;
            nextNodes.push(childId);
          }
        }
      }
    }
    
    currentNodes = nextNodes;
  }
  
  // Handle cycles by setting any remaining unleveled nodes
  graph.forEach(node => {
    if (node.level === -1) {
      node.level = 999; // High number to indicate nodes in a cycle or disconnected
    }
  });
  
  return graph;
}

/**
 * Get child node IDs for a node from the execution graph
 * 
 * @param nodeId ID of the node to get children for
 * @param graph Execution graph from buildExecutionGraph
 * @returns Array of child node IDs
 */
export function getChildNodeIdsFromGraph(nodeId: string, graph: Map<string, GraphNode>): string[] {
  const node = graph.get(nodeId);
  return node ? node.childIds : [];
}

/**
 * Get parent node IDs for a node from the execution graph
 * 
 * @param nodeId ID of the node to get parents for
 * @param graph Execution graph from buildExecutionGraph
 * @returns Array of parent node IDs
 */
export function getParentNodeIdsFromGraph(nodeId: string, graph: Map<string, GraphNode>): string[] {
  const node = graph.get(nodeId);
  return node ? node.parentIds : [];
}

// findAllDescendantNodeIds 함수 구현체 추가
export const findAllDescendantNodeIds = (
  startNodeId: string,
  nodes: Node<NodeProperty>[],
  edges: Edge[],
  allNodes: Set<string> = new Set()
): Set<string> => {
  // 이미 방문한 노드는 다시 방문하지 않습니다
  if (allNodes.has(startNodeId)) {
    return allNodes;
  }
  
  // 현재 노드 추가
  allNodes.add(startNodeId);
  
  // 현재 노드에서 나가는 모든 엣지 찾기
  const outgoingEdges = edges.filter(edge => edge.source === startNodeId);
  
  // 각 타겟 노드에 대해 재귀적으로 후손 노드 찾기
  for (const edge of outgoingEdges) {
    findAllDescendantNodeIds(edge.target, nodes, edges, allNodes);
  }
  
  return allNodes;
};

// 타입 호환성 문제 수정 - Node[] 배열을 Node<NodeProperty>[] 타입으로 변환하는 방법 추가
export const getRootNodeIdsWithTypeConversion = (nodes: Node<NodeProperty>[], edges: Edge[]): string[] => {
  // 명시적인 타입 변환을 통해 Node[]를 Node<NodeProperty>[]로 처리
  const typedNodes = nodes as Node<NodeProperty>[];
  return getRootNodeIds(typedNodes, edges);
};

// findRootNodes 함수에서 getRootNodeIds 호출 부분 변경
export function findRootNodes(nodes: Node<NodeProperty>[], edges: Edge[]): Node<NodeProperty>[] {
  // 타입 변환 함수 호출로 변경
  const rootNodeIds = getRootNodeIdsWithTypeConversion(nodes, edges);
  return nodes.filter(node => rootNodeIds.includes(node.id));
} 