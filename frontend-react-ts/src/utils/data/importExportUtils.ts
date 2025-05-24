import { Node, Edge } from '@xyflow/react';
import { cloneDeep } from 'lodash';
import { NodeData, NodeType } from '../../types/nodes';
import { loadFromImportedContents, getAllNodeContents } from '../../store/useNodeContentStore';
import { setNodes, setEdges, useFlowStructureStore } from '../../store/useFlowStructureStore';
import { useExecutorStateStore } from '../../store/useExecutorStateStore';

// NodeContent 타입 정의
export interface NodeContent {
  content?: any;
  responseContent?: any;
  [key: string]: any;
}

export interface FlowData {
  name?: string;
  createdAt?: string;
  nodes: Node<NodeData>[];
  edges: Edge[];
  contents?: Record<string, NodeContent>;
  meta?: {
    llmDefaults?: {
      provider: string;
      url: string;
    };
  };
}

/**
 * Validates if a node type is a supported type in the application
 */
function isSupportedNodeType(type: string): boolean {
  // List of currently supported node types
  const supportedTypes: NodeType[] = [
    'llm', 
    'api', 
    'output', 
    'input', 
    'group', 
    'conditional', 
    'merger',
    'json-extractor'
  ];
  
  return supportedTypes.includes(type as NodeType);
}

/**
 * Imports flow data from a JSON structure into the application state.
 * 
 * @param flowData The flow data object containing nodes, edges, and node contents
 * @returns An object containing the imported nodes and edges
 */
export function importFlowFromJson(flowData: FlowData): { nodes: Node<NodeData>[]; edges: Edge[] } {
  // Validate flow data
  if (!flowData) {
    throw new Error('Invalid flow data: Flow data is null or undefined');
  }

  if (!Array.isArray(flowData.nodes)) {
    throw new Error('Invalid flow data: Nodes array is missing or not an array');
  }

  if (!Array.isArray(flowData.edges)) {
    throw new Error('Invalid flow data: Edges array is missing or not an array');
  }

  console.log('[importFlowFromJson] Processing flow data:', { 
    nodeCount: flowData.nodes.length,
    edgeCount: flowData.edges.length,
    hasContents: !!flowData.contents,
    flowName: flowData.name
  });

  // Process and validate nodes
  const importedNodes: Node<NodeData>[] = flowData.nodes.map(node => {
    const importedNode = cloneDeep(node);
    
    // Validate node has a type
    if (!importedNode.type) {
      console.warn(`[importFlowFromJson] Node ${importedNode.id} is missing a type. Defaulting to 'output'.`);
      importedNode.type = 'output';
    } else if (!isSupportedNodeType(importedNode.type)) {
      console.warn(`[importFlowFromJson] Node ${importedNode.id} has unsupported type: ${importedNode.type}. This may cause issues.`);
    }
    
    // Fix missing properties based on node type
    if (importedNode.type === 'group' && !importedNode.dragHandle) {
      console.warn(`[importFlowFromJson] Adding missing dragHandle to group node ${importedNode.id}`);
      importedNode.dragHandle = '.group-node-header';
    }

    // Ensure node has required fields
    if (!importedNode.id) {
      console.error(`[importFlowFromJson] Node is missing an ID. This will cause errors.`);
      importedNode.id = `generated-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    }

    if (!importedNode.position || typeof importedNode.position.x !== 'number' || typeof importedNode.position.y !== 'number') {
      console.warn(`[importFlowFromJson] Node ${importedNode.id} has invalid position. Setting default position.`);
      importedNode.position = { x: 100, y: 100 };
    }

    // Ensure data object exists
    if (!importedNode.data) {
      console.warn(`[importFlowFromJson] Node ${importedNode.id} is missing data. Initializing empty data object.`);
      // Create a basic data object with just the type
      importedNode.data = { type: importedNode.type || 'output' } as NodeData;
    }
    
    // Set default data properties based on node type if missing
    if (importedNode.type === 'llm') {
      // Cast to the correct type and set defaults only if it is an LLM node
      const llmData = importedNode.data as any;
      if (!llmData.model) {
        llmData.model = 'llama3';
      }
    }
    
    // Add any other required properties
    if (!importedNode.width) importedNode.width = 200;
    if (!importedNode.height) importedNode.height = 150;
    
    return importedNode;
  });

  // Process edges
  const importedEdges: Edge[] = flowData.edges.map(edge => {
    const importedEdge = cloneDeep(edge);
    
    // Validate edge has source and target
    if (!importedEdge.source || !importedEdge.target) {
      console.warn(`[importFlowFromJson] Edge ${importedEdge.id} is missing source or target.`);
    }
    
    // Ensure edge has an ID
    if (!importedEdge.id) {
      importedEdge.id = `edge-${importedEdge.source}-${importedEdge.target}-${Date.now()}`;
    }
    
    return importedEdge;
  });

  // Validate edge connectivity - filter out edges pointing to non-existent nodes
  const validNodeIds = new Set(importedNodes.map(node => node.id));
  const validatedEdges = importedEdges.filter(edge => {
    const isValid = validNodeIds.has(edge.source) && validNodeIds.has(edge.target);
    if (!isValid) {
      console.warn(`[importFlowFromJson] Removing edge ${edge.id} because source or target node doesn't exist`);
    }
    return isValid;
  });

  // Update Zustand stores
  setNodes(importedNodes);
  setEdges(validatedEdges);
  console.log('[importFlowFromJson] Updated flow structure with nodes and edges');

  // Process node contents if available
  if (flowData.contents) {
    // Verify content is for valid nodes
    const validContents: Record<string, NodeContent> = {};
    
    Object.entries(flowData.contents).forEach(([nodeId, content]) => {
      const node = importedNodes.find(n => n.id === nodeId);
      if (node) {
        console.log(`[importFlowFromJson] Loading stored content for node ${nodeId} (${node.type})`);
        validContents[nodeId] = content;
      } else {
        console.warn(`[importFlowFromJson] Content found for node ${nodeId}, but node doesn't exist in nodes array. Skipping.`);
      }
    });
    
    // Load contents to store
    loadFromImportedContents(validContents);
    console.log('[importFlowFromJson] Loaded node contents from imported flow data');
  } else {
    console.warn('[importFlowFromJson] No node contents in imported flow data');
  }

  return { 
    nodes: importedNodes, 
    edges: validatedEdges 
  };
}

