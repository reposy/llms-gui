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
  const rootIds = Object.keys(graphRelations).filter(nodeId =>
    !nodesInGroups.has(nodeId) && graphRelations[nodeId].parents.length === 0
  );
  const leafIds = Object.keys(graphRelations).filter(nodeId =>
    !nodesInGroups.has(nodeId) && graphRelations[nodeId].childs.length === 0
  );
  return { nodeMap, graphRelations, nodeInstances, rootIds, leafIds };
}

// Flow JSON을 store에 import하는 함수
export function importFlowJsonToStore(flowChainId: string, flowJson: FlowData) {
  const store = useFlowExecutorStore.getState();
  const nodeFactory = store.nodeFactory;
  const flowId: string = uuidv4();
  const { nodeMap, graphRelations, nodeInstances, rootIds, leafIds } = buildGraphStructure(
    flowJson.nodes,
    flowJson.edges,
    nodeFactory
  );
  // store 액션을 통해 flow 추가
  store.addFlowToFlowChain(flowChainId, {
    id: flowId,
    flowChainId,
    name: flowJson.name || `Flow-${flowId}`,
    flowJson,
    inputs: [],
    lastResults: null,
    status: 'idle',
    error: undefined,
    nodeMap,
    graphMap: graphRelations,
    nodeInstances,
    rootIds,
    leafIds,
    nodeStates: {},
  });
  return flowId;
}

// FlowChain 전체를 Executor에 import (새 flowChainId, 새 flowId)
export function importFlowChainToExecutor(flowChainData: any) {
  const store = useFlowExecutorStore.getState();
  const newFlowChainId = `flowChain-${uuidv4()}`;
  const flowChainName = flowChainData.name || `FlowChain-${Date.now()}`;
  store.addFlowChain(flowChainName);

  (flowChainData.flowIds as string[]).forEach((oldFlowId: string) => {
    const flowData: FlowData = flowChainData.flowMap[oldFlowId];
    if (!flowData) return;
    const newFlowId = `flow-${uuidv4()}`;
    const nodeMap: Record<string, any> = {};
    (flowData.nodes || []).forEach((node: any) => {
      nodeMap[node.id] = {
        ...node,
        ...(flowChainData.contents?.[node.id] || {})
      };
    });
    const flowName = flowData.name || `Flow-${newFlowId}`;
    store.addFlowToFlowChain(newFlowChainId, {
      id: newFlowId,
      flowChainId: newFlowChainId,
      name: flowName,
      flowJson: flowData,
      nodeMap,
      inputs: [],
      lastResults: null,
      status: 'idle',
      error: undefined,
      graphMap: {},
      nodeInstances: {},
      rootIds: [],
      leafIds: [],
      nodeStates: {},
    });
  });
  return newFlowChainId;
}

// 단일 Flow를 Executor에 import (새 flowId)
export function importFlowToFlowChain(flowChainId: string, flowData: FlowData) {
  const store = useFlowExecutorStore.getState();
  const newFlowId = `flow-${uuidv4()}`;
  const nodeMap: Record<string, any> = {};
  (flowData.nodes || []).forEach((node: any) => {
    nodeMap[node.id] = {
      ...node,
      ...(flowData.contents?.[node.id] || {})
    };
  });
  const flowName = flowData.name || `Flow-${newFlowId}`;
  store.addFlowToFlowChain(flowChainId, {
    id: newFlowId,
    flowChainId,
    name: flowName,
    flowJson: flowData,
    nodeMap,
    inputs: [],
    lastResults: null,
    status: 'idle',
    error: undefined,
    graphMap: {},
    nodeInstances: {},
    rootIds: [],
    leafIds: [],
    nodeStates: {},
  });
  return newFlowId;
} 