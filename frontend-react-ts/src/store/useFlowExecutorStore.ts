import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { type FlowData } from '../utils/data/importExportUtils';
import { NodeFactory, globalNodeFactory } from '../core/NodeFactory';
import { Node as BaseNode } from '../core/Node';
import { buildGraphStructure } from '../utils/flow/flowExecutorUtils';
import { deepClone } from '../utils/helpers';

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
  flowChainId: string; // Flow가 속한 FlowChain ID
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
  rootIds: string[];
  leafIds: string[];
  nodeStates: Record<string, FlowNodeExecutionState>; // Executor에서 실행 시 각 노드의 상태
}

// FlowChain의 정보
export interface FlowChain {
  id: string;
  name: string;
  status: ExecutionStatus;
  selectedFlowId: string | null;  // 현재 선택된 Flow의 ID
  flowIds: string[];  // 실행 순서
  flowMap: Record<string, Flow>; // flowMap 추가
  error?: string;
  inputs?: any[]; // FlowChain 전체의 입력
}

// Executor 전체 상태
export interface FlowExecutorState {
  flowChainMap: Record<string, FlowChain>;
  flowChainIds: string[];
  focusedFlowChainId: string | null;
  stage: ExecutorStage;
  error: string | null;
  nodeFactory: NodeFactory;

  // FlowChain 관련 액션
  addFlowChain: (name: string) => string; // 생성된 flowChain-id 반환
  removeFlowChain: (flowChainId: string) => void;
  setFlowChainName: (flowChainId: string, name: string) => void;
  setFlowChainStatus: (flowChainId: string, status: ExecutionStatus, error?: string) => void;
  setSelectedFlow: (flowChainId: string, flowId: string | null) => void;
  setFocusedFlowChainId: (id: string | null) => void;
  
  // Flow 관련 액션
  addFlowToFlowChain: (flowChainId: string, flow: Flow) => string; // 생성된 flow-id 반환
  removeFlowFromFlowChain: (flowChainId: string, flowId: string) => void;
  setFlowStatus: (flowChainId: string, flowId: string, status: ExecutionStatus, error?: string) => void;
  setFlowInputData: (flowChainId: string, flowId: string, inputs: any[]) => void;
  setFlowResult: (flowChainId: string, flowId: string, results: any[]) => void;
  moveFlow: (flowChainId: string, flowId: string, direction: 'up' | 'down') => void;
  
  // 노드 상태 관련 액션
  setFlowNodeState: (flowChainId: string, flowId: string, nodeId: string, nodeState: FlowNodeExecutionState) => void;
  getFlowNodeState: (flowChainId: string, flowId: string, nodeId: string) => FlowNodeExecutionState | undefined;
  
  // 그래프 데이터 접근 함수
  getRootNodes: (flowChainId: string, flowId: string) => string[];
  getLeafNodes: (flowChainId: string, flowId: string) => string[];
  getNodeInstance: (flowChainId: string, flowId: string, nodeId: string) => BaseNode | null;
  
  // 상태 관리
  setStage: (stage: ExecutorStage) => void;
  setError: (error: string | null) => void;
  resetState: () => void;
  
  // 모든 플로우의 결과 초기화
  resetResults: () => void;
  resetFlowGraphs: () => void;
  
  // 편의 함수
  getFlow: (flowChainId: string, flowId: string) => Flow | undefined;
  getFlowChain: (flowChainId: string) => FlowChain | undefined;
  getFocusedFlowChain: () => FlowChain | undefined;
}

// 초기 상태
const initialState = {
  flowChainMap: {},
  flowChainIds: [],
  focusedFlowChainId: null,
  stage: 'upload' as ExecutorStage,
  error: null,
  nodeFactory: globalNodeFactory
};

