import { Node } from './Node';
import { getNodeFactory, getAllNodeTypes } from './NodeRegistry';
import { FlowExecutionContext } from './FlowExecutionContext';
// Import store getter directly - assumes it doesn't rely on hooks
import { getNodeContent, createDefaultNodeContent } from '../store/useNodeContentStore.ts'; 
import { LLMNodeContent } from '../types/nodes.ts'; // 타입 임포트 경로 수정
import { FlowNode } from '../types/nodes';

/**
 * Factory to create and manage nodes
 */
export class NodeFactory {
  private nodes: Map<string, Node>;

  constructor() {
    this.nodes = new Map<string, Node>();
  }

  /**
   * Create a node of the specified type.
   * Context can be optionally provided during creation for special nodes like GroupNode.
   * @param id The node ID
   * @param type The node type
   * @param reactFlowProps Properties passed from the React Flow node data object
   * @param context Optional execution context that can be passed to node constructors that support it
   * @returns The created node
   */
  create(
    id: string, 
    type: string, 
    reactFlowProps: Record<string, any> = {},
    context?: FlowExecutionContext // 컨텍스트 매개변수 추가
  ): Node {
    // 1. Fetch the latest content state from the store
    let latestStoredContent = getNodeContent(id, type); 
    
    // 2. Ensure essential properties exist, using defaults if necessary
    if (type === 'llm') {
        const defaultLLMContent = createDefaultNodeContent('llm', id) as LLMNodeContent;
        latestStoredContent = {
            ...defaultLLMContent, 
            ...(latestStoredContent || {}), 
            label: latestStoredContent?.label || reactFlowProps?.label || defaultLLMContent.label
        } as LLMNodeContent;
        
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
                              : createDefaultNodeContent(type, id);
        // Ensure label is consistent
        latestStoredContent.label = reactFlowProps?.label || latestStoredContent.label || `Default ${type} Label`;
    }
    
    // 3. Prepare properties - nodeFactory reference might still be useful if needed internally
    //    context is provided to special nodes like GroupNode
    const finalProperties = {
      ...latestStoredContent,
      nodeFactory: this // Keep nodeFactory reference for now, might be needed by some node logic
    };

    // 4. Use the node factory function from the registry to create the instance
    const factoryFn = getNodeFactory(type);
    if (!factoryFn) {
      const registeredTypes = getAllNodeTypes();
      console.error(`Node type "${type}" not found. Registered types: ${registeredTypes.join(', ')}`);
      throw new Error(`Unknown node type: ${type}. Check console for registered types.`);
    }

    // 특수 노드(GroupNode 등)용 로직 - context 매개변수 전달
    let node: Node;
    if (type === 'group') {
      // GroupNode 생성자는 context를 받을 수 있음
      node = factoryFn(id, finalProperties, context);
      console.log(`[NodeFactory] Created GroupNode ${id} with context: ${!!context}`);
    } else {
      // 표준 노드는 context 매개변수 없이 생성
      node = factoryFn(id, finalProperties);
    }
    
    // 모든 노드에 context를 직접 설정 (생성자에서 처리되지 않은 경우)
    if (context) {
      // Node 클래스 내에서 생성자에서 처리하므로 여기서는 생략
      // 각 노드 생성자가 context를 설정하도록 수정함
      console.log(`[NodeFactory] Node ${id} (${type}) will use provided context: ${!!context}`);
    }
    
    // 5. Store the created node instance in the factory's map
    this.nodes.set(id, node);
    console.log(`[NodeFactory] Created node ${id} (${type}) with properties:`, finalProperties);
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
   * Set child node relationships - Deprecated
   * 이 메서드는 불필요해졌습니다.
   * 노드의 자식 관계는 이제 getChildNodes()에서 context.edges를 직접 사용하여 동적으로 계산됩니다.
   * @deprecated 더 이상 사용하지 않습니다.
   */
  /*
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
  */

  /**
   * Clear all nodes
   */
  clear(): void {
    this.nodes.clear();
  }
}
