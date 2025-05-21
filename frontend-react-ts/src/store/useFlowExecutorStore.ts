import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { Node, Edge } from '@xyflow/react';
import { deepClone } from '../utils/helpers';
import { type FlowData } from '../utils/data/importExportUtils';
import { NodeFactory } from '../core/NodeFactory';
import { Node as BaseNode } from '../core/Node';

// 실행 상태 타입
export type ExecutionStatus = 'idle' | 'running' | 'success' | 'error';

// 실행기 단계
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
  parentId: string | null;
  isGroupNode: boolean;
  nodeInstance?: BaseNode;
}

// Flow 내 개별 노드의 실행 상태
export interface FlowNodeExecutionState {
  status: ExecutionStatus;
  result?: any;
  error?: string;
}

// Flow 하나의 정보 (그래프 정보 포함)
export interface Flow {
  id: string;
  chainId: string; // Flow가 속한 Chain ID
  name: string;
  flowJson: FlowData;
  inputs: any[];
  lastResults: any[] | null;
  status: ExecutionStatus;
  error?: string;
  // 그래프 구조 정보
  nodeMap: Record<string, GraphNode>;
  graphMap: Record<string, NodeRelation>;
  nodeInstances: Record<string, BaseNode>;
  roots: string[];
  leafs: string[];
  nodeStates: Record<string, FlowNodeExecutionState>; // Executor에서 실행 시 각 노드의 상태
}

// Flow Chain의 정보
export interface FlowChain {
  id: string;
  name: string;
  status: ExecutionStatus;
  selectedFlowId: string | null;  // 현재 선택된 Flow의 ID
  flowIds: string[];  // 실행 순서
  flowMap: Record<string, Flow>; // flowMap 추가
  error?: string;
  inputs?: any[]; // Flow Chain 전체의 입력
}

// 정규화된 스토어 상태
interface FlowExecutorState {
  chains: Record<string, FlowChain>;
  chainIds: string[];  // Chain 순서 유지
  focusedFlowChainId: string | null;
  stage: ExecutorStage;
  error: string | null;
  nodeFactory: NodeFactory; // 그래프 노드 생성 팩토리

  // Flow Chain 관련 액션
  addChain: (name: string) => string; // 생성된 chain-id 반환
  removeChain: (chainId: string) => void;
  setChainName: (chainId: string, name: string) => void;
  setChainStatus: (chainId: string, status: ExecutionStatus, error?: string) => void;
  setSelectedFlow: (chainId: string, flowId: string | null) => void;
  setFocusedFlowChainId: (id: string | null) => void;
  
  // Flow 관련 액션
  addFlowToChain: (chainId: string, flowData: FlowData) => string; // 생성된 flow-id 반환
  removeFlowFromChain: (chainId: string, flowId: string) => void;
  setFlowStatus: (chainId: string, flowId: string, status: ExecutionStatus, error?: string) => void;
  setFlowInputData: (chainId: string, flowId: string, inputs: any[]) => void;
  setFlowResult: (chainId: string, flowId: string, results: any[]) => void;
  moveFlow: (chainId: string, flowId: string, direction: 'up' | 'down') => void;
  
  // 노드 상태 관련 액션
  setFlowNodeState: (chainId: string, flowId: string, nodeId: string, nodeState: FlowNodeExecutionState) => void;
  getFlowNodeState: (chainId: string, flowId: string, nodeId: string) => FlowNodeExecutionState | undefined;
  
  // 그래프 데이터 접근 함수
  getRootNodes: (chainId: string, flowId: string) => string[];
  getLeafNodes: (chainId: string, flowId: string) => string[];
  getNodeInstance: (chainId: string, flowId: string, nodeId: string) => BaseNode | null;
  
  // 상태 관리
  setStage: (stage: ExecutorStage) => void;
  setError: (error: string | null) => void;
  resetState: () => void;
  
  // 모든 플로우의 결과 초기화
  resetResults: () => void;
  resetFlowGraphs: () => void;
  
  // 편의 함수
  getFlow: (chainId: string, flowId: string) => Flow | undefined;
  getChain: (chainId: string) => FlowChain | undefined;
  getFocusedChain: () => FlowChain | undefined;
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
      parentId: node.parentId || null,
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
      console.error(`[FlowExecutorStore] Failed to create node instance for ${node.id}:`, error);
    }
  });
  
  // 3. 그룹 노드 및 내부 노드 관계 설정
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

