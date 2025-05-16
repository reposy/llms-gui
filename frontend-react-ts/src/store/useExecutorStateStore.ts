import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Node, Edge } from '@xyflow/react';
import { type FlowData } from '../utils/data/importExportUtils';
export type { FlowData } from '../utils/data/importExportUtils';
import { deepClone } from '../utils/helpers';
import { v4 as uuidv4 } from 'uuid';
import { NodeFactory } from '../core/NodeFactory';
import { Node as BaseNode } from '../core/Node';
import { GroupNode } from '../core/GroupNode';

export type ExecutorStage = 'upload' | 'input' | 'executing' | 'result';

// 그래프 노드 관계 정보
interface NodeRelation {
  parents: string[];  // 부모 노드 ID 목록
  childs: string[];   // 자식 노드 ID 목록
}

// 그래프 노드 정보
interface GraphNode {
  id: string;
  type: string;
  data: any;
  position: { x: number, y: number };
  parentNodeId: string | null;
  nodeInstance?: BaseNode;
  isGroupNode: boolean;
}

// Flow 하나의 정보 (그래프 정보 포함)
export interface Flow {
  id: string;
  name: string;
  flowJson: FlowData;
  inputs: any[];
  lastResults: any[] | null;
  status: 'idle' | 'running' | 'success' | 'error';
  error?: string;
  
  // 그래프 구조 정보
  nodes: Record<string, GraphNode>;
  graph: Record<string, NodeRelation>;
  nodeInstances: Record<string, BaseNode>;
  roots: string[];
  leafs: string[];
}

// Flow Chain의 정보
export interface FlowChain {
  id: string;
  name: string;
  status: 'idle' | 'running' | 'success' | 'error';
  selectedFlowId: string | null;  // 체이닝에 사용될 Flow의 ID
  flowMap: Record<string, Flow>; // 기존 flows를 flowMap으로 변경
  flowIds: string[];  // 실행 순서
  error?: string;
}

// 전체 FlowExecutorStore 객체
export interface FlowExecutorStore {
  flowChainMap: Record<string, FlowChain>; // 기존 chains를 flowChainMap으로 변경
  chainIds: string[];  // 순서 유지
  activeChainId: string | null;
  stage: ExecutorStage;
  error: string | null;
  nodeFactory: NodeFactory; // 그래프 노드 생성 팩토리
}

interface ExecutorState {
  flowExecutorStore: FlowExecutorStore; // 전체 상태를 flowExecutorStore로 변경

  // Flow Chain 관련 액션
  addFlowChain: (name: string) => string; // 생성된 chain-id 반환
  removeFlowChain: (id: string) => void;
  setFlowChainName: (id: string, name: string) => void;
  addFlowToChain: (chainId: string, flowJson: FlowData) => string; // 생성된 flow-id 반환
  removeFlowFromChain: (chainId: string, flowId: string) => void;
  setFlowChainStatus: (chainId: string, status: FlowChain['status'], error?: string) => void;
  setFlowStatus: (chainId: string, flowId: string, status: Flow['status'], error?: string) => void;
  setSelectedFlow: (chainId: string, flowId: string | null) => void;
  moveFlow: (chainId: string, flowId: string, direction: 'up' | 'down') => void;
  setFlowInputs: (chainId: string, flowId: string, inputs: any[]) => void;
  setFlowResults: (chainId: string, flowId: string, results: any[]) => void;
  setActiveChainId: (id: string | null) => void;
  
  // 상태 관리
  setStage: (stage: ExecutorStage) => void;
  setError: (error: string | null) => void;
  resetState: () => void;
  
  // 편의 함수
  getFlow: (chainId: string, flowId: string) => Flow | undefined;
  getFlowChain: (chainId: string) => FlowChain | undefined;
  getActiveFlowChain: () => FlowChain | undefined;
  ensureChainExists: (chainId: string) => void;
  
  // 그래프 데이터 접근 함수 (그래프 스토어에서 이전)
  getRootNodes: (chainId: string, flowId: string) => string[];
  getLeafNodes: (chainId: string, flowId: string) => string[];
  getNodeInstance: (chainId: string, flowId: string, nodeId: string) => BaseNode | null;
}

/**
 * 그래프 구조 분석 함수 - 부모/자식 관계 및 루트/리프 노드 식별
 */
