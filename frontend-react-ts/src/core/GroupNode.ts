import { Node } from './Node';
import { FlowExecutionContext } from './FlowExecutionContext';
import { Node as FlowNode } from '@xyflow/react'; // Edge 타입은 직접 사용 안 할 수 있지만, FlowNode는 필요
import { GroupNodeContent } from '../types/nodes';

interface GroupNodeProperty {
  label: string;
  nodes?: any[]; // GroupNode 자체의 property에는 전체 노드/엣지 정보가 있을 수 있음 (초기 설정용)
  edges?: any[];
  nodeFactory?: any;
  // executionGraph?: any; // 내부 실행 그래프는 동적으로 생성
}

export class GroupNode extends Node {
  declare property: GroupNodeProperty;

  constructor(
    id: string, 
    property: Record<string, any> = {},
    context?: FlowExecutionContext
  ) {
    super(id, 'group', property);
    
    // 생성자에서 context를 명시적으로 설정 (NodeFactory에서 전달될 때 사용됨)
    if (context) {
      this.context = context;
    }
    
    this.property.label = property.label || 'Group';
  }

  private _findInternalLeafNodeIds(
    internalNodes: FlowNode[],
    internalExecutionGraph: Map<string, string[]>
  ): Set<string> {
    if (internalNodes.length === 0) {
      return new Set<string>();
    }
    const leafNodeIds = new Set<string>(
      internalNodes
        .map((n: FlowNode) => n.id)
        .filter((nodeId: string) => (internalExecutionGraph.get(nodeId) || []).length === 0)
    );
    this._log(`Identified ${leafNodeIds.size} internal leaf nodes: ${Array.from(leafNodeIds).join(', ')}`);
    return leafNodeIds;
  }

  private _prepareInternalExecution(): {
    internalNodes: FlowNode[];
    rootNodeIds: string[];
    internalLeafNodeIds: Set<string>;
  } | null {
    // 컨텍스트 유효성 검사 강화
    const currentContext = this.context;
    if (!currentContext || !currentContext.nodes || !currentContext.edges) {
      this._log('Context, context.nodes, or context.edges missing. Cannot prepare execution.');
      return null;
    }

    const { nodes: allNodesInContext, edges: allEdgesInContext } = currentContext;
    
    const internalNodes = allNodesInContext.filter((n: FlowNode) => n.parentId === this.id);
    if (internalNodes.length === 0) {
      this._log('No internal nodes found for this group.');
      return { internalNodes: [], rootNodeIds: [], internalLeafNodeIds: new Set<string>() };
    }
    const internalNodeIds = new Set(internalNodes.map((n: FlowNode) => n.id));
    
    const internalEdges = allEdgesInContext.filter(e => 
        internalNodeIds.has(e.source) && internalNodeIds.has(e.target)
    );
    this._log(`Prepared with ${internalNodes.length} internal nodes and ${internalEdges.length} internal edges.`);

    const executionGraph = this.buildExecutionGraph(internalNodes, internalEdges);
    const rootNodeIds = this.findRootNodes(executionGraph, internalNodes);
    this._log(`Found ${rootNodeIds.length} internal root nodes: ${rootNodeIds.join(', ')}`);

    const internalLeafNodeIds = this._findInternalLeafNodeIds(internalNodes, executionGraph);

    return { internalNodes, rootNodeIds, internalLeafNodeIds };
  }

  private async _executeInternalRootNodes(
    internalNodes: FlowNode[], 
    rootNodeIds: string[], 
    input: any,
    currentContext: FlowExecutionContext // 컨텍스트를 명시적으로 전달받도록 변경
  ): Promise<void> {
    if (!currentContext || !currentContext.nodeFactory) {
      this._log('Context or nodeFactory missing. Cannot execute internal root nodes.');
      return;
    }
    const { nodeFactory } = currentContext;

    const executionPromises = rootNodeIds.map(async (rootNodeId) => {
      const nodeData = internalNodes.find((n: FlowNode) => n.id === rootNodeId);
      if (!nodeData) {
        this._log(`Root node data for ${rootNodeId} not found. Skipping.`);
        return;
      }
      if (typeof nodeData.type !== 'string') {
          this._log(`Root node ${rootNodeId} has invalid or missing type: ${nodeData.type}. Skipping.`);
          return;
      }

      try {
          const rootNodeInstance = nodeFactory.create(
              nodeData.id,
              nodeData.type,
              nodeData.data,
              currentContext // 명시적으로 전달받은 컨텍스트 사용
          );
          this._log(`Processing internal root node ${rootNodeId} via its process method.`);
          await rootNodeInstance.process(input, currentContext); // 컨텍스트 명시적 전달
      } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          this._log(`Error processing internal root node ${rootNodeId}: ${errorMsg}`);
          if (currentContext) { // 명시적으로 전달받은 컨텍스트 사용
            currentContext.markNodeError(nodeData.id, `Error in group child: ${errorMsg}`);
          }
      }
    });

