import { Node } from './Node';
import { getNodeFactory, getAllNodeTypes } from './NodeRegistry';
import { FlowExecutionContext } from './FlowExecutionContext';

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
   * @param properties The node properties
   * @param context Optional execution context
   * @returns The created node
   */
  create(
    id: string, 
    type: string, 
    properties: Record<string, any> = {}, 
    context?: FlowExecutionContext
  ): Node {
    // Add nodeFactory reference to properties
    const enrichedProperties = {
      ...properties,
      nodeFactory: this
    };

    // Use the node factory from registry
    const factoryFn = getNodeFactory(type);
    if (!factoryFn) {
      const registeredTypes = getAllNodeTypes();
      console.error(`Node type "${type}" not found. Registered types: ${registeredTypes.join(', ')}`);
      throw new Error(`Unknown node type: ${type}. Check console for registered types.`);
    }

    const node = factoryFn(id, enrichedProperties, context);
    
    // Store node in the map
    this.nodes.set(id, node);
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
