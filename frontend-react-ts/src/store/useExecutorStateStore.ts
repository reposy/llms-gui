import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { type FlowData } from '../utils/data/importExportUtils';
export type { FlowData } from '../utils/data/importExportUtils';
import { useExecutorGraphStore } from './useExecutorGraphStore';
import { deepClone } from '../utils/helpers';
import { v4 as uuidv4 } from 'uuid';

export type ExecutorStage = 'upload' | 'input' | 'executing' | 'result';

// Flow 하나의 정보
export interface Flow {
  id: string;
  name: string;
  flowJson: FlowData;
  inputs: any[];
  lastResults: any[] | null;
  status: 'idle' | 'running' | 'success' | 'error';
  error?: string;
}

// Flow Chain의 정보
export interface FlowChain {
  id: string;
  name: string;
  status: 'idle' | 'running' | 'success' | 'error';
  selectedFlowId: string | null;  // 체이닝에 사용될 Flow의 ID
  flows: Record<string, Flow>;
  flowIds: string[];  // 실행 순서
  error?: string;
}

// 전체 Flows 객체
export interface Flows {
  chains: Record<string, FlowChain>;
  chainIds: string[];  // 순서 유지
  activeChainId: string | null;
}

interface ExecutorState {
  flows: Flows;
  stage: ExecutorStage;
  error: string | null;

  // Flow Chain 관련 액션
  addChain: (name: string) => void;
  removeChain: (id: string) => void;
  setChainName: (id: string, name: string) => void;
  addFlowToChain: (chainId: string, flowJson: FlowData) => void;
  removeFlowFromChain: (chainId: string, flowId: string) => void;
  setChainStatus: (chainId: string, status: FlowChain['status']) => void;
  setFlowStatus: (chainId: string, flowId: string, status: Flow['status'], error?: string) => void;
  setSelectedFlow: (chainId: string, flowId: string | null) => void;
  moveFlow: (chainId: string, flowId: string, direction: 'up' | 'down') => void;
  setFlowInputs: (chainId: string, flowId: string, inputs: any[]) => void;
  setFlowResults: (chainId: string, flowId: string, results: any[]) => void;
  
  // 상태 관리
  setStage: (stage: ExecutorStage) => void;
  setError: (error: string | null) => void;
  resetState: () => void;
  
  // 편의 함수
  getFlow: (chainId: string, flowId: string) => Flow | undefined;
  getChain: (chainId: string) => FlowChain | undefined;
  getActiveChain: () => FlowChain | undefined;
}

const initialState: Pick<ExecutorState, 'flows' | 'stage' | 'error'> = {
  flows: {
    chains: {},
    chainIds: [],
    activeChainId: null
  },
  stage: 'upload',
  error: null
};