// Flow Executor 스토어 생성
export const useFlowExecutorStore = create<FlowExecutorState>()(
  persist(
    (set, get) => ({
      ...initialState,
      
      // FlowChain 관련 액션
      addFlowChain: (name) => {
        const flowChainId = `flowChain-${uuidv4()}`;
        set((state) => {
          const newFlowChainIds = [...state.flowChainIds, flowChainId];
          return {
            flowChainMap: {
              ...state.flowChainMap,
              [flowChainId]: {
                id: flowChainId,
                name: name || `Flow-Chain-${uuidv4().slice(0, 8)}`,
                status: 'idle',
                selectedFlowId: null,
                flowIds: [],
                flowMap: {},
                inputs: []
              }
            },
            flowChainIds: newFlowChainIds,
            focusedFlowChainId: state.focusedFlowChainId || flowChainId // 첫 체인이면 활성화
          };
        });
        return flowChainId;
      },
      
      removeFlowChain: (flowChainId) => {
        set((state) => {
          if (!state.flowChainMap[flowChainId]) return state;
          
          // 연결된 모든 Flow 삭제
          const flowIds = state.flowChainMap[flowChainId].flowIds;
          const newFlows = { ...state.flowChainMap[flowChainId].flowMap };
          flowIds.forEach(flowId => {
            delete newFlows[flowId];
          });
          
          // FlowChain 삭제
          const { [flowChainId]: removedFlowChain, ...remainingFlowChains } = state.flowChainMap;
          const newFlowChainIds = state.flowChainIds.filter(id => id !== flowChainId);
          
          // focusedFlowChainId 업데이트
          let newFocusedFlowChainId = state.focusedFlowChainId;
          if (newFocusedFlowChainId === flowChainId) {
            newFocusedFlowChainId = newFlowChainIds.length > 0 ? newFlowChainIds[0] : null;
          }
          
          return {
            flowChainMap: remainingFlowChains,
            flowChainIds: newFlowChainIds,
            focusedFlowChainId: newFocusedFlowChainId
          };
        });
      },
      
      setFlowChainName: (flowChainId, name) => {
        set((state) => {
          if (!state.flowChainMap[flowChainId]) return state;
          
          return {
            flowChainMap: {
              ...state.flowChainMap,
              [flowChainId]: {
                ...state.flowChainMap[flowChainId],
                name
              }
            }
          };
        });
      },
      
      setFlowChainStatus: (flowChainId, status, error) => {
        set((state) => {
          if (!state.flowChainMap[flowChainId]) return state;
          
          return {
            flowChainMap: {
              ...state.flowChainMap,
              [flowChainId]: {
                ...state.flowChainMap[flowChainId],
                status,
                error: error !== undefined ? error : state.flowChainMap[flowChainId].error
              }
            }
          };
        });
      },
      
      setSelectedFlow: (flowChainId, flowId) => {
        set((state) => {
          if (!state.flowChainMap[flowChainId]) return state;
          
          return {
            flowChainMap: {
              ...state.flowChainMap,
              [flowChainId]: {
                ...state.flowChainMap[flowChainId],
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
      addFlowToFlowChain: (flowChainId, flow) => {
        set((state) => {
          if (!state.flowChainMap[flowChainId]) return state;
          const selectedFlowId = state.flowChainMap[flowChainId].selectedFlowId;
          const flowChainFlowIds = [...state.flowChainMap[flowChainId].flowIds, flow.id];
          return {
            flowChainMap: {
              ...state.flowChainMap,
              [flowChainId]: {
                ...state.flowChainMap[flowChainId],
                flowIds: flowChainFlowIds,
                selectedFlowId: selectedFlowId || flow.id,
                flowMap: {
                  ...state.flowChainMap[flowChainId].flowMap,
                  [flow.id]: flow
                }
              }
            }
          };
        });
        return flow.id;
      },
      
      removeFlowFromFlowChain: (flowChainId, flowId) => {
        set((state) => {
          if (!state.flowChainMap[flowChainId] || !state.flowChainMap[flowChainId].flowMap[flowId]) return state;
          
          // 체인의 flowIds에서 제거
          const newFlowIds = state.flowChainMap[flowChainId].flowIds.filter(id => id !== flowId);
          
          // selectedFlowId 업데이트
          let newSelectedFlowId = state.flowChainMap[flowChainId].selectedFlowId;
          if (newSelectedFlowId === flowId) {
            newSelectedFlowId = newFlowIds.length > 0 ? newFlowIds[0] : null;
          }
          
          // Flow 객체 제거
          const { [flowId]: removedFlow, ...remainingFlows } = state.flowChainMap[flowChainId].flowMap;
          
          return {
            flowChainMap: {
              ...state.flowChainMap,
              [flowChainId]: {
                ...state.flowChainMap[flowChainId],
                flowIds: newFlowIds,
                selectedFlowId: newSelectedFlowId,
                flowMap: remainingFlows
              }
            }
          };
        });
      },
      
      setFlowStatus: (flowChainId, flowId, status, error) => {
        set((state) => {
          if (!state.flowChainMap[flowChainId] || !state.flowChainMap[flowChainId].flowMap[flowId]) return state;
          
          return {
            flowChainMap: {
              ...state.flowChainMap,
              [flowChainId]: {
                ...state.flowChainMap[flowChainId],
                flowMap: {
                  ...state.flowChainMap[flowChainId].flowMap,
                  [flowId]: {
                    ...state.flowChainMap[flowChainId].flowMap[flowId],
                    status,
                    error: error !== undefined ? error : state.flowChainMap[flowChainId].flowMap[flowId].error
                  }
                }
              }
            }
          };
        });
      },
      
      setFlowInputData: (flowChainId, flowId, inputs) => {
        set((state) => {
          if (!state.flowChainMap[flowChainId] || !state.flowChainMap[flowChainId].flowMap[flowId]) return state;
          return {
            flowChainMap: {
              ...state.flowChainMap,
              [flowChainId]: {
                ...state.flowChainMap[flowChainId],
                flowMap: {
                  ...state.flowChainMap[flowChainId].flowMap,
                  [flowId]: {
                    ...state.flowChainMap[flowChainId].flowMap[flowId],
                    inputs: deepClone(inputs)
                  }
                }
              }
            }
          };
        });
      },
      
      setFlowResult: (flowChainId, flowId, results) => {
        set((state) => {
          if (!state.flowChainMap[flowChainId] || !state.flowChainMap[flowChainId].flowMap[flowId]) return state;
          // 항상 배열로 정규화
          const normalizedResults = Array.isArray(results) ? results : [results];
          const newState = {
            flowChainMap: {
              ...state.flowChainMap,
              [flowChainId]: {
                ...state.flowChainMap[flowChainId],
                flowMap: {
                  ...state.flowChainMap[flowChainId].flowMap,
                  [flowId]: {
                    ...state.flowChainMap[flowChainId].flowMap[flowId],
                    lastResults: normalizedResults,
                    status: 'success' as ExecutionStatus // 타입 단언 추가
                  }
                }
              }
            }
          };
          console.log('[setFlowResult] 저장 직후:', newState.flowChainMap[flowChainId].flowMap[flowId].lastResults);
          return newState;
        });
      },
      
      moveFlow: (flowChainId, flowId, direction) => {
        set((state) => {
          if (!state.flowChainMap[flowChainId] || !state.flowChainMap[flowChainId].flowMap[flowId]) return state;
          
          const flowIds = [...state.flowChainMap[flowChainId].flowIds];
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
              [flowChainId]: {
                ...state.flowChainMap[flowChainId],
                flowIds
              }
            }
          };
        });
      },
      
      // 노드 상태 관련 액션
      setFlowNodeState: (flowChainId, flowId, nodeId, nodeState) => {
        set((state) => {
          if (!state.flowChainMap[flowChainId] || !state.flowChainMap[flowChainId].flowMap[flowId] || !state.flowChainMap[flowChainId].flowMap[flowId].nodeMap[nodeId]) return state;
          
          return {
            flowChainMap: {
              ...state.flowChainMap,
              [flowChainId]: {
                ...state.flowChainMap[flowChainId],
                flowMap: {
                  ...state.flowChainMap[flowChainId].flowMap,
                  [flowId]: {
                    ...state.flowChainMap[flowChainId].flowMap[flowId],
                    nodeStates: {
                      ...state.flowChainMap[flowChainId].flowMap[flowId].nodeStates,
                      [nodeId]: nodeState
                    }
                  }
                }
              }
            }
          };
        });
      },
      
      getFlowNodeState: (flowChainId, flowId, nodeId) => {
        const state = get();
        if (!state.flowChainMap[flowChainId] || !state.flowChainMap[flowChainId].flowMap[flowId] || !state.flowChainMap[flowChainId].flowMap[flowId].nodeMap[nodeId]) return undefined;
        
        return state.flowChainMap[flowChainId].flowMap[flowId].nodeStates[nodeId];
      },
      
      // 그래프 데이터 접근 함수
      getRootNodes: (flowChainId, flowId) => {
        const flowChain = get().flowChainMap[flowChainId];
        if (!flowChain || !flowChain.flowMap[flowId]) return [];
        return flowChain.flowMap[flowId].rootIds;
      },
      
      getLeafNodes: (flowChainId, flowId) => {
        const flowChain = get().flowChainMap[flowChainId];
        if (!flowChain || !flowChain.flowMap[flowId]) return [];
        return flowChain.flowMap[flowId].leafIds;
      },
      
      getNodeInstance: (flowChainId, flowId, nodeId) => {
        const flowChain = get().flowChainMap[flowChainId];
        if (!flowChain || !flowChain.flowMap[flowId] || !flowChain.flowMap[flowId].nodeInstances[nodeId]) return null;
        return flowChain.flowMap[flowId].nodeInstances[nodeId];
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
          const newFlowChains = { ...state.flowChainMap };
          
          // 모든 Flow의 결과 초기화
          Object.keys(newFlowChains).forEach(flowChainId => {
            Object.keys(newFlowChains[flowChainId].flowMap).forEach(flowId => {
              newFlowChains[flowChainId].flowMap[flowId] = {
                ...newFlowChains[flowChainId].flowMap[flowId],
                lastResults: null,
                status: 'idle',
                error: undefined,
                nodeStates: {}
              };
            });
          });
          
          // 모든 FlowChain의 상태 초기화
          const newFlowChains2 = { ...state.flowChainMap };
          Object.keys(newFlowChains2).forEach(flowChainId => {
            newFlowChains2[flowChainId] = {
              ...newFlowChains2[flowChainId],
              status: 'idle',
              error: undefined
            };
          });
          
          return {
            flowChainMap: newFlowChains2,
            error: null
          };
        });
      },
      
      resetFlowGraphs: () => {
        set((state) => {
          const newFlowChains2 = { ...state.flowChainMap };
          
          // 각 Flow의 노드 인스턴스 재생성
          Object.keys(newFlowChains2).forEach(flowChainId => {
            Object.keys(newFlowChains2[flowChainId].flowMap).forEach(flowId => {
              const flow = newFlowChains2[flowChainId].flowMap[flowId];
              const { nodeMap, graphRelations, nodeInstances, rootIds, leafIds } = buildGraphStructure(
                flow.flowJson.nodes,
                flow.flowJson.edges,
                state.nodeFactory
              );
              
              newFlowChains2[flowChainId].flowMap[flowId] = {
                ...flow,
                nodeMap,
                graphMap: graphRelations,
                nodeInstances,
                rootIds,
                leafIds
              };
            });
          });
          
          return {
            flowChainMap: newFlowChains2
          };
        });
      },
      
      // 편의 함수
      getFlow: (flowChainId, flowId) => {
        const flowChain = get().flowChainMap[flowChainId];
        if (!flowChain) return undefined;
        return flowChain.flowMap[flowId];
      },
      
      getFlowChain: (flowChainId) => {
        return get().flowChainMap[flowChainId];
      },
      
      getFocusedFlowChain: () => {
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
export const addFlowChain = (name: string) => useFlowExecutorStore.getState().addFlowChain(name);
export const removeFlowChain = (flowChainId: string) => useFlowExecutorStore.getState().removeFlowChain(flowChainId);
export const setFocusedFlowChainId = (id: string | null) => useFlowExecutorStore.getState().setFocusedFlowChainId(id);
export const addFlowToFlowChain = (flowChainId: string, flow: Flow) => useFlowExecutorStore.getState().addFlowToFlowChain(flowChainId, flow);
export const resetState = () => useFlowExecutorStore.getState().resetState();
export const resetResults = () => useFlowExecutorStore.getState().resetResults();
export const resetFlowGraphs = () => useFlowExecutorStore.getState().resetFlowGraphs();
export const getFlow = (flowChainId: string, flowId: string) => useFlowExecutorStore.getState().getFlow(flowChainId, flowId);
export const getFlowChain = (flowChainId: string) => useFlowExecutorStore.getState().getFlowChain(flowChainId);
export const getFocusedFlowChain = () => useFlowExecutorStore.getState().getFocusedFlowChain();
export const setFlowChainStatus = (flowChainId: string, status: ExecutionStatus, error?: string) => useFlowExecutorStore.getState().setFlowChainStatus(flowChainId, status, error); 