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
   * Execute logic for a group node by finding and executing root nodes within the group
   * @param input The input to process
   * @returns The processed result (array of leaf node results)
   */
  async execute(input: any): Promise<any> {
    this.context?.log(`${this.type}(${this.id}): Executing group node`);
    this.items = []; // 결과 배열 초기화

    try {
      // 그룹 내부 노드와 엣지 정보 가져오기 (전체 플로우 기준)
      const allNodes = this.property.nodes || [];
      const allEdges = this.property.edges || [];
      const nodeFactory = this.property.nodeFactory;

      if (!nodeFactory || allNodes.length === 0) {
        this.context?.log(`${this.type}(${this.id}): No node factory or nodes found within the group property. Cannot execute.`);
        return null;
      }

      // 그룹 내부에 속한 노드와 엣지만 필터링
      const internalNodes = allNodes.filter((n: any) => n.parentId === this.id);
      const internalNodeIds = new Set(internalNodes.map((n: any) => n.id));
      const internalEdges = allEdges.filter((e: any) => 
          internalNodeIds.has(e.source) && internalNodeIds.has(e.target)
      );
      this.context?.log(`${this.type}(${this.id}): Found ${internalNodes.length} internal nodes and ${internalEdges.length} internal edges.`);

      // 그룹 내 실행 그래프 구성 (내부 노드/엣지 기준)
      const executionGraph = this.buildExecutionGraph(internalNodes, internalEdges);
      
      // 루트 노드 찾기 (내부 노드/엣지 기준)
      const rootNodeIds = this.findRootNodes(executionGraph, internalNodes);
      this.context?.log(`${this.type}(${this.id}): Found ${rootNodeIds.length} root nodes within group: ${rootNodeIds.join(', ')}`);

      if (rootNodeIds.length === 0) {
        this.context?.log(`${this.type}(${this.id}): No root nodes found inside the group. Group execution stopped.`);
        return null; // 결과 없이 종료
      }

      // 실행된 노드 추적 (이 그룹 실행 범위 내에서만)
      const executedNodes = new Set<string>();

      // --- 모든 내부 루트 노드를 실행하고 모두 완료될 때까지 기다림 --- 
      const executionPromises = rootNodeIds.map(rootNodeId => {
          const nodeData = internalNodes.find((n: any) => n.id === rootNodeId);
          if (!nodeData) {
              this.context?.log(`${this.type}(${this.id}): Root node ${rootNodeId} data not found. Skipping.`);
              return Promise.resolve(); // 누락된 노드에 대해 Promise 완료 처리
          }
          // process를 사용하는 헬퍼 호출
          return this.executeNodeWithChaining(
              nodeData,
              input,
              executionGraph, 
              executedNodes,
              nodeFactory
          );
      });

      // 루트 노드에서 시작된 모든 브랜치가 완료될 때까지 대기
      await Promise.all(executionPromises);
      this.context?.log(`${this.type}(${this.id}): All internal root branches finished processing.`);
      // ------------------------------------------------------------------

      // --- 내부 리프 노드의 최종 결과 수집 --- 
      const internalLeafNodeIds = internalNodes
          .map((n: any) => n.id)
          .filter((nodeId: string) => (executionGraph.get(nodeId) || []).length === 0);
      this.context?.log(`${this.type}(${this.id}): Identified ${internalLeafNodeIds.length} internal leaf nodes: ${internalLeafNodeIds.join(', ')}`);

      this.items = []; // 최종 수집 전 배열 초기화
      for (const leafNodeId of internalLeafNodeIds) {
          // context.getOutput() 사용하여 결과 조회 (storeOutput에서 저장됨)
          const finalResult = this.context?.getOutput(leafNodeId);
          if (finalResult !== null && finalResult !== undefined) {
              this.items.push(finalResult);
          } else {
               // 결과가 없는 경우 로그 (선택 사항)
               this.context?.log(`${this.type}(${this.id}): Leaf node ${leafNodeId} had null or undefined result.`);
          }
      }
      // -------------------------------------------------------

      this.context?.log(`${this.type}(${this.id}): Finished executing group, collected ${this.items.length} results from leaf nodes.`);
      return this.items; // 최종 수집된 items 배열 반환

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.context?.log(`${this.type}(${this.id}): Error in group execution: ${errorMessage}`);
      this.context?.markNodeError(this.id, errorMessage);
      return null; // 오류 발생 시 null 반환
    }
  }

  /**
   * 그룹 내부 노드를 실행하고 결과/상태를 처리하는 (이제 process를 사용하는) 헬퍼 메서드
   */
  private async executeNodeWithChaining(
    nodeData: any,
    input: any,
    executionGraph: Map<string, string[]>, // 필요한 경우 컨텍스트 전달
    executedNodes: Set<string>,
    nodeFactory: any
  ): Promise<void> { // 결과를 반환할 필요 없음
    const nodeId = nodeData.id;

    // executedNodes를 사용하여 이 실행 범위 내 재실행 방지
    if (executedNodes.has(nodeId)) {
      return;
    }
    executedNodes.add(nodeId);

    // Context를 통해 노드 실행 중 상태 표시
    this.context?.markNodeRunning(nodeId);

    try {
        // 노드 인스턴스 생성
        const nodeInstance = nodeFactory.create(
            nodeData.id,
            nodeData.type as string,
            nodeData.data,
            this.context
        );

        // 필요한 속성(그래프 구조 등) 제공
        nodeInstance.property = {
            ...nodeInstance.property,
            nodes: this.property.nodes,
            edges: this.property.edges,
            nodeFactory: this.property.nodeFactory,
            executionGraph: executionGraph // 필요한 경우 그룹 내부 그래프 전달
        };

        this.context?.log(`${this.type}(${this.id}): Processing node ${nodeId} with input`);
        // 내부 실행을 위해 표준 process 사용
        await nodeInstance.process(input);

        // --- REMOVED: 결과 수집 로직은 execute() 끝으로 이동 --- 

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.context?.log(`${this.type}(${this.id}): Error processing node ${nodeId}: ${errorMessage}`);
        this.context?.markNodeError(nodeId, errorMessage);
        // 오류 발생 시 전체 그룹을 중단할지, 아니면 이 브랜치만 중단할지 결정
        // 현재는 다른 브랜치 실행 계속
    }
  }

  /**
   * 실행 그래프 구성 (노드 ID -> 자식 노드 ID 배열 맵핑)
   */
  private buildExecutionGraph(nodes: any[], edges: any[]): Map<string, string[]> {
    const graph = new Map<string, string[]>();
    
    // Use the provided (already filtered) nodes
    for (const node of nodes) {
      graph.set(node.id, []);
    }
    
    // Use the provided (already filtered) edges
    for (const edge of edges) {
      const sourceId = edge.source;
      const targetId = edge.target;
      
      // Nodes are already filtered, so just add the edge
      const children = graph.get(sourceId) || [];
      children.push(targetId);
      graph.set(sourceId, children);
    }
    
    return graph;
  }

  /**
   * 루트 노드 찾기 (주어진 노드 목록과 그래프 기준)
   */
  private findRootNodes(graph: Map<string, string[]>, nodes: any[]): string[] {
    const allChildren = new Set(Array.from(graph.values()).flat());
    return nodes.map(n => n.id).filter(nodeId => !allChildren.has(nodeId));
  }
}