const buildGraphStructure = (nodes: Node[], edges: Edge[], nodeFactory: NodeFactory): {
  nodeMap: Record<string, GraphNode>;
  graphRelations: Record<string, NodeRelation>;
  nodeInstances: Record<string, BaseNode>;
  roots: string[];
  leafs: string[];
} => {
  // 1. 노드 맵 생성
  const nodeMap: Record<string, GraphNode> = {};
  nodes.forEach(node => {
    nodeMap[node.id] = {
      id: node.id,
      type: node.type || '',
      data: node.data || {},
      position: node.position || { x: 0, y: 0 },
      parentNodeId: node.parentId || null,
      isGroupNode: node.type === 'group'
    };
  });
  
  // 2. 그래프 관계 구조 초기화
  const graphRelations: Record<string, NodeRelation> = {};
  const nodeInstances: Record<string, BaseNode> = {};
  
  // 모든 노드에 대해 관계 구조 생성
  nodes.forEach(node => {
    graphRelations[node.id] = {
      parents: [],
      childs: []
    };
    
    // 노드 인스턴스 생성
    try {
      const nodeInstance = nodeFactory.create(
        node.id,
        node.type || '',
        node.data || {},
        undefined // 컨텍스트는 실행 시점에 주입
      );
      
      nodeInstances[node.id] = nodeInstance;
      nodeMap[node.id].nodeInstance = nodeInstance;
    } catch (error) {
      console.error(`[ExecutorStateStore] Failed to create node instance for ${node.id}:`, error);
    }
  });
  
  // 3. 그룹 노드 및 내부 노드 관계 설정
  const nodesInGroups = new Set<string>();
  nodes.forEach(node => {
    if (node.type === 'group' && node.data?.nodeIds && Array.isArray(node.data.nodeIds)) {
      node.data.nodeIds.forEach((childId: string) => {
        if (graphRelations[childId]) {
          graphRelations[node.id].childs.push(childId);
          graphRelations[childId].parents.push(node.id);
          nodesInGroups.add(childId);
        }
      });
    }
  });
  
  // 4. 엣지 기반 부모-자식 관계 설정
  edges.forEach(edge => {
    if (edge.source && edge.target) {
      // 소스 노드에 자식 추가
      if (graphRelations[edge.source]) {
        graphRelations[edge.source].childs.push(edge.target);
      }
      
      // 타겟 노드에 부모 추가
      if (graphRelations[edge.target]) {
        graphRelations[edge.target].parents.push(edge.source);
      }
    }
  });
  
  // 5. 루트 노드 식별 (부모가 없는 노드)
  const roots = Object.keys(graphRelations).filter(nodeId => 
    !nodesInGroups.has(nodeId) && graphRelations[nodeId].parents.length === 0
  );
  
  // 6. 리프 노드 식별 (자식이 없는 노드)
  const leafs = Object.keys(graphRelations).filter(nodeId => 
    !nodesInGroups.has(nodeId) && graphRelations[nodeId].childs.length === 0
  );
  
  return {
    nodeMap,
    graphRelations,
    nodeInstances,
    roots,
    leafs
  };
};

const initialState: FlowExecutorStore = {
  flowChainMap: {},
  chainIds: [],
  activeChainId: null,
  stage: 'upload',
  error: null,
  nodeFactory: new NodeFactory()
};