// 초기 상태
const initialState = {
  chains: {},
  chainIds: [],
  focusedFlowChainId: null,
  stage: 'upload' as ExecutorStage,
  error: null,
  nodeFactory: new NodeFactory()
};

// Flow Executor 스토어 생성
export const useFlowExecutorStore = create<FlowExecutorState>()(
  persist(
    (set, get) => ({
      ...initialState,
      
      // Chain 관련 액션
      addChain: (name) => {
        const chainId = `chain-${uuidv4()}`;
        set((state) => {
          const newChainIds = [...state.chainIds, chainId];
          return {
            chains: {
              ...state.chains,
              [chainId]: {
                id: chainId,
                name: name || `Flow-Chain-${uuidv4().slice(0, 8)}`,
                status: 'idle',
                selectedFlowId: null,
                flowIds: [],
                flowMap: {},
                inputs: []
              }
            },
            chainIds: newChainIds,
            focusedFlowChainId: state.focusedFlowChainId || chainId // 첫 체인이면 활성화
          };
        });
        return chainId;
      },
      
      removeChain: (chainId) => {
        set((state) => {
          if (!state.chains[chainId]) return state;
          
          // 연결된 모든 Flow 삭제
          const flowIds = state.chains[chainId].flowIds;
          const newFlows = { ...state.chains[chainId].flowMap };
          flowIds.forEach(flowId => {
            delete newFlows[flowId];
          });
          
          // Chain 삭제
          const { [chainId]: removedChain, ...remainingChains } = state.chains;
          const newChainIds = state.chainIds.filter(id => id !== chainId);
          
          // focusedFlowChainId 업데이트
          let newFocusedFlowChainId = state.focusedFlowChainId;
          if (newFocusedFlowChainId === chainId) {
            newFocusedFlowChainId = newChainIds.length > 0 ? newChainIds[0] : null;
          }
          
          return {
            chains: remainingChains,
            chainIds: newChainIds,
            focusedFlowChainId: newFocusedFlowChainId
          };
        });
      },
      
      setChainName: (chainId, name) => {
        set((state) => {
          if (!state.chains[chainId]) return state;
          
          return {
            chains: {
              ...state.chains,
              [chainId]: {
                ...state.chains[chainId],
                name
              }
            }
          };
        });
      },
      
      setChainStatus: (chainId, status, error) => {
        set((state) => {
          if (!state.chains[chainId]) return state;
          
          return {
            chains: {
              ...state.chains,
              [chainId]: {
                ...state.chains[chainId],
                status,
                error: error !== undefined ? error : state.chains[chainId].error
              }
            }
          };
        });
      },
      
      setSelectedFlow: (chainId, flowId) => {
        set((state) => {
          if (!state.chains[chainId]) return state;
          
          return {
            chains: {
              ...state.chains,
              [chainId]: {
                ...state.chains[chainId],
                selectedFlowId: flowId
              }
            }
          };
        });
      },
      
      setFocusedFlowChainId: (id) => {
        set({ focusedFlowChainId: id });
      },
      
      // Flow 관련 액션
      addFlowToChain: (chainId, flowData) => {
        const flowId = `flow-${uuidv4()}`;
        
        set((state) => {
          if (!state.chains[chainId]) return state;
          
          // 이전 선택된 Flow ID 백업
          const selectedFlowId = state.chains[chainId].selectedFlowId;
          
          // 체인의 flowIds 업데이트
          const chainFlowIds = [...state.chains[chainId].flowIds, flowId];
          
          // Flow의 노드와 엣지 분석
          const { nodeMap, graphRelations, nodeInstances, roots, leafs } = buildGraphStructure(
            flowData.nodes,
            flowData.edges,
            state.nodeFactory
          );
          
          return {
            chains: {
              ...state.chains,
              [chainId]: {
                ...state.chains[chainId],
                flowIds: chainFlowIds,
                selectedFlowId: selectedFlowId || flowId, // 선택된 Flow가 없으면 새 Flow 선택
                flowMap: {
                  ...state.chains[chainId].flowMap,
                  [flowId]: {
                    id: flowId,
                    chainId,
                    name: flowData.name || `Flow-${uuidv4().slice(0, 8)}`,
                    flowJson: deepClone(flowData),
                    inputs: [],
                    lastResults: null,
                    status: 'idle',
                    nodeMap,
                    graphMap: graphRelations,
                    nodeInstances,
                    roots,
                    leafs,
                    nodeStates: {}
                  }
                }
              }
            }
          };
        });
        
        return flowId;
      },
      
      removeFlowFromChain: (chainId, flowId) => {
        set((state) => {
          if (!state.chains[chainId] || !state.chains[chainId].flowMap[flowId]) return state;
          
          // 체인의 flowIds에서 제거
          const newFlowIds = state.chains[chainId].flowIds.filter(id => id !== flowId);
          
          // selectedFlowId 업데이트
          let newSelectedFlowId = state.chains[chainId].selectedFlowId;
          if (newSelectedFlowId === flowId) {
            newSelectedFlowId = newFlowIds.length > 0 ? newFlowIds[0] : null;
          }
          
          // Flow 객체 제거
          const { [flowId]: removedFlow, ...remainingFlows } = state.chains[chainId].flowMap;
          
          return {
            chains: {
              ...state.chains,
              [chainId]: {
                ...state.chains[chainId],
                flowIds: newFlowIds,
                selectedFlowId: newSelectedFlowId,
                flowMap: remainingFlows
              }
            }
          };
        });
      },
      
      setFlowStatus: (chainId, flowId, status, error) => {
        set((state) => {
          if (!state.chains[chainId] || !state.chains[chainId].flowMap[flowId]) return state;
          
          return {
            chains: {
              ...state.chains,
              [chainId]: {
                ...state.chains[chainId],
                flowMap: {
                  ...state.chains[chainId].flowMap,
                  [flowId]: {
                    ...state.chains[chainId].flowMap[flowId],
                    status,
                    error: error !== undefined ? error : state.chains[chainId].flowMap[flowId].error
                  }
                }
              }
            }
          };
        });
      },
      
      setFlowInputData: (chainId, flowId, inputs) => {
        set((state) => {
          if (!state.chains[chainId] || !state.chains[chainId].flowMap[flowId]) return state;
          
          return {
            chains: {
              ...state.chains,
              [chainId]: {
                ...state.chains[chainId],
                flowMap: {
                  ...state.chains[chainId].flowMap,
                  [flowId]: {
                    ...state.chains[chainId].flowMap[flowId],
                    inputs
                  }
                }
              }
            }
          };
        });
      },
      
      setFlowResult: (chainId, flowId, results) => {
        set((state) => {
          if (!state.chains[chainId] || !state.chains[chainId].flowMap[flowId]) return state;
          
          return {
            chains: {
              ...state.chains,
              [chainId]: {
                ...state.chains[chainId],
                flowMap: {
                  ...state.chains[chainId].flowMap,
                  [flowId]: {
                    ...state.chains[chainId].flowMap[flowId],
                    lastResults: results,
                    status: 'success' // 결과 설정 시 상태를 success로 변경
                  }
                }
              }
            }
          };
        });
      },
      
      moveFlow: (chainId, flowId, direction) => {
        set((state) => {
          if (!state.chains[chainId] || !state.chains[chainId].flowMap[flowId]) return state;
          
          const flowIds = [...state.chains[chainId].flowIds];
          const currentIndex = flowIds.indexOf(flowId);
          
          if (currentIndex === -1) return state;
          
          let newIndex;
          if (direction === 'up' && currentIndex > 0) {
            newIndex = currentIndex - 1;
          } else if (direction === 'down' && currentIndex < flowIds.length - 1) {
            newIndex = currentIndex + 1;
          } else {
            return state; // 이동할 수 없는 경우
          }
          
          // 배열에서 위치 교환
          [flowIds[currentIndex], flowIds[newIndex]] = [flowIds[newIndex], flowIds[currentIndex]];
          
          return {
            chains: {
              ...state.chains,
              [chainId]: {
                ...state.chains[chainId],
                flowIds
              }
            }
          };
        });
      },
      
      // 노드 상태 관련 액션
      setFlowNodeState: (chainId, flowId, nodeId, nodeState) => {
        set((state) => {
          if (!state.chains[chainId] || !state.chains[chainId].flowMap[flowId] || !state.chains[chainId].flowMap[flowId].nodeMap[nodeId]) return state;
          
          return {
            chains: {
              ...state.chains,
              [chainId]: {
                ...state.chains[chainId],
                flowMap: {
                  ...state.chains[chainId].flowMap,
                  [flowId]: {
                    ...state.chains[chainId].flowMap[flowId],
                    nodeStates: {
                      ...state.chains[chainId].flowMap[flowId].nodeStates,
                      [nodeId]: nodeState
                    }
                  }
                }
              }
            }
          };
        });
      },
      
      getFlowNodeState: (chainId, flowId, nodeId) => {
        const state = get();
        if (!state.chains[chainId] || !state.chains[chainId].flowMap[flowId] || !state.chains[chainId].flowMap[flowId].nodeMap[nodeId]) return undefined;
        
        return state.chains[chainId].flowMap[flowId].nodeStates[nodeId];
      },
      
      // 그래프 데이터 접근 함수
      getRootNodes: (chainId, flowId) => {
        const flow = get().chains[chainId].flowMap[flowId];
        if (!flow) return [];
        
        return flow.roots;
      },
      
      getLeafNodes: (chainId, flowId) => {
        const flow = get().chains[chainId].flowMap[flowId];
        if (!flow) return [];
        
        return flow.leafs;
      },
      
      getNodeInstance: (chainId, flowId, nodeId) => {
        const flow = get().chains[chainId].flowMap[flowId];
        if (!flow || !flow.nodeInstances[nodeId]) return null;
        
        return flow.nodeInstances[nodeId];
      },
      
      // 상태 관리
      setStage: (stage) => {
        set({ stage });
      },
      
      setError: (error) => {
        set({ error });
      },
      
      resetState: () => {
        set(initialState);
      },
      
      resetResults: () => {
        set((state) => {
          const newChains = { ...state.chains };
          
          // 모든 Flow의 결과 초기화
          Object.keys(newChains).forEach(chainId => {
            Object.keys(newChains[chainId].flowMap).forEach(flowId => {
              newChains[chainId].flowMap[flowId] = {
                ...newChains[chainId].flowMap[flowId],
                lastResults: null,
                status: 'idle',
                error: undefined,
                nodeStates: {}
              };
            });
          });
          
          // 모든 Chain의 상태 초기화
          const newChains2 = { ...state.chains };
          Object.keys(newChains2).forEach(chainId => {
            newChains2[chainId] = {
              ...newChains2[chainId],
              status: 'idle',
              error: undefined
            };
          });
          
          return {
            chains: newChains2,
            error: null
          };
        });
      },
      
      resetFlowGraphs: () => {
        set((state) => {
          const newChains2 = { ...state.chains };
          
          // 각 Flow의 노드 인스턴스 재생성
          Object.keys(newChains2).forEach(chainId => {
            Object.keys(newChains2[chainId].flowMap).forEach(flowId => {
              const flow = newChains2[chainId].flowMap[flowId];
              const { nodeMap, graphRelations, nodeInstances, roots, leafs } = buildGraphStructure(
                flow.flowJson.nodes,
                flow.flowJson.edges,
                state.nodeFactory
              );
              
              newChains2[chainId].flowMap[flowId] = {
                ...flow,
                nodeMap,
                graphMap: graphRelations,
                nodeInstances,
                roots,
                leafs
              };
            });
          });
          
          return {
            chains: newChains2
          };
        });
      },
      
      // 편의 함수
      getFlow: (chainId, flowId) => {
        return get().chains[chainId].flowMap[flowId];
      },
      
      getChain: (chainId) => {
        return get().chains[chainId];
      },
      
      getFocusedChain: () => {
        const state = get();
        if (!state.focusedFlowChainId) return undefined;
        
        return state.chains[state.focusedFlowChainId];
      }
    }),
    {
      name: 'flow-executor-store',
      partialize: (state) => ({
        // localStorage에 저장할 상태만 선택
        chains: state.chains,
        chainIds: state.chainIds,
        focusedFlowChainId: state.focusedFlowChainId,
        stage: state.stage
      })
    }
  )
);

// 편의 함수를 위한 직접 export
export const addChain = (name: string) => useFlowExecutorStore.getState().addChain(name);
export const removeChain = (chainId: string) => useFlowExecutorStore.getState().removeChain(chainId);
export const setFocusedFlowChainId = (id: string | null) => useFlowExecutorStore.getState().setFocusedFlowChainId(id);
export const addFlowToChain = (chainId: string, flowData: FlowData) => useFlowExecutorStore.getState().addFlowToChain(chainId, flowData);
export const resetState = () => useFlowExecutorStore.getState().resetState();
export const resetResults = () => useFlowExecutorStore.getState().resetResults();
export const resetFlowGraphs = () => useFlowExecutorStore.getState().resetFlowGraphs();
export const getFlow = (chainId: string, flowId: string) => useFlowExecutorStore.getState().getFlow(chainId, flowId);
export const getChain = (chainId: string) => useFlowExecutorStore.getState().getChain(chainId);
export const getFocusedChain = () => useFlowExecutorStore.getState().getFocusedChain(); 