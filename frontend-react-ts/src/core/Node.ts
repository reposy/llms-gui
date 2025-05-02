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
   * Get array of child nodes using the node factory from property
   * @returns Array of child Node instances
   */
  getChildNodes(): Node[] {
    // Skip if no factory or context
    const nodeFactory = this.property.nodeFactory;
    if (!this.context || !nodeFactory) {
      this.context?.log(`${this.type}(${this.id}): No node factory or context found. Cannot get child nodes.`);
      return [];
    }
    
    // If we have nodes and edges in property, use those to determine childIds dynamically
    if (this.property.nodes && this.property.edges) {
      // this.context?.log(`${this.type}(${this.id}): Using dynamic relationship resolution from edges`); // Verbose log
      
      // Get outgoing connections based on the edges
      const childNodeIds = this.property.edges
        .filter((edge: any) => edge.source === this.id)
        .map((edge: any) => edge.target);
      
      // this.context?.log(`${this.type}(${this.id}): Found ${childNodeIds.length} child nodes from edges: [${childNodeIds.join(', ')}]`); // Verbose log
      
      // Create child node instances
      return childNodeIds
        .map((childId: string) => {
          const nodeData = this.property.nodes.find((n: any) => n.id === childId);
          if (!nodeData) {
            this.context?.log(`${this.type}(${this.id}): Child node data not found for ${childId}`);
            return null;
          }
          
          // Create the node instance with the same factory, nodes, edges
          const node = nodeFactory.create(
            nodeData.id,
            nodeData.type,
            nodeData.data,
            this.context // Pass the current context
          );
          
          // Pass along graph structure to the child node
          node.property = {
            ...node.property,
            nodes: this.property.nodes,
            edges: this.property.edges,
            nodeFactory: this.property.nodeFactory
          };
          
          return node;
        })
        .filter(Boolean) as Node[];
    }
    
    // Fallback to potentially outdated stored childIds (should ideally not happen if graph is passed)
    this.context?.log(`${this.type}(${this.id}): Warning - Falling back to stored childIds: [${this.childIds.join(', ')}]`);
    return this.childIds
      .map(childId => {
        const node = nodeFactory.getNode(childId); // getNode might not be the right method, create is safer
        if (!node) {
          this.context?.log(`${this.type}(${this.id}): Child node ${childId} not found via fallback`);
        }
        return node;
      })
      .filter(Boolean) as Node[];
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
        // GroupNode의 경우, 반환된 배열의 각 요소를 저장
        if (this.type === 'group' && Array.isArray(output)) {
          if (output.length > 0) {
            this.context.log(`[Node:${this.id}] Group returned array with ${output.length} items. Storing each item.`);
            for (const item of output) {
              // Group 노드의 ID로 각 아이템 저장 (후속 노드가 Group 결과 전체를 받도록)
              this.context.storeOutput(this.id, item); 
            }
            // Group 노드 자체의 성공 상태는 마지막 아이템으로 마크 (UI 표시용)
            // 또는 전체 배열을 result로 저장할 수도 있음 - UI 요구사항에 따라 결정
            this.context.markNodeSuccess(this.id, output); // 그룹 결과 전체를 success result로 저장
            this.context.log(`[Node:${this.id}] Group marked success with array result.`);
          } else {
             this.context.log(`[Node:${this.id}] Group returned empty array.`);
             this.context.markNodeSuccess(this.id, []); // 빈 배열로 성공 마크
          }
        } else {
          // 다른 모든 노드 타입은 결과를 그대로 저장
          this.context.log(`[Node:${this.id}] Storing single output.`);
          this.context.storeOutput(this.id, output); 
          this.context.markNodeSuccess(this.id, output);
        }

        // 4. 후속 노드 병렬 실행 (결과가 있어야 실행)
        const children = this.getChildNodes(); // getChildNodes는 Node 인스턴스 배열 반환 가정
        if (children.length > 0) {
           this.context.log(`[Node:${this.id}] Executing ${children.length} child node(s) in parallel.`);
           const childPromises = children.map(child => {
             this.context?.log(`[Node:${this.id}] Triggering process for child ${child.id}`);
             return child.process(output); // output을 다음 노드로 전달
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