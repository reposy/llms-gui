import { Node } from './Node';
import { FlowExecutionContext } from './FlowExecutionContext';

interface GroupNodeProperty {
  label: string;
  // Reference to flow structure (will be provided by FlowRunner)
  nodes?: any[];
  edges?: any[];
  nodeFactory?: any;
  executionGraph?: any;
}

export class GroupNode extends Node {
  declare property: GroupNodeProperty;
  // 결과 수집을 위한 배열
  private items: any[] = [];

  /**
   * Constructor for GroupNode
   */
  constructor(
    id: string,
    property: Record<string, any> = {},
    context?: FlowExecutionContext
  ) {
    super(id, 'group', property, context);
    // Ensure label has a default value
    this.property.label = property.label || 'Group';
  }

  /**
   * Override the process method to execute all internal root nodes
   * This gets called when the Group node is explicitly executed (Run button)
   */
  async process(input: any) {
    // Mark node as running
    this.context?.markNodeRunning(this.id);
    
    try {
      // Execute group logic
      const result = await this.execute(input);
      
      // If group execution returned result, pass to child nodes in main flow
      if (result !== null) {
        // Continue normal flow by passing result to external child nodes
        for (const child of this.getChildNodes()) {
          await child.process(result);
        }
      }
      
      // Mark successful execution
      this.context?.markNodeSuccess(this.id, result);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.context?.markNodeError(this.id, errorMessage);
    }
  }

