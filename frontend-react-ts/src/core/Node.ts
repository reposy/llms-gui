import { FlowExecutionContext } from './FlowExecutionContext';

/**
 * Base Node class that all nodes extend
 */
export abstract class Node {
  /**
   * Node ID
   */
  public readonly id: string;
  
  /**
   * Node type (e.g., 'input', 'llm', 'api', 'output', etc.)
   */
  public readonly type: string;

  /**
   * Node properties (configuration) - to be overridden by subclasses
   */
  public property: Record<string, any> = {};

  /**
   * IDs of child nodes
   */
  private childIds: string[] = [];

  /**
   * Execution context for the node
   */
  protected context?: FlowExecutionContext;

  /**
   * Constructor for the base Node
   * @param id Node ID
   * @param type Node type
   * @param property Node properties
   * @param context Optional execution context
   */
  constructor(
    id: string, 
    type: string, 
    property: Record<string, any> = {},
    context?: FlowExecutionContext
  ) {
    this.id = id;
    this.type = type;
    this.property = property;
    this.context = context;
  }

  /**
   * Set child node IDs
   * @param childIds Array of child node IDs
   */
  setChildIds(childIds: string[]): void {
    this.childIds = childIds;
    this.context?.log(`${this.type}(${this.id}): Set ${childIds.length} child IDs: [${childIds.join(', ')}]`);
  }

  /**
   * Get child node IDs
   * @returns Array of child node IDs
   */
  getChildIds(): string[] {
    return this.childIds;
  }

