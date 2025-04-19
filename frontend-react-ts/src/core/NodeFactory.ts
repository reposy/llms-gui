import { Node } from './Node';
import { getNodeFactory, getAllNodeTypes } from './NodeRegistry';
import { FlowExecutionContext } from './FlowExecutionContext';
// Import store getter directly - assumes it doesn't rely on hooks
import { getNodeContent, createDefaultNodeContent } from '../store/useNodeContentStore.ts'; 
import { LLMNodeContent } from '../store/useNodeContentStore.ts'; // Import specific type

/**
 * Factory to create and manage nodes
 */
export class NodeFactory {
  private nodes: Map<string, Node>;

  constructor() {
    this.nodes = new Map<string, Node>();
  }

  /**
   * Create a node of the specified type
   * @param id The node ID
   * @param type The node type
   * @param reactFlowProps Properties passed from the React Flow node data object
   * @param context Optional execution context
   * @returns The created node
   */
  create(
    id: string, 
    type: string, 
    reactFlowProps: Record<string, any> = {}, 
    context?: FlowExecutionContext
  ): Node {
    // 1. Fetch the latest content state from the store
    let latestStoredContent = getNodeContent(id, type); // Uses store getter
    
    // 2. Ensure essential properties exist, using defaults if necessary
    if (type === 'llm') {
        const defaultLLMContent = createDefaultNodeContent('llm') as LLMNodeContent;
        latestStoredContent = {
            ...defaultLLMContent, // Start with defaults
            ...(latestStoredContent || {}), // Overlay stored content (if any)
            label: latestStoredContent?.label || reactFlowProps?.label || defaultLLMContent.label // Prioritize labels correctly
        } as LLMNodeContent;
        
        // Ensure required fields are present after merge
        if (!latestStoredContent.provider || !latestStoredContent.model) {
             console.warn(`[NodeFactory] LLM node ${id} missing provider or model in store. Applying defaults.`);
             latestStoredContent.provider = latestStoredContent.provider || defaultLLMContent.provider;
             latestStoredContent.model = latestStoredContent.model || defaultLLMContent.model;
        }
    } else if (!latestStoredContent || Object.keys(latestStoredContent).length === 0) {
        // For other node types, if not found in store, try using reactFlowProps
        // or fall back to default content for the type.
        console.warn(`[NodeFactory] Content for ${type} node ${id} not found in store. Using reactFlowProps or defaults.`);
        latestStoredContent = reactFlowProps && Object.keys(reactFlowProps).length > 0 
                              ? reactFlowProps 
                              : createDefaultNodeContent(type);
        // Ensure label is consistent
        latestStoredContent.label = reactFlowProps?.label || latestStoredContent.label || `Default ${type} Label`;
    }
    
    // 3. Add nodeFactory reference (needed for dynamic child resolution in Node.ts)
    const enrichedProperties = {
      ...latestStoredContent,
      nodeFactory: this
    };

    // 4. Use the node factory function from the registry to create the instance
    const factoryFn = getNodeFactory(type);
    if (!factoryFn) {
      const registeredTypes = getAllNodeTypes();
      console.error(`Node type "${type}" not found. Registered types: ${registeredTypes.join(', ')}`);
      throw new Error(`Unknown node type: ${type}. Check console for registered types.`);
    }

    const node = factoryFn(id, enrichedProperties, context); // Pass the validated/enriched properties
    
    // 5. Store the created node instance in the factory's map
    this.nodes.set(id, node);
    console.log(`[NodeFactory] Created node ${id} (${type}) with properties:`, enrichedProperties);
    return node;
  }

  /**
   * Get a node by ID
   * @param id The node ID
   * @returns The node or undefined if not found
   */
  getNode(id: string): Node | undefined {
    return this.nodes.get(id);
  }

  /**
   * Set child node relationships
   * @param edges Array of edges in the flow
   */
  setRelationships(edges: Array<{ source: string, target: string }>): void {
    // Create a map of child IDs for each node
    const childMap = new Map<string, string[]>();

    // Process all edges
    for (const edge of edges) {
      const { source, target } = edge;
      
      // Skip if source doesn't exist
      if (!this.nodes.has(source)) {
        continue;
      }

      // Get or create child array
      const children = childMap.get(source) || [];
      
      // Add target as child if not already present
      if (!children.includes(target)) {
        children.push(target);
      }
      
      // Update the map
      childMap.set(source, children);
    }

    // Set child IDs for each node
    for (const [nodeId, childIds] of childMap.entries()) {
      const node = this.nodes.get(nodeId);
      if (node) {
        node.setChildIds(childIds);
      }
    }
  }

  /**
   * Clear all nodes
   */
  clear(): void {
    this.nodes.clear();
  }
}
