import { Node, Edge } from 'reactflow';
import { NodeData, LLMNodeData, APINodeData, OutputNodeData, JSONExtractorNodeData, NodeType, InputNodeData, GroupNodeData, ConditionalNodeData, MergerNodeData } from '../types/nodes';

// Constants for node positioning
const NODE_WIDTH = 350; // Adjusted based on current node styling (w-[350px])
const NODE_HEIGHT = 150; // Approximate height, adjust if needed
const NODE_SPACING_X = 300; // Increased from 200 to 300 for more horizontal space
const NODE_SPACING_Y = 150; // Increased from 100 to 150 for more vertical space

// Helper function to calculate position for a new node
export const calculateNodePosition = (
  nodes: Node<NodeData>[],
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

// Helper function to create default data for a new node
export const createDefaultNodeData = (type: NodeType): NodeData => {
  const baseData = {
    label: type.charAt(0).toUpperCase() + type.slice(1), // Capitalize first letter
    isExecuting: false, // This might be managed by execution store, but good default
  };

  switch (type) {
    case 'llm':
      return {
        ...baseData,
        type: 'llm',
        label: 'LLM', // Specific default label
        provider: 'ollama',
        model: 'llama3.1', // Updated from 'llama2' to 'llama3.1'
        prompt: '',
        temperature: 0.7,
        ollamaUrl: 'http://localhost:11434' // Default Ollama URL
      } as LLMNodeData;
    case 'api':
      return {
        ...baseData,
        type: 'api',
        label: 'API', // Specific default label
        method: 'GET',
        url: '',
        headers: {},
        body: '', // Add default body field
        useInputAsBody: false,
      } as APINodeData;
    case 'output':
      return {
        ...baseData,
        type: 'output',
        label: 'Output', // Specific default label
        format: 'text',
        content: '' // Add default content field
      } as OutputNodeData;
    case 'json-extractor':
      return {
        ...baseData,
        type: 'json-extractor',
        label: 'JSON Extractor',
        path: '' // Add default path field
      } as JSONExtractorNodeData;
    case 'input':
      return {
        ...baseData,
        type: 'input',
        label: 'Input',
        inputType: 'text', // Default to text input
        text: '', 
        items: [], // Default empty items array
        iterateEachRow: false // Default to disabled
      } as InputNodeData;
    case 'group':
      return {
        ...baseData,
        type: 'group',
        label: 'Group', // Specific default label
        isCollapsed: false, // Default to expanded
      } as GroupNodeData; // Cast to GroupNodeData
    case 'conditional': // Add case for conditional node
      return {
        ...baseData,
        type: 'conditional',
        label: 'Condition',
        conditionType: 'contains', // Default type
        conditionValue: '' // Default empty value/path
        // lastEvaluationResult is initially undefined
      } as ConditionalNodeData; // Cast to ConditionalNodeData
    case 'merger': // Add case for merger node
      return {
        ...baseData,
        type: 'merger',
        label: 'Merger',
        items: [], // Initialize items array
        // result is initially null / handled by execution store
      } as MergerNodeData; // Cast to MergerNodeData
    default:
      // If an unknown type is passed, it's an error.
      // This ensures the function always returns a valid NodeData type or throws.
      // Using exhaustive check pattern with `never` type.
      const exhaustiveCheck: never = type;
      throw new Error(`Unhandled node type in createDefaultNodeData: ${exhaustiveCheck}`);
  }
};

// Utility to resolve simple {{item}} templates
export const resolveTemplate = (template: string | undefined, context: { item: any }): string => {
  if (template === undefined) return '';
  // Basic replacement, can be extended for more complex templating
  try {
    // Convert item to string for simple replacement. Handle objects if needed.
    const itemString = typeof context.item === 'object' 
                      ? JSON.stringify(context.item) 
                      : String(context.item);
    return template.replace(/\{\{\s*item\s*\}\}/g, itemString);
  } catch (e) {
      console.error("Error resolving template:", e);
      return template; // Return original template on error
  }
};

// Helper function to create a new node
export const createNewNode = (
  type: NodeType,
  position: { x: number; y: number }
): Node<NodeData> => {
  // Generate a unique ID for the node
  const newNodeId = `${type}-${crypto.randomUUID()}`;
  
  // Get the default data for the node type
  const defaultData = createDefaultNodeData(type);
  
  // Create the base node
  const newNode: Node<NodeData> = {
    id: newNodeId,
    type,
    position,
    data: defaultData,
  };

  // Apply special properties for specific node types
  if (type === 'group') {
    newNode.style = { width: 1200, height: 700 }; // Increased from 1000x600 to 1200x700 for even more space
    newNode.dragHandle = '.group-node-container'; // Allow dragging from the entire group node
  }

  return newNode;
};

// Helper function to remove edges connected to deleted nodes
export const removeConnectedEdges = (
  nodesToDelete: Node<NodeData>[],
  edges: Edge[]
): Edge[] => {
  const nodeIds = new Set(nodesToDelete.map(n => n.id));
  return edges.filter(e => !nodeIds.has(e.source) && !nodeIds.has(e.target));
}; 