/**
 * Exports the current flow state as a JSON-serializable object
 * @param includeExecutionData If true, includes 'responseContent' and 'content' fields.
 * @returns The complete flow data object with nodes, edges, and contents (conditionally filtered)
 */
export const exportFlowAsJson = (includeExecutionData: boolean = false): FlowData => {
  // Get the nodes and edges from the Zustand store
  const nodesFromStructureStore = useFlowStructureStore.getState().nodes;
  const edges = useFlowStructureStore.getState().edges;
  
  // Get the node contents from the Zustand store
  const nodeContents = getAllNodeContents();

  let finalNodes = nodesFromStructureStore;
  let finalContents = nodeContents;

  // If execution data should NOT be included, filter it out
  if (!includeExecutionData) {
    // Filter contents
    const contentsToExport: Record<string, Partial<NodeContent>> = {};
    for (const nodeId in nodeContents) {
      if (Object.prototype.hasOwnProperty.call(nodeContents, nodeId)) {
        const originalContent = nodeContents[nodeId];
        const contentToSave = { ...originalContent };
        if ('responseContent' in contentToSave) {
          delete contentToSave.responseContent;
        }
        if ('content' in contentToSave) {
          delete contentToSave.content;
        }
        contentsToExport[nodeId] = contentToSave;
      }
    }
    finalContents = contentsToExport;

    // Filter node data within nodes array
    finalNodes = nodesFromStructureStore.map(node => {
      const { data, ...restNode } = node;
      const dataToSave = { ...data };
      if ('responseContent' in dataToSave) {
        delete dataToSave.responseContent;
      }
      if ('content' in dataToSave) {
        delete dataToSave.content;
      }
      return {
        ...restNode,
        data: dataToSave, 
      };
    });
  }

  // Combine everything into a single flow object
  const flowData: FlowData = {
    name: `Flow ${new Date().toLocaleString()}`,
    createdAt: new Date().toISOString(),
    nodes: finalNodes, // Use potentially filtered nodes
    edges,
    contents: finalContents, // Use potentially filtered contents
    meta: {
      llmDefaults: {
        provider: 'ollama',
        url: 'http://localhost:11434'
      }
    }
  };

  console.log(`[exportFlowAsJson] Created flow data (includeExecutionData: ${includeExecutionData}) with:`, {
    nodes: finalNodes.length,
    edges: edges.length,
    nodeContents: Object.keys(finalContents).length
  });

  return flowData;
};

/**
 * Flow Chain 데이터를 JSON 형식으로 내보냅니다.
 * @param chainId 내보낼 Flow Chain의 ID
 * @param includeExecutionData 실행 데이터 포함 여부
 * @returns 내보낼 Flow Chain 데이터 객체
 */
export interface FlowChainData {
  id: string;
  name: string;
  createdAt: string;
  flowIds: string[];
  flowMap: Record<string, FlowData>;
  selectedFlowId: string | null;
}