  /**
   * Execute logic for a group node by finding and executing root nodes within the group
   * @param input The input to process
   * @returns The processed result
   */
  async execute(input: any): Promise<any> {
    this.context?.log(`${this.type}(${this.id}): Executing group node`);
    
    try {
      // 결과 배열 초기화
      this.items = [];

      // 그룹 내부 노드와 엣지 정보 가져오기
      const groupNodes = this.property.nodes || [];
      const groupEdges = this.property.edges || [];
      const nodeFactory = this.property.nodeFactory;

      if (!nodeFactory || groupNodes.length === 0) {
        this.context?.log(`${this.type}(${this.id}): No node factory or nodes found within the group property. Cannot execute.`);
        return null;
      }

      // 그룹 내 실행 그래프 구성
      const executionGraph = this.buildExecutionGraph(groupNodes, groupEdges);
      
      // 루트 노드 찾기 (들어오는 엣지가 없는 노드들)
      const rootNodeIds = this.findRootNodes(executionGraph);
      this.context?.log(`${this.type}(${this.id}): Found ${rootNodeIds.length} root nodes within group: ${rootNodeIds.join(', ')}`);

      if (rootNodeIds.length === 0) {
        this.context?.log(`${this.type}(${this.id}): No root nodes found inside the group. Group execution stopped.`);
        return null;
      }

      // 노드 실행 결과 저장 맵
      const nodeResults = new Map<string, any>();
      
      // 실행된 노드 추적
      const executedNodes = new Set<string>();

      // 루트 노드부터 실행 시작
      for (const rootNodeId of rootNodeIds) {
        const nodeData = groupNodes.find((n: any) => n.id === rootNodeId);
        if (!nodeData) {
          this.context?.log(`${this.type}(${this.id}): Root node ${rootNodeId} data not found within group. Skipping.`);
          continue;
        }

        await this.executeNodeWithChaining(
          nodeData,
          input,
          executionGraph,
          nodeResults,
          executedNodes,
          groupNodes,
          nodeFactory
        );
      }

      this.context?.log(`${this.type}(${this.id}): Finished executing group, collected ${this.items.length} results`);
      
      // 수집된 결과 반환
      if (this.items.length === 0) {
        return input; // 수집된 결과가 없으면 원래 입력 반환
      } else if (this.items.length === 1) {
        return this.items[0]; // 결과가 하나면 단일 값으로 반환
      } else {
        return this.items; // 여러 결과가 있으면 배열로 반환
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.context?.log(`${this.type}(${this.id}): Error in group execution: ${errorMessage}`);
      this.context?.markNodeError(this.id, errorMessage);
      return null;
    }
  }

  /**
   * 노드를 실행하고 자식 노드들로 체이닝을 처리하는 메서드
   */
  private async executeNodeWithChaining(
    nodeData: any,
    input: any,
    executionGraph: Map<string, string[]>,
    nodeResults: Map<string, any>,
    executedNodes: Set<string>,
    groupNodes: any[],
    nodeFactory: any
  ): Promise<any> {
    const nodeId = nodeData.id;

    // 이미 실행된 노드면 결과 반환
    if (nodeResults.has(nodeId)) {
      return nodeResults.get(nodeId);
    }

    // 실행 중 표시
    if (!executedNodes.has(nodeId)) {
      executedNodes.add(nodeId);
      this.context?.markNodeRunning(nodeId);
    }

    try {
      // 노드 인스턴스 생성
      const nodeInstance = nodeFactory.create(
        nodeData.id,
        nodeData.type as string,
        nodeData.data,
        this.context
      );

      // 그룹 내부 구조 제공
      nodeInstance.property = {
        ...nodeInstance.property,
        nodes: this.property.nodes,
        edges: this.property.edges,
        nodeFactory: this.property.nodeFactory
      };

      // 노드 실행 (execute 메서드 직접 호출)
      this.context?.log(`${this.type}(${this.id}): Executing node ${nodeId} with input`);
      const result = await nodeInstance.execute(input);
      
      // 결과 저장
      nodeResults.set(nodeId, result);
      this.context?.markNodeSuccess(nodeId, result);
      this.context?.storeOutput(nodeId, result);

      // 자식 노드가 없으면 리프 노드이므로 결과를 items에 저장
      const childIds = executionGraph.get(nodeId) || [];
      if (childIds.length === 0 && result !== null) {
        this.items.push(result);
      }

      // 결과가 null이면 체이닝 중단
      if (result === null) {
        return null;
      }

      // 자식 노드들 실행
      for (const childId of childIds) {
        const childNodeData = groupNodes.find((n: any) => n.id === childId);
        if (!childNodeData) {
          this.context?.log(`${this.type}(${this.id}): Child node data not found for ${childId}`);
          continue;
        }

        await this.executeNodeWithChaining(
          childNodeData,
          result,
          executionGraph,
          nodeResults,
          executedNodes,
          groupNodes,
          nodeFactory
        );
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.context?.log(`${this.type}(${this.id}): Error executing node ${nodeId}: ${errorMessage}`);
      this.context?.markNodeError(nodeId, errorMessage);
      return null;
    }
  }

  /**
   * 실행 그래프 구성 (노드 ID -> 자식 노드 ID 배열 맵핑)
   */
  private buildExecutionGraph(nodes: any[], edges: any[]): Map<string, string[]> {
    const graph = new Map<string, string[]>();
    
    // 모든 노드에 대해 빈 자식 배열 초기화
    for (const node of nodes) {
      graph.set(node.id, []);
    }
    
    // 엣지 정보로 자식 노드 채우기
    for (const edge of edges) {
      const sourceId = edge.source;
      const targetId = edge.target;
      
      // 두 노드가 모두 그룹 내에 있는지 확인
      if (nodes.some(n => n.id === sourceId) && nodes.some(n => n.id === targetId)) {
        const children = graph.get(sourceId) || [];
        children.push(targetId);
        graph.set(sourceId, children);
      }
    }
    
    return graph;
  }

  /**
   * 루트 노드 찾기 (들어오는 엣지가 없는 노드들)
   */
  private findRootNodes(graph: Map<string, string[]>): string[] {
    const allNodes = Array.from(graph.keys());
    const allChildren = Array.from(graph.values()).flat();
    return allNodes.filter(nodeId => !allChildren.includes(nodeId));
  }
  
  /**
   * Gets all nodes that are direct children of this group
   * This is different from getChildNodes() which gets connected nodes via edges
   */
  private getInternalNodes(): any[] {
    if (!this.property.nodes) {
      return [];
    }
    
    // Get nodes with parentId
    const nodesWithParentId = this.property.nodes.filter(node => node.parentId === this.id);
    
    return nodesWithParentId;
  }
} 