  /**
   * Get array of child nodes using the node factory and the current execution context.
   * This method ensures that the latest graph structure from the context is used
   * and attempts to reuse existing node instances from the factory's cache.
   * 
   * @returns Array of child Node instances.
   */
  getChildNodes(): Node[] {
    // Ensure context and nodeFactory are available
    if (!this.context || !this.property.nodeFactory) {
      this.context?.log(`[Node:${this.id}] Context or NodeFactory missing in getChildNodes.`);
      return [];
    }
    const { nodeFactory } = this.context;
    const currentEdges = this.context.edges;
    const currentNodes = this.context.nodes;

    // Find child node IDs using edges from the current context
    const childNodeIds = currentEdges
      .filter(edge => edge.source === this.id)
      .map(edge => edge.target);

    if (childNodeIds.length === 0) {
      // It's normal for leaf nodes to have no children, so log might be too verbose.
      // Consider logging only if specifically debugging connections.
      // log(`[Node:${this.id}] No child node IDs found based on current context edges.`);
      return [];
    }

    this.context.log(`[Node:${this.id}] Found ${childNodeIds.length} child node ID(s): [${childNodeIds.join(', ')}] based on context edges.`);

    // Attempt to get or create instances for each child ID
    return childNodeIds
      .map((childId: string) => {
        let nodeInstance = nodeFactory.getNode(childId); // Try getting from factory cache first

        if (nodeInstance) {
          this.context.log(`[Node:${this.id}] Reusing existing instance for child node ${childId}.`);
          // Ensure the reused instance has the current context if it differs?
          // This could be complex. Assume factory manages instance lifecycle correctly for now.
          // Or perhaps the context should be passed during process, not stored long-term in the node?
          // For now, we just reuse the instance.
          
          // Update graph structure in property for reused instance?
          // This ensures it can find its own children later using the latest structure.
          nodeInstance.property = {
            ...nodeInstance.property,
            // nodes: currentNodes, // Avoid storing large structures if possible
            // edges: currentEdges,
            nodeFactory: nodeFactory // Ensure factory is present
          };

        } else {
          this.context.log(`[Node:${this.id}] No existing instance found for child ${childId}. Creating new one.`);
          const nodeData = currentNodes.find((n: any) => n.id === childId);
          if (!nodeData) {
            this.context.log(`[Node:${this.id}] Node data for child ${childId} not found in current context nodes.`);
            return null;
          }
          try {
            nodeInstance = nodeFactory.create(
              nodeData.id,
              nodeData.type,
              nodeData.data,
              this.context // Pass the current context
            );
            // Newly created instance already has nodeFactory injected by create()
             // and its properties are based on latest store content + reactFlowProps (if needed)
          } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error);
              this.context.log(`[Node:${this.id}] Error creating child node instance ${childId} (type: ${nodeData?.type}): ${errorMessage}`);
              return null;
          }
        }
        
        // Ensure the instance has the necessary context info, perhaps just nodeFactory?
        // Passing full nodes/edges into property might be inefficient.
        // The instance should ideally use its own context to get nodes/edges when needed.
        // Let's rely on the context object passed during creation/retrieval for now.

        return nodeInstance;
      })
      .filter((node): node is Node => node !== null); // Use type predicate for filtering nulls
  }

  /**
   * Process input through this node and chain through child nodes
   * This provides common lifecycle management for all nodes
   * 
   * @param input The input to process
   * @returns Promise that resolves when this node and its descendants have finished processing
   */
  async process(input: any): Promise<void> { // process 자체는 반환값이 없을 수 있음
    // 1. 실행 시작 마크 (Node 인스턴스가 context를 가지고 있는지 확인)
    if (!this.context) {
      console.error(`[Node:${this.id}] Execution context is missing. Cannot process.`);
      // 컨텍스트가 없으면 더 이상 진행 불가, 오류 처리가 필요할 수 있음
      // 여기서 오류를 던지거나 특정 상태를 설정하는 것을 고려
      return;
    }
    this.context.markNodeRunning(this.id);
    this.context.log(`[Node:${this.id}] Process started.`);

    try {
      // 2. 실제 로직 실행
      this.context.log(`[Node:${this.id}] Calling execute...`);
      const output = await this.execute(input);
      this.context.log(`[Node:${this.id}] Execute returned.`);

      // 3. 성공 처리 및 결과 저장
      if (output !== null && output !== undefined) {
        // output이 배열이면, 각 요소를 개별적으로 storeOutput
        if (Array.isArray(output)) {
          if (output.length > 0) {
            this.context.log(`[Node:${this.id}] Execute returned an array with ${output.length} items. Storing each item.`);
            for (const item of output) {
              // 각 아이템 저장
              this.context.storeOutput(this.id, item); 
            }
            // 성공 상태는 배열 전체로 마크 (UI 표시용)
            this.context.markNodeSuccess(this.id, output); 
            this.context.log(`[Node:${this.id}] Marked success with array result.`);
          } else {
             this.context.log(`[Node:${this.id}] Execute returned empty array.`);
             this.context.markNodeSuccess(this.id, []); // 빈 배열로 성공 마크
          }
        } else {
          // 배열이 아니면 output을 그대로 storeOutput
          this.context.log(`[Node:${this.id}] Execute returned a single item. Storing it.`);
          this.context.storeOutput(this.id, output); 
          this.context.markNodeSuccess(this.id, output);
        }

        // 4. 후속 노드 병렬 실행 (결과가 있어야 실행)
        const children = this.getChildNodes(); // getChildNodes는 Node 인스턴스 배열 반환 가정
        if (children.length > 0) {
           this.context.log(`[Node:${this.id}] Executing ${children.length} child node(s) in parallel.`);
           const childPromises = children.map(child => {
             this.context?.log(`[Node:${this.id}] Triggering process for child ${child.id}`);
             // execute가 반환한 원본 output (배열 또는 단일값)을 그대로 전달
             return child.process(output);
           });
           await Promise.all(childPromises); // 모든 자식 노드의 process 완료 대기
           this.context.log(`[Node:${this.id}] Finished executing child node(s).`);
        } else {
             this.context.log(`[Node:${this.id}] No child nodes to execute.`);
        }
      } else {
           // execute 결과가 null 또는 undefined인 경우
           this.context.log(`[Node:${this.id}] Execute returned null or undefined. Stopping branch.`);
           // 결과가 없어도 노드 자체는 성공적으로 실행된 것으로 간주하고 Success 마크
           // (오류가 발생했다면 catch 블록으로 갔을 것)
           this.context.markNodeSuccess(this.id, output); // null 또는 undefined로 성공 상태 업데이트
      }

    } catch (error) {
      // 5. 오류 처리
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.context.log(`[Node:${this.id}] Error during execution: ${errorMessage}`);
      this.context.markNodeError(this.id, errorMessage);
      // 오류 발생 시 후속 노드 실행은 try 블록을 벗어나므로 자연스럽게 중단됨
    }
    this.context.log(`[Node:${this.id}] Process finished.`);
  }

  /**
   * Execute the core functionality of the node
   * To be implemented by subclasses
   * 
   * @param input The input to process
   * @returns The processed result
   */
  abstract execute(input: any): Promise<any>;
} 