export const exportFlowChainAsJson = (chainId: string, includeExecutionData: boolean = false): FlowChainData | null => {
  const storeState = useExecutorStateStore.getState();
  const chain = storeState.getFlowChain(chainId);
  
  if (!chain) {
    console.error(`[exportFlowChainAsJson] Chain with ID ${chainId} not found`);
    return null;
  }
  
  // Flow 데이터 준비
  const flowMap: Record<string, FlowData> = {};
  
  for (const flowId of chain.flowIds) {
    const flow = chain.flowMap[flowId];
    if (!flow) continue;
    
    // nodes 변환 시 타입 정의
    const nodes: Node<NodeData>[] = Object.values(flow.nodes || {}).map(node => ({
      id: node.id,
      type: node.type,
      data: {
        ...node.data,
        ...(node.type === 'llm' && !node.data?.provider ? { provider: 'openai', model: 'gpt-3.5-turbo' } : {})
      },
      position: node.position,
      parentId: node.parentNodeId || undefined // null 대신 undefined 사용
    }));
    
    // edges 변환
    const edges: Edge[] = Object.keys(flow.graph || {}).flatMap(nodeId => {
      const relation = flow.graph[nodeId];
      return relation.childs.map(childId => ({
        id: `edge-${nodeId}-${childId}`,
        source: nodeId,
        target: childId
      }));
    });
    
    const flowData: FlowData = {
      name: flow.name,
      createdAt: new Date().toISOString(), // 현재 시간으로 설정
      nodes,
      edges
    };
    
    flowMap[flowId] = flowData;
  }
  
  const chainData: FlowChainData = {
    id: chain.id,
    name: chain.name,
    createdAt: new Date().toISOString(), // 현재 시간으로 설정
    flowIds: chain.flowIds,
    flowMap: flowMap,
    selectedFlowId: chain.selectedFlowId
  };
  
  return chainData;
};

/**
 * Flow Chain 데이터를 JSON 파일로 내보냅니다.
 * @param chainId 내보낼 Flow Chain의 ID
 * @param includeExecutionData 실행 데이터 포함 여부
 */
export const downloadFlowChainAsJson = (chainId: string, includeExecutionData: boolean = false): void => {
  const chainData = exportFlowChainAsJson(chainId, includeExecutionData);
  
  if (!chainData) {
    console.error('[downloadFlowChainAsJson] Failed to export chain data');
    return;
  }
  
  // Chain 이름 가져오기
  const chainName = chainData.name || 'flow-chain';
  
  // 다운로드할 파일 이름 생성
  const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
  const fileName = `${chainName.replace(/\s+/g, '-').toLowerCase()}-${timestamp}.json`;
  
  // JSON 변환 및 데이터 URL 생성
  const jsonString = JSON.stringify(chainData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  // 다운로드 링크 생성 및 클릭
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  
  // 리소스 정리
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 100);
};

// Flow Chain 데이터를 가져오는 함수
export const importFlowChainFromJson = (chainData: FlowChainData): string | null => {
  try {
    const storeState = useExecutorStateStore.getState();
    
    // 새 Chain 생성
    const newChainId = storeState.addFlowChain(chainData.name);
    
    console.log(`[importFlowChainFromJson] Created new chain: ${newChainId}`);
    
    // Flow들을 순차적으로 가져오기
    // nodeFactory 오류 회피를 위해 setTimeout으로 비동기 처리
    setTimeout(() => {
      try {
        // Flow들을 Chain에 추가
        for (const flowId of chainData.flowIds) {
          const flowData = chainData.flowMap[flowId];
          if (!flowData) continue;
          
          // 노드 데이터 정리를 통해 타입 문제 회피
          const cleanedFlowData = {
            ...flowData,
            nodes: flowData.nodes.map(node => ({
              id: node.id,
              type: node.type,
              position: node.position,
              data: {
                ...node.data,
                ...(node.type === 'llm' && !node.data?.provider ? { provider: 'openai', model: 'gpt-3.5-turbo' } : {})
              }
            }))
          } as FlowData;
          
          // Flow Chain에 추가
          storeState.addFlowToFlowChain(newChainId, cleanedFlowData);
        }
        
        // 선택된 Flow 설정
        if (chainData.selectedFlowId) {
          storeState.setSelectedFlow(newChainId, chainData.selectedFlowId);
        }
        
        console.log(`[importFlowChainFromJson] Added ${chainData.flowIds.length} flows to chain ${newChainId}`);
      } catch (error) {
        console.error('[importFlowChainFromJson] Error adding flows to chain:', error);
      }
    }, 100);
    
    return newChainId;
  } catch (error) {
    console.error('[importFlowChainFromJson] Error importing flow chain:', error);
    return null;
  }
}; 