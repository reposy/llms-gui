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
  flowChainMap: Record<string, FlowChain>;
  flowChainIds: string[];  // Chain 순서 유지
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
  addFlowToChain: (chainId: string, flow: Flow) => string; // 생성된 flow-id 반환
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

// 초기 상태
const initialState = {
  flowChainMap: {},
  flowChainIds: [],
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
          const newChainIds = [...state.flowChainIds, chainId];
          return {
            flowChainMap: {
              ...state.flowChainMap,
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
            flowChainIds: newChainIds,
            focusedFlowChainId: state.focusedFlowChainId || chainId // 첫 체인이면 활성화
          };
        });
        return chainId;
      },
      
      removeChain: (chainId) => {
        set((state) => {
          if (!state.flowChainMap[chainId]) return state;
          
          // 연결된 모든 Flow 삭제
          const flowIds = state.flowChainMap[chainId].flowIds;
          const newFlows = { ...state.flowChainMap[chainId].flowMap };
          flowIds.forEach(flowId => {
            delete newFlows[flowId];
          });
          
          // Chain 삭제
          const { [chainId]: removedChain, ...remainingChains } = state.flowChainMap;
          const newChainIds = state.flowChainIds.filter(id => id !== chainId);
          
          // focusedFlowChainId 업데이트
          let newFocusedFlowChainId = state.focusedFlowChainId;
          if (newFocusedFlowChainId === chainId) {
            newFocusedFlowChainId = newChainIds.length > 0 ? newChainIds[0] : null;
          }
          
          return {
            flowChainMap: remainingChains,
            flowChainIds: newChainIds,
            focusedFlowChainId: newFocusedFlowChainId
          };
        });
      },
      
      setChainName: (chainId, name) => {
        set((state) => {
          if (!state.flowChainMap[chainId]) return state;
          
          return {
            flowChainMap: {
              ...state.flowChainMap,
              [chainId]: {
                ...state.flowChainMap[chainId],
                name
              }
            }
          };
        });
      },
      
      setChainStatus: (chainId, status, error) => {
        set((state) => {
          if (!state.flowChainMap[chainId]) return state;
          
          return {
            flowChainMap: {
              ...state.flowChainMap,
              [chainId]: {
                ...state.flowChainMap[chainId],
                status,
                error: error !== undefined ? error : state.flowChainMap[chainId].error
              }
            }
          };
        });
      },
      
      setSelectedFlow: (chainId, flowId) => {
        set((state) => {
          if (!state.flowChainMap[chainId]) return state;
          
          return {
            flowChainMap: {
              ...state.flowChainMap,
              [chainId]: {
                ...state.flowChainMap[chainId],
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
      addFlowToChain: (chainId, flow) => {
        set((state) => {
          if (!state.flowChainMap[chainId]) return state;
          const selectedFlowId = state.flowChainMap[chainId].selectedFlowId;
          const chainFlowIds = [...state.flowChainMap[chainId].flowIds, flow.id];
          return {
            flowChainMap: {
              ...state.flowChainMap,
              [chainId]: {
                ...state.flowChainMap[chainId],
                flowIds: chainFlowIds,
                selectedFlowId: selectedFlowId || flow.id,
                flowMap: {
                  ...state.flowChainMap[chainId].flowMap,
                  [flow.id]: flow
                }
              }
            }
          };
        });
        return flow.id;
      },
      
      removeFlowFromChain: (chainId, flowId) => {
        set((state) => {
          if (!state.flowChainMap[chainId] || !state.flowChainMap[chainId].flowMap[flowId]) return state;
          
          // 체인의 flowIds에서 제거
          const newFlowIds = state.flowChainMap[chainId].flowIds.filter(id => id !== flowId);
          
          // selectedFlowId 업데이트
          let newSelectedFlowId = state.flowChainMap[chainId].selectedFlowId;
          if (newSelectedFlowId === flowId) {
            newSelectedFlowId = newFlowIds.length > 0 ? newFlowIds[0] : null;
          }
          
          // Flow 객체 제거
          const { [flowId]: removedFlow, ...remainingFlows } = state.flowChainMap[chainId].flowMap;
          
          return {
            flowChainMap: {
              ...state.flowChainMap,
              [chainId]: {
                ...state.flowChainMap[chainId],
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
          if (!state.flowChainMap[chainId] || !state.flowChainMap[chainId].flowMap[flowId]) return state;
          
          return {
            flowChainMap: {
              ...state.flowChainMap,
              [chainId]: {
                ...state.flowChainMap[chainId],
                flowMap: {
                  ...state.flowChainMap[chainId].flowMap,
                  [flowId]: {
                    ...state.flowChainMap[chainId].flowMap[flowId],
                    status,
                    error: error !== undefined ? error : state.flowChainMap[chainId].flowMap[flowId].error
                  }
                }
              }
            }
          };
        });
      },
      
      setFlowInputData: (chainId, flowId, inputs) => {
        set((state) => {
          if (!state.flowChainMap[chainId] || !state.flowChainMap[chainId].flowMap[flowId]) return state;
          
          return {
            flowChainMap: {
              ...state.flowChainMap,
              [chainId]: {
                ...state.flowChainMap[chainId],
                flowMap: {
                  ...state.flowChainMap[chainId].flowMap,
                  [flowId]: {
                    ...state.flowChainMap[chainId].flowMap[flowId],
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
          if (!state.flowChainMap[chainId] || !state.flowChainMap[chainId].flowMap[flowId]) return state;
          
          return {
            flowChainMap: {
              ...state.flowChainMap,
              [chainId]: {
                ...state.flowChainMap[chainId],
                flowMap: {
                  ...state.flowChainMap[chainId].flowMap,
                  [flowId]: {
                    ...state.flowChainMap[chainId].flowMap[flowId],
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
          if (!state.flowChainMap[chainId] || !state.flowChainMap[chainId].flowMap[flowId]) return state;
          
          const flowIds = [...state.flowChainMap[chainId].flowIds];
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
            flowChainMap: {
              ...state.flowChainMap,
              [chainId]: {
                ...state.flowChainMap[chainId],
                flowIds
              }
            }
          };
        });
      },
      
      // 노드 상태 관련 액션
      setFlowNodeState: (chainId, flowId, nodeId, nodeState) => {
        set((state) => {
          if (!state.flowChainMap[chainId] || !state.flowChainMap[chainId].flowMap[flowId] || !state.flowChainMap[chainId].flowMap[flowId].nodeMap[nodeId]) return state;
          
          return {
            flowChainMap: {
              ...state.flowChainMap,
              [chainId]: {
                ...state.flowChainMap[chainId],
                flowMap: {
                  ...state.flowChainMap[chainId].flowMap,
                  [flowId]: {
                    ...state.flowChainMap[chainId].flowMap[flowId],
                    nodeStates: {
                      ...state.flowChainMap[chainId].flowMap[flowId].nodeStates,
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
        if (!state.flowChainMap[chainId] || !state.flowChainMap[chainId].flowMap[flowId] || !state.flowChainMap[chainId].flowMap[flowId].nodeMap[nodeId]) return undefined;
        
        return state.flowChainMap[chainId].flowMap[flowId].nodeStates[nodeId];
      },
      
      // 그래프 데이터 접근 함수
      getRootNodes: (chainId, flowId) => {
        const flow = get().flowChainMap[flowId];
        if (!flow) return [];
        
        return flow.roots;
      },
      
      getLeafNodes: (chainId, flowId) => {
        const flow = get().flowChainMap[flowId];
        if (!flow) return [];
        
        return flow.leafs;
      },
      
      getNodeInstance: (chainId, flowId, nodeId) => {
        const flow = get().flowChainMap[flowId];
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
          const newChains = { ...state.flowChainMap };
          
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
          const newChains2 = { ...state.flowChainMap };
          Object.keys(newChains2).forEach(chainId => {
            newChains2[chainId] = {
              ...newChains2[chainId],
              status: 'idle',
              error: undefined
            };
          });
          
          return {
            flowChainMap: newChains2,
            error: null
          };
        });
      },
      
      resetFlowGraphs: () => {
        set((state) => {
          const newChains2 = { ...state.flowChainMap };
          
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
            flowChainMap: newChains2
          };
        });
      },
      
      // 편의 함수
      getFlow: (chainId, flowId) => {
        return get().flowChainMap[flowId];
      },
      
      getChain: (chainId) => {
        return get().flowChainMap[chainId];
      },
      
      getFocusedChain: () => {
        const state = get();
        if (!state.focusedFlowChainId) return undefined;
        
        return state.flowChainMap[state.focusedFlowChainId];
      }
    }),
    {
      name: 'flow-executor-store',
      partialize: (state) => ({
        // localStorage에 저장할 상태만 선택
        flowChainMap: state.flowChainMap,
        flowChainIds: state.flowChainIds,
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
export const addFlowToChain = (chainId: string, flow: Flow) => useFlowExecutorStore.getState().addFlowToChain(chainId, flow);
export const resetState = () => useFlowExecutorStore.getState().resetState();
export const resetResults = () => useFlowExecutorStore.getState().resetResults();
export const resetFlowGraphs = () => useFlowExecutorStore.getState().resetFlowGraphs();
export const getFlow = (chainId: string, flowId: string) => useFlowExecutorStore.getState().getFlow(chainId, flowId);
export const getFlowChain = (flowChainId: string) => useFlowExecutorStore.getState().getChain(flowChainId);
export const getFocusedChain = () => useFlowExecutorStore.getState().getFocusedChain();
export const setFlowChainStatus = (flowChainId: string, status: ExecutionStatus, error?: string) => useFlowExecutorStore.getState().setChainStatus(flowChainId, status, error); 