export const useExecutorStateStore = create<ExecutorState>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Flow Chain 관련 액션
      addChain: (name) => set((state) => {
        const id = `chain-${uuidv4()}`;
        return {
          flows: {
            ...state.flows,
            chains: {
              ...state.flows.chains,
              [id]: {
                id,
                name,
                status: 'idle',
                selectedFlowId: null,
                flows: {},
                flowIds: [],
                error: undefined
              }
            },
            chainIds: [...state.flows.chainIds, id],
            activeChainId: state.flows.activeChainId || id
          }
        };
      }),

      removeChain: (id) => set((state) => {
        const { [id]: removed, ...remainingChains } = state.flows.chains;
        const newChainIds = state.flows.chainIds.filter(chainId => chainId !== id);
        
        // activeChainId 조정
        let newActiveChainId = state.flows.activeChainId;
        if (newActiveChainId === id) {
          newActiveChainId = newChainIds.length > 0 ? newChainIds[0] : null;
        }

        return {
          flows: {
            ...state.flows,
            chains: remainingChains,
            chainIds: newChainIds,
            activeChainId: newActiveChainId
          }
        };
      }),

      setChainName: (id, name) => set((state) => ({
        flows: {
          ...state.flows,
          chains: {
            ...state.flows.chains,
            [id]: {
              ...state.flows.chains[id],
              name
            }
          }
        }
      })),

      addFlowToChain: (chainId, flowJson: FlowData) => set((state) => {
        const chain = state.flows.chains[chainId];
        if (!chain) return state;

        const flowId = `flow-${uuidv4()}`;
        const newFlow: Flow = {
          id: flowId,
          name: flowJson.name || `Flow ${Object.keys(chain.flows).length + 1}`,
          flowJson: deepClone(flowJson),
          inputs: [],
          lastResults: null,
          status: 'idle'
        };

        // 그래프 스토어에 Flow 그래프 정보 저장
        const graphStore = useExecutorGraphStore.getState();
        graphStore.setFlowGraph(flowId, flowJson);

        return {
          flows: {
            ...state.flows,
            chains: {
              ...state.flows.chains,
              [chainId]: {
                ...chain,
                flows: {
                  ...chain.flows,
                  [flowId]: newFlow
                },
                flowIds: [...chain.flowIds, flowId]
              }
            }
          }
        };
      }),

      removeFlowFromChain: (chainId, flowId) => set((state) => {
        const chain = state.flows.chains[chainId];
        if (!chain) return state;

        const { [flowId]: removed, ...remainingFlows } = chain.flows;
        return {
          flows: {
            ...state.flows,
            chains: {
              ...state.flows.chains,
              [chainId]: {
                ...chain,
                flows: remainingFlows,
                flowIds: chain.flowIds.filter(id => id !== flowId),
                selectedFlowId: chain.selectedFlowId === flowId ? null : chain.selectedFlowId
              }
            }
          }
        };
      }),

      setChainStatus: (chainId, status) => set((state) => ({
        flows: {
          ...state.flows,
          chains: {
            ...state.flows.chains,
            [chainId]: {
              ...state.flows.chains[chainId],
              status,
              error: status === 'error' ? state.flows.chains[chainId].error : undefined
            }
          }
        }
      })),

      setFlowStatus: (chainId, flowId, status, error) => set((state) => {
        const chain = state.flows.chains[chainId];
        if (!chain) return state;

        return {
          flows: {
            ...state.flows,
            chains: {
              ...state.flows.chains,
              [chainId]: {
                ...chain,
                flows: {
                  ...chain.flows,
                  [flowId]: {
                    ...chain.flows[flowId],
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
        flows: {
          ...state.flows,
          chains: {
            ...state.flows.chains,
            [chainId]: {
              ...state.flows.chains[chainId],
              selectedFlowId: flowId
            }
          }
        }
      })),

      moveFlow: (chainId, flowId, direction) => set((state) => {
        const chain = state.flows.chains[chainId];
        if (!chain) return state;

        const currentIndex = chain.flowIds.indexOf(flowId);
        if (currentIndex === -1) return state;

        const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        if (newIndex < 0 || newIndex >= chain.flowIds.length) return state;

        const newFlowIds = [...chain.flowIds];
        [newFlowIds[currentIndex], newFlowIds[newIndex]] = [newFlowIds[newIndex], newFlowIds[currentIndex]];

        return {
          flows: {
            ...state.flows,
            chains: {
              ...state.flows.chains,
              [chainId]: {
                ...chain,
                flowIds: newFlowIds
              }
            }
          }
        };
      }),

      setFlowInputs: (chainId, flowId, inputs) => set((state) => {
        const chain = state.flows.chains[chainId];
        if (!chain) return state;

        return {
          flows: {
            ...state.flows,
            chains: {
              ...state.flows.chains,
              [chainId]: {
                ...chain,
                flows: {
                  ...chain.flows,
                  [flowId]: {
                    ...chain.flows[flowId],
                    inputs
                  }
                }
              }
            }
          }
        };
      }),

      setFlowResults: (chainId, flowId, results) => set((state) => {
        const chain = state.flows.chains[chainId];
        if (!chain) return state;

        return {
          flows: {
            ...state.flows,
            chains: {
              ...state.flows.chains,
              [chainId]: {
                ...chain,
                flows: {
                  ...chain.flows,
                  [flowId]: {
                    ...chain.flows[flowId],
                    lastResults: results
                  }
                }
              }
            }
          }
        };
      }),

      // 상태 관리
      setStage: (stage) => set({ stage }),
      setError: (error) => set({ error }),
      
      resetState: () => {
        // 그래프 스토어 초기화
        useExecutorGraphStore.getState().resetFlowGraphs();
        set(initialState);
      },

      // 편의 함수
      getFlow: (chainId, flowId) => {
        const chain = get().flows.chains[chainId];
        return chain?.flows[flowId];
      },

      getChain: (chainId) => get().flows.chains[chainId],

      getActiveChain: () => {
        const { flows } = get();
        return flows.activeChainId ? flows.chains[flows.activeChainId] : undefined;
      }
    }),
    {
      name: 'flow-executor-storage',
      partialize: (state) => ({
        flows: state.flows,
        stage: state.stage
      })
    }
  )
); 