// flowExecutorUtils.ts
// FlowExecutorPage 전용 유틸리티: flow json import, 그래프 구조 분석 등

import { Node, Edge } from '@xyflow/react';
import { NodeFactory } from '../../core/NodeFactory';
import { FlowData } from '../data/importExportUtils';
import { v4 as uuidv4 } from 'uuid';
import { useFlowExecutorStore } from '../../store/useFlowExecutorStore';

// 그래프 구조 분석 함수 (store에서 분리)
export function buildGraphStructure(
  nodes: Node[],
  edges: Edge[],
  nodeFactory: NodeFactory
) {
  const nodeMap: Record<string, any> = {};
  nodes.forEach(node => {
    nodeMap[node.id] = {
      id: node.id,
      type: node.type || '',
      data: node.data || {},
      position: node.position || { x: 0, y: 0 },
      parentId: node.parentId || null,
      isGroupNode: node.type === 'group',
      nodeInstance: undefined,
    };
  });
  const graphRelations: Record<string, { parents: string[]; childs: string[] }> = {};
  const nodeInstances: Record<string, any> = {};
  nodes.forEach(node => {
    graphRelations[node.id] = { parents: [], childs: [] };
    try {
      const nodeInstance = nodeFactory.create(
        node.id,
        node.type || '',
        node.data || {},
        undefined
      );
      nodeInstances[node.id] = nodeInstance;
      nodeMap[node.id].nodeInstance = nodeInstance;
    } catch (error) {
      console.error(`[flowExecutorUtils] Failed to create node instance for ${node.id}:`, error);
    }
  });
  const nodesInGroups = new Set<string>();
  nodes.forEach(node => {
    if (node.type === 'group' && Array.isArray(node.data?.nodeIds)) {
      node.data.nodeIds.forEach((childId: string) => {
        if (graphRelations[childId]) {
          graphRelations[node.id].childs.push(childId);
          graphRelations[childId].parents.push(node.id);
          nodesInGroups.add(childId);
        }
      });
    }
  });
  edges.forEach(edge => {
    if (edge.source && edge.target) {
      if (graphRelations[edge.source]) {
        graphRelations[edge.source].childs.push(edge.target);
      }
      if (graphRelations[edge.target]) {
        graphRelations[edge.target].parents.push(edge.source);
      }
    }
  });
  const roots = Object.keys(graphRelations).filter(nodeId =>
    !nodesInGroups.has(nodeId) && graphRelations[nodeId].parents.length === 0
  );
  const leafs = Object.keys(graphRelations).filter(nodeId =>
    !nodesInGroups.has(nodeId) && graphRelations[nodeId].childs.length === 0
  );
  return { nodeMap, graphRelations, nodeInstances, roots, leafs };
}

// Flow JSON을 store에 import하는 함수
export function importFlowJsonToStore(chainId: string, flowJson: FlowData) {
  const store = useFlowExecutorStore.getState();
  const nodeFactory = store.nodeFactory;
  const flowId: string = uuidv4();
  const { nodeMap, graphRelations, nodeInstances, roots, leafs } = buildGraphStructure(
    flowJson.nodes,
    flowJson.edges,
    nodeFactory
  );
  // store 액션을 통해 flow 추가
  store.addFlowToChain(chainId, {
    id: flowId,
    chainId,
    name: flowJson.name || `Flow-${flowId}`,
    flowJson,
    inputs: [],
    lastResults: null,
    status: 'idle',
    error: undefined,
    nodeMap,
    graphMap: graphRelations,
    nodeInstances,
    roots,
    leafs,
    nodeStates: {},
  });
  return flowId;
} 