    await Promise.all(executionPromises);
    this._log('All internal root branches finished processing.');
  }

  private _collectLeafNodeResults(
    internalLeafNodeIds: Set<string>,
    currentContext: FlowExecutionContext // 컨텍스트를 명시적으로 전달받도록 변경
  ): any[] {
    if (!currentContext) {
      this._log('Context missing. Cannot collect leaf node results.');
      return [];
    }
    const collectedItems: any[] = [];
    for (const leafNodeId of internalLeafNodeIds) {
      const leafOutputs = currentContext.getOutput(leafNodeId);
      if (Array.isArray(leafOutputs) && leafOutputs.length > 0) {
        this._log(`Collecting ${leafOutputs.length} results for leaf node ${leafNodeId}`);
        collectedItems.push(...leafOutputs);
      } else if (leafOutputs !== undefined && !Array.isArray(leafOutputs) && leafOutputs !== null) { 
        this._log(`Collecting single result for leaf node ${leafNodeId}`);
        collectedItems.push(leafOutputs);
      } else {
        this._log(`No output collected or empty/null for leaf node ${leafNodeId}.`);
      }
    }
    return collectedItems;
  }

  /**
   * GroupNodeContent의 items 속성을 업데이트합니다.
   */
  private _updateContentItems(items: any[]): void {
    // zustand store 제거: core에서는 store 업데이트하지 않음. 필요시 context에서 처리.
  }

  async execute(input: any): Promise<any> {
    this._log('Executing group node');
    
    // 초기화: 빈 배열로 결과 초기화 (실행 시작 시점에 한번만)
    this._updateContentItems([]);
    
    const currentContext = this.context;
    
    if (!currentContext) {
      console.error(`[GroupNode:${this.id}] Critical: Execution context is missing. Cannot proceed.`);
      return null;
    }

    try {
      const prepResult = this._prepareInternalExecution();
      if (!prepResult) {
        currentContext.markNodeError(this.id, 'Group preparation failed');
        return null;
      }
      const { internalNodes, rootNodeIds, internalLeafNodeIds } = prepResult;

      if (rootNodeIds.length === 0 && (internalNodes.length === 0 || internalLeafNodeIds.size === 0)) {
        this._log('Group is empty or has no executable paths. Returning empty array.');
        this._updateContentItems([]); // 명시적으로 빈 배열 업데이트
        currentContext.markNodeSuccess(this.id, []);
        return [];
      }
      
      let processedInput = input;
      if (input === undefined || input === null) {
        this._log(`Group received undefined/null input.`);
        processedInput = undefined;
      }
      
      await this._executeInternalRootNodes(internalNodes, rootNodeIds, processedInput, currentContext);
      
      const finalResults = this._collectLeafNodeResults(internalLeafNodeIds, currentContext);
      
      // execute의 최종 반환값으로 NodeContent를 업데이트
      this._updateContentItems(finalResults);

      if (finalResults.length === 0) {
        this._log('No results collected. Group returns empty array.');
      } else {
        this._log(`Group finished. Returning ${finalResults.length} collected results.`);
      }
      
      currentContext.markNodeSuccess(this.id, finalResults);
      return finalResults;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this._log(`Critical error in group execution: ${errorMessage}`);
      if (currentContext) {
        currentContext.markNodeError(this.id, `Group execution failed: ${errorMessage}`);
      }
      this._updateContentItems([]); // 오류 발생 시 items를 빈 배열로 설정
      return null;
    }
  }

  private buildExecutionGraph(nodes: FlowNode[], edges: any[]): Map<string, string[]> {
    const graph = new Map<string, string[]>();
    const internalNodeIds = new Set(nodes.map(n => n.id));

    for (const node of nodes) {
      graph.set(node.id, []);
    }
    
    for (const edge of edges) {
      const sourceId = edge.source;
      const targetId = edge.target;
      
      if (internalNodeIds.has(sourceId) && internalNodeIds.has(targetId)) {
          const children = graph.get(sourceId)!;
          if (children) { 
            children.push(targetId);
          }
      } else {
          this._log(`Edge (${edge.id}) in buildExecutionGraph connects nodes outside the provided internal nodes list. Source: ${sourceId}, Target: ${targetId}. Skipping.`);
      }
    }
    return graph;
  }

  private findRootNodes(graph: Map<string, string[]>, nodes: FlowNode[]): string[] {
    const allNodeIds = new Set(nodes.map(n => n.id));
    const allChildren = new Set<string>();
    for (const children of graph.values()) {
        children.forEach(childId => allChildren.add(childId));
    }
    
    return nodes
        .map(n => n.id)
        .filter(nodeId => !allChildren.has(nodeId) && allNodeIds.has(nodeId));
  }
}