export const useExecutorStateStore = create<ExecutorState>()(
  persist(
    (set, get) => ({
      flowExecutorStore: initialState,

      // Flow Chain 관련 액션
      addFlowChain: (name) => {
        const id = `chain-${uuidv4()}`;
        set((state) => {
          return {
            flowExecutorStore: {
              ...state.flowExecutorStore,
              flowChainMap: {
                ...state.flowExecutorStore.flowChainMap,
                [id]: {
                  id,
                  name,
                  status: 'idle',
                  selectedFlowId: null,
                  flowMap: {},
                  flowIds: [],
                  error: undefined
                }
              },
              chainIds: [...state.flowExecutorStore.chainIds, id],
              activeChainId: state.flowExecutorStore.activeChainId || id
            }
          };
        });
        return id;
      },

      removeFlowChain: (id) => set((state) => {
        const { [id]: removed, ...remainingChains } = state.flowExecutorStore.flowChainMap;
        const newChainIds = state.flowExecutorStore.chainIds.filter(chainId => chainId !== id);
        
        // activeChainId 조정
        let newActiveChainId = state.flowExecutorStore.activeChainId;
        if (newActiveChainId === id) {
          newActiveChainId = newChainIds.length > 0 ? newChainIds[0] : null;
        }

        return {
          flowExecutorStore: {
            ...state.flowExecutorStore,
            flowChainMap: remainingChains,
            chainIds: newChainIds,
            activeChainId: newActiveChainId
          }
        };
      }),

      setFlowChainName: (id, name) => set((state) => ({
        flowExecutorStore: {
          ...state.flowExecutorStore,
          flowChainMap: {
            ...state.flowExecutorStore.flowChainMap,
            [id]: {
              ...state.flowExecutorStore.flowChainMap[id],
              name
            }
          }
        }
      })),

      addFlowToChain: (chainId, flowJson: FlowData) => {
        const flowId = `flow-${uuidv4()}`;
        set((state) => {
          const chain = state.flowExecutorStore.flowChainMap[chainId];
          if (!chain) return state;

          // 그래프 구조 생성
          const { nodeMap, graphRelations, nodeInstances, roots, leafs } = buildGraphStructure(
            flowJson.nodes || [],
            flowJson.edges || [],
            state.flowExecutorStore.nodeFactory
          );

          const newFlow: Flow = {
            id: flowId,
            name: flowJson.name || `Flow ${Object.keys(chain.flowMap).length + 1}`,
            flowJson: deepClone(flowJson),
            inputs: [],
            lastResults: null,
            status: 'idle',
            // 그래프 정보 추가
            nodes: nodeMap,
            graph: graphRelations,
            nodeInstances,
            roots,
            leafs
          };

          console.log(`[ExecutorStateStore] Added flow to chain: chainId=${chainId}, flowId=${flowId}`);

          return {
            flowExecutorStore: {
              ...state.flowExecutorStore,
              flowChainMap: {
                ...state.flowExecutorStore.flowChainMap,
                [chainId]: {
                  ...chain,
                  flowMap: {
                    ...chain.flowMap,
                    [flowId]: newFlow
                  },
                  flowIds: [...chain.flowIds, flowId]
                }
              }
            }
          };
        });
        return flowId;
      },

      removeFlowFromChain: (chainId, flowId) => set((state) => {
        const chain = state.flowExecutorStore.flowChainMap[chainId];
        if (!chain) return state;

        const { [flowId]: removed, ...remainingFlows } = chain.flowMap;
        return {
          flowExecutorStore: {
            ...state.flowExecutorStore,
            flowChainMap: {
              ...state.flowExecutorStore.flowChainMap,
              [chainId]: {
                ...chain,
                flowMap: remainingFlows,
                flowIds: chain.flowIds.filter(id => id !== flowId),
                selectedFlowId: chain.selectedFlowId === flowId ? null : chain.selectedFlowId
              }
            }
          }
        };
      }),

      setFlowChainStatus: (chainId, status, error) => set((state) => ({
        flowExecutorStore: {
          ...state.flowExecutorStore,
          flowChainMap: {
            ...state.flowExecutorStore.flowChainMap,
            [chainId]: {
              ...state.flowExecutorStore.flowChainMap[chainId],
              status,
              error: status === 'error' ? error : undefined
            }
          }
        }
      })),

      setFlowStatus: (chainId, flowId, status, error) => set((state) => {
        const chain = state.flowExecutorStore.flowChainMap[chainId];
        if (!chain) return state;

        return {
          flowExecutorStore: {
            ...state.flowExecutorStore,
            flowChainMap: {
              ...state.flowExecutorStore.flowChainMap,
              [chainId]: {
                ...chain,
                flowMap: {
                  ...chain.flowMap,
                  [flowId]: {
                    ...chain.flowMap[flowId],
                    status,
                    error: status === 'error' ? error : undefined
                  }
                }
              }
            }
          }
        };
      }),

      setSelectedFlow: (chainId, flowId) => set((state) => ({
        flowExecutorStore: {
          ...state.flowExecutorStore,
          flowChainMap: {
            ...state.flowExecutorStore.flowChainMap,
            [chainId]: {
              ...state.flowExecutorStore.flowChainMap[chainId],
              selectedFlowId: flowId
            }
          }
        }
      })),

      moveFlow: (chainId, flowId, direction) => set((state) => {
        const chain = state.flowExecutorStore.flowChainMap[chainId];
        if (!chain) return state;

        const currentIndex = chain.flowIds.indexOf(flowId);
        if (currentIndex === -1) return state;

        const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        if (newIndex < 0 || newIndex >= chain.flowIds.length) return state;

        const newFlowIds = [...chain.flowIds];
        [newFlowIds[currentIndex], newFlowIds[newIndex]] = [newFlowIds[newIndex], newFlowIds[currentIndex]];

        return {
          flowExecutorStore: {
            ...state.flowExecutorStore,
            flowChainMap: {
              ...state.flowExecutorStore.flowChainMap,
              [chainId]: {
                ...chain,
                flowIds: newFlowIds
              }
            }
          }
        };
      }),

      setFlowInputs: (chainId, flowId, inputs) => set((state) => {
        const chain = state.flowExecutorStore.flowChainMap[chainId];
        if (!chain) return state;

        return {
          flowExecutorStore: {
            ...state.flowExecutorStore,
            flowChainMap: {
              ...state.flowExecutorStore.flowChainMap,
              [chainId]: {
                ...chain,
                flowMap: {
                  ...chain.flowMap,
                  [flowId]: {
                    ...chain.flowMap[flowId],
                    inputs
                  }
                }
              }
            }
          }
        };
      }),

      setFlowResults: (chainId, flowId, results) => set((state) => {
        const chain = state.flowExecutorStore.flowChainMap[chainId];
        if (!chain) return state;

        return {
          flowExecutorStore: {
            ...state.flowExecutorStore,
            flowChainMap: {
              ...state.flowExecutorStore.flowChainMap,
              [chainId]: {
                ...chain,
                flowMap: {
                  ...chain.flowMap,
                  [flowId]: {
                    ...chain.flowMap[flowId],
                    lastResults: results
                  }
                }
              }
            }
          }
        };
      }),

      setActiveChainId: (id) => set((state) => ({
        flowExecutorStore: {
          ...state.flowExecutorStore,
          activeChainId: id,
        }
      })),

      // 상태 관리
      setStage: (stage) => set((state) => ({
        flowExecutorStore: {
          ...state.flowExecutorStore,
          stage
        }
      })),
      
      setError: (error) => set((state) => ({
        flowExecutorStore: {
          ...state.flowExecutorStore,
          error
        }
      })),
      
      resetState: () => {
        set({ flowExecutorStore: initialState });
      },

      // 편의 함수 및 유틸리티
      ensureChainExists: (chainId: string) => {
        const state = get();
        const chain = state.flowExecutorStore.flowChainMap[chainId];
        
        if (!chain) {
          console.log(`[ExecutorStateStore] Chain ${chainId} does not exist, creating it`);
          state.addFlowChain(`Chain ${state.flowExecutorStore.chainIds.length + 1}`);
        }
      },

      // 편의 함수
      getFlow: (chainId, flowId) => {
        const chain = get().flowExecutorStore.flowChainMap[chainId];
        return chain?.flowMap[flowId];
      },

      getFlowChain: (chainId) => {
        const state = get();
        if (!state.flowExecutorStore || !state.flowExecutorStore.flowChainMap) {
          console.warn(`[ExecutorStateStore] Cannot find flowChainMap in state`);
          return undefined;
        }
        
        const chain = state.flowExecutorStore.flowChainMap[chainId];
        if (!chain) {
          console.warn(`[ExecutorStateStore] Chain ${chainId} not found in flowExecutorStore.flowChainMap`);
          return undefined;
        }
        
        return chain;
      },

      getActiveFlowChain: () => {
        const { flowExecutorStore } = get();
        return flowExecutorStore.activeChainId ? flowExecutorStore.flowChainMap[flowExecutorStore.activeChainId] : undefined;
      },

      // 그래프 데이터 접근 함수 (useExecutorGraphStore에서 이전)
      getRootNodes: (chainId, flowId) => {
        const flow = get().getFlow(chainId, flowId);
        return flow ? flow.roots : [];
      },
      
      getLeafNodes: (chainId, flowId) => {
        const flow = get().getFlow(chainId, flowId);
        return flow ? flow.leafs : [];
      },
      
      getNodeInstance: (chainId, flowId, nodeId) => {
        const flow = get().getFlow(chainId, flowId);
        return flow && flow.nodeInstances && flow.nodeInstances[nodeId] ? flow.nodeInstances[nodeId] : null;
      }
    }),
    {
      name: 'flow-executor-storage',
      partialize: (state) => ({
        flowExecutorStore: state.flowExecutorStore
      })
    }
  )
); 