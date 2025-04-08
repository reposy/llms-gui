import { Node, Edge } from 'reactflow';
import { cloneDeep } from 'lodash';
import { NodeData, NodeType } from '../types/nodes';
import { loadFromImportedContents, NodeContent, getAllNodeContents } from '../store/useNodeContentStore';
import { setNodes, setEdges, useFlowStructureStore } from '../store/useFlowStructureStore';

export interface FlowData {
  name?: string;
  createdAt?: string;
  nodes: Node<NodeData>[];
  edges: Edge[];
  contents?: Record<string, NodeContent>;
  meta?: {
    llmDefaults?: {
      provider: string;
      url: string;
    };
  };
}

/**
 * Validates if a node type is a supported type in the application
 */
function isSupportedNodeType(type: string): boolean {
  // List of currently supported node types
  const supportedTypes: NodeType[] = [
    'llm', 
    'api', 
    'output', 
    'input', 
    'group', 
    'conditional', 
    'merger',
    'json-extractor'
  ];
  
  return supportedTypes.includes(type as NodeType);
}

/**
 * Imports flow data from a JSON structure into the application state.
 * 
 * @param flowData The flow data object containing nodes, edges, and node contents
 * @returns An object containing the imported nodes and edges
 */
export function importFlowFromJson(flowData: FlowData): { nodes: Node<NodeData>[]; edges: Edge[] } {
  // Validate flow data
  if (!flowData) {
    throw new Error('Invalid flow data: Flow data is null or undefined');
  }

  if (!Array.isArray(flowData.nodes)) {
    throw new Error('Invalid flow data: Nodes array is missing or not an array');
  }

  if (!Array.isArray(flowData.edges)) {
    throw new Error('Invalid flow data: Edges array is missing or not an array');
  }

  console.log('[importFlowFromJson] Processing flow data:', { 
    nodeCount: flowData.nodes.length,
    edgeCount: flowData.edges.length,
    hasContents: !!flowData.contents,
    flowName: flowData.name
  });

  // Process and validate nodes
  const importedNodes: Node<NodeData>[] = flowData.nodes.map(node => {
    const importedNode = cloneDeep(node);
    
    // Validate node has a type
    if (!importedNode.type) {
      console.warn(`[importFlowFromJson] Node ${importedNode.id} is missing a type. Defaulting to 'output'.`);
      importedNode.type = 'output';
    } else if (!isSupportedNodeType(importedNode.type)) {
      console.warn(`[importFlowFromJson] Node ${importedNode.id} has unsupported type: ${importedNode.type}. This may cause issues.`);
    }
    
    // Fix missing properties based on node type
    if (importedNode.type === 'group' && !importedNode.dragHandle) {
      console.warn(`[importFlowFromJson] Adding missing dragHandle to group node ${importedNode.id}`);
      importedNode.dragHandle = '.group-node-header';
    }

    // Ensure node has required fields
    if (!importedNode.id) {
      console.error(`[importFlowFromJson] Node is missing an ID. This will cause errors.`);
      importedNode.id = `generated-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    }

    if (!importedNode.position || typeof importedNode.position.x !== 'number' || typeof importedNode.position.y !== 'number') {
      console.warn(`[importFlowFromJson] Node ${importedNode.id} has invalid position. Setting default position.`);
      importedNode.position = { x: 100, y: 100 };
    }

    // Ensure data object exists
    if (!importedNode.data) {
      console.warn(`[importFlowFromJson] Node ${importedNode.id} is missing data. Initializing empty data object.`);
      // Create a basic data object with just the type
      importedNode.data = { type: importedNode.type } as NodeData;
    }
    
    // Set default data properties based on node type if missing
    if (importedNode.type === 'llm') {
      // Cast to the correct type and set defaults only if it is an LLM node
      const llmData = importedNode.data as any;
      if (!llmData.model) {
        llmData.model = 'llama3';
      }
    }
    
    // Add any other required properties
    if (!importedNode.width) importedNode.width = 200;
    if (!importedNode.height) importedNode.height = 150;
    
    return importedNode;
  });

  // Process edges
  const importedEdges: Edge[] = flowData.edges.map(edge => {
    const importedEdge = cloneDeep(edge);
    
    // Validate edge has source and target
    if (!importedEdge.source || !importedEdge.target) {
      console.warn(`[importFlowFromJson] Edge ${importedEdge.id} is missing source or target.`);
    }
    
    // Ensure edge has an ID
    if (!importedEdge.id) {
      importedEdge.id = `edge-${importedEdge.source}-${importedEdge.target}-${Date.now()}`;
    }
    
    return importedEdge;
  });

  // Validate edge connectivity - filter out edges pointing to non-existent nodes
  const validNodeIds = new Set(importedNodes.map(node => node.id));
  const validatedEdges = importedEdges.filter(edge => {
    const isValid = validNodeIds.has(edge.source) && validNodeIds.has(edge.target);
    if (!isValid) {
      console.warn(`[importFlowFromJson] Removing edge ${edge.id} because source or target node doesn't exist`);
    }
    return isValid;
  });

  // Update Zustand stores
  setNodes(importedNodes);
  setEdges(validatedEdges);
  console.log('[importFlowFromJson] Updated flow structure with nodes and edges');

  // Process node contents if available
  if (flowData.contents) {
    // Verify content is for valid nodes
    const validContents: Record<string, NodeContent> = {};
    
    Object.entries(flowData.contents).forEach(([nodeId, content]) => {
      const node = importedNodes.find(n => n.id === nodeId);
      if (node) {
        console.log(`[importFlowFromJson] Loading stored content for node ${nodeId} (${node.type})`);
        validContents[nodeId] = content;
      } else {
        console.warn(`[importFlowFromJson] Content found for node ${nodeId}, but node doesn't exist in nodes array. Skipping.`);
      }
    });
    
    // Load contents to store
    loadFromImportedContents(validContents);
    console.log('[importFlowFromJson] Loaded node contents from imported flow data');
  } else {
    console.warn('[importFlowFromJson] No node contents in imported flow data');
  }

  return { 
    nodes: importedNodes, 
    edges: validatedEdges 
  };
}

/**
 * Exports the current flow state as a JSON-serializable object
 * @returns The complete flow data object with nodes, edges, and contents
 */
export const exportFlowAsJson = (): FlowData => {
  // Get the nodes and edges from the Zustand store
  const nodes = useFlowStructureStore.getState().nodes;
  const edges = useFlowStructureStore.getState().edges;
  
  // Get the node contents from the Zustand store
  const nodeContents = getAllNodeContents();

  // Combine everything into a single flow object
  const flowData: FlowData = {
    name: `Flow ${new Date().toLocaleString()}`,
    createdAt: new Date().toISOString(),
    nodes,
    edges,
    contents: nodeContents,
    meta: {
      llmDefaults: {
        provider: 'ollama',
        url: 'http://localhost:11434'
      }
    }
  };

  console.log('[exportFlowAsJson] Created flow data with:', {
    nodes: nodes.length,
    edges: edges.length,
    nodeContents: Object.keys(nodeContents).length
  });

  return flowData;
}; 