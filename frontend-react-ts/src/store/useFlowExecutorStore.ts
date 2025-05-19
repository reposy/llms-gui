import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { deepClone } from '../utils/helpers';
import { type FlowData } from '../utils/data/importExportUtils';
import { NodeFactory } from '../core/NodeFactory';
import { Node, Edge } from '@xyflow/react';

// 실행 상태 타입
export type ExecutionStatus = 'idle' | 'running' | 'success' | 'error';

// Flow 타입
export interface Flow {
  id: string;
  name: string;
  // 입력 및 결과
  inputs: any[];
  results: any[] | null;
  status: ExecutionStatus;
  error?: string;
  // 그래프 구조
  nodes: Record<string, GraphNode>;
  edges: Record<string, GraphEdge>;
  rootIds: string[];
  leafIds: string[];
}

// FlowChain 타입
export interface FlowChain {
  id: string;
  name: string;
  status: ExecutionStatus;
  error?: string;
  selectedFlowId: string | null;
  // 실행 순서를 명확히 함
  flowIds: string[];
}

// 그래프 노드 타입
interface GraphNode {
  id: string;
  type: string;
  data: any;
  position: { x: number, y: number };
  parentNodeId: string | null;
  isGroupNode: boolean;
}

// 그래프 엣지 타입
interface GraphEdge {
  id: string;
  source: string;
  target: string;
  data?: any;
}

// 실행기 단계
export type ExecutorStage = 'upload' | 'input' | 'executing' | 'result';

// 스토어 상태 타입
interface FlowExecutorState {
  // 정규화된 엔티티 컬렉션
  chains: Record<string, FlowChain>;
  flows: Record<string, Flow>;
  
  // 상태 관리
  activeChainId: string | null;
  stage: ExecutorStage;
  error: string | null;
  nodeFactory: NodeFactory;
  
  // Chain 관련 액션
  addChain: (name: string) => string;
  removeChain: (chainId: string) => void;
  setChainName: (chainId: string, name: string) => void;
  setChainStatus: (chainId: string, status: ExecutionStatus, error?: string) => void;
  setActiveChain: (chainId: string | null) => void;
  
  // Flow 관련 액션
  addFlowToChain: (chainId: string, flowJson: FlowData) => string;
  removeFlowFromChain: (chainId: string, flowId: string) => void;
  setFlowStatus: (chainId: string, flowId: string, status: ExecutionStatus, error?: string) => void;
  setFlowInputs: (chainId: string, flowId: string, inputs: any[]) => void;
  setFlowResults: (chainId: string, flowId: string, results: any[]) => void;
  setSelectedFlow: (chainId: string, flowId: string | null) => void;
  
  // Flow 순서 관련 액션
  moveFlow: (chainId: string, flowId: string, direction: 'up' | 'down') => void;
  
  // 스테이지 관련 액션
  setStage: (stage: ExecutorStage) => void;
  
  // 오류 관련 액션
  setError: (error: string | null) => void;
  
  // 유틸리티 액션
  getFlow: (chainId: string, flowId: string) => Flow | null;
  getChain: (chainId: string) => FlowChain | null;
  getActiveChain: () => FlowChain | null;
  
  // 그래프 관련 액션
  getRootNodes: (chainId: string, flowId: string) => string[];
  getLeafNodes: (chainId: string, flowId: string) => string[];
  
  // 상태 초기화
  resetState: () => void;
}

// 초기 상태
const initialState = {
  chains: {},
  flows: {},
  activeChainId: null,
  stage: 'upload' as ExecutorStage,
  error: null,
  nodeFactory: new NodeFactory()
};

/**
 * 그래프 구조를 분석하여 노드 관계와 루트/리프 노드를 식별하는 유틸리티 함수
 */
const buildGraphStructure = (
  nodes: Node[], 
  edges: Edge[]
): {
  nodes: Record<string, GraphNode>;
  edges: Record<string, GraphEdge>;
  rootIds: string[];
  leafIds: string[];
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
  
  // 2. 엣지 맵 생성
  const edgeMap: Record<string, GraphEdge> = {};
  edges.forEach(edge => {
    edgeMap[edge.id] = {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      data: edge.data
    };
  });
  
  // 3. 소스 및 타겟 관계 분석
  const sources = new Set<string>();
  const targets = new Set<string>();
  
  // 모든 그룹 내 노드를 추적
  const nodesInGroups = new Set<string>();
  
  // 그룹 노드의 자식 관계 설정
  nodes.forEach(node => {
    if (node.type === 'group' && node.data?.nodeIds && Array.isArray(node.data.nodeIds)) {
      node.data.nodeIds.forEach((childId: string) => {
        if (nodeMap[childId]) {
          nodesInGroups.add(childId);
        }
      });
    }
  });
  
  // 엣지 기반 소스/타겟 관계 분석
  edges.forEach(edge => {
    if (edge.source) sources.add(edge.source);
    if (edge.target) targets.add(edge.target);
  });
  
  // 4. 루트 노드 식별 (부모가 없는 노드)
  const rootIds = Object.keys(nodeMap).filter(nodeId => 
    !nodesInGroups.has(nodeId) && !targets.has(nodeId)
  );
  
  // 5. 리프 노드 식별 (자식이 없는 노드)
  const leafIds = Object.keys(nodeMap).filter(nodeId => 
    !nodesInGroups.has(nodeId) && !sources.has(nodeId)
  );
  
  return {
    nodes: nodeMap,
    edges: edgeMap,
    rootIds,
    leafIds
  };
};

// Flow Executor 스토어 생성
export const useFlowExecutorStore = create<FlowExecutorState>()(
  persist(
    (set, get) => ({
      ...initialState,
      
      // Chain 관련 액션
      addChain: (name) => {
        const chainId = `chain-${uuidv4()}`;
        set(state => ({
          chains: {
            ...state.chains,
            [chainId]: {
              id: chainId,
              name: name || `Chain ${chainId.substring(0, 8)}`,
              status: 'idle',
              selectedFlowId: null,
              flowIds: []
            }
          }
        }));
        return chainId;
      },
      
      removeChain: (chainId) => {
        set(state => {
          // 삭제할 체인이 활성 체인인 경우 activeChainId도 초기화
          const newActiveChainId = state.activeChainId === chainId ? null : state.activeChainId;
          
          // 체인에 속한 모든 Flow의 ID 목록
          const flowIdsToRemove = state.chains[chainId]?.flowIds || [];
          
          // 새로운 flows 객체 (삭제할 Flow를 제외한 복사본)
          const newFlows = { ...state.flows };
          flowIdsToRemove.forEach(flowId => {
            delete newFlows[flowId];
          });
          
          // 새로운 chains 객체 (삭제할 체인을 제외한 복사본)
          const { [chainId]: _, ...remainingChains } = state.chains;
          
          return {
            chains: remainingChains,
            flows: newFlows,
            activeChainId: newActiveChainId
          };
        });
      },
      
      setChainName: (chainId, name) => {
        set(state => ({
          chains: {
            ...state.chains,
            [chainId]: state.chains[chainId]
              ? { ...state.chains[chainId], name }
              : undefined
          }
        }));
      },
      
      setChainStatus: (chainId, status, error) => {
        set(state => ({
          chains: {
            ...state.chains,
            [chainId]: state.chains[chainId]
              ? { 
                  ...state.chains[chainId], 
                  status,
                  ...(error !== undefined ? { error } : {})
                }
              : undefined
          }
        }));
      },
      
      setActiveChain: (chainId) => {
        set({ activeChainId: chainId });
      },
      
      // Flow 관련 액션
      addFlowToChain: (chainId, flowJson) => {
        const chain = get().chains[chainId];
        if (!chain) {
          console.error(`[FlowExecutorStore] Chain not found: ${chainId}`);
          return '';
        }
        
        // 새 Flow ID 생성
        const flowId = flowJson.id || `flow-${uuidv4()}`;
        
        // 그래프 구조 분석
        const { nodes, edges, rootIds, leafIds } = buildGraphStructure(
          flowJson.nodes || [], 
          flowJson.edges || []
        );
        
        // 새 Flow 생성
        const newFlow: Flow = {
          id: flowId,
          name: flowJson.name || `Flow ${flowId.substring(0, 8)}`,
          inputs: flowJson.inputs || [],
          results: null,
          status: 'idle',
          nodes,
          edges,
          rootIds,
          leafIds
        };
        
        // 상태 업데이트
        set(state => {
          const chain = state.chains[chainId];
          if (!chain) return state;
          
          return {
            flows: {
              ...state.flows,
              [flowId]: newFlow
            },
            chains: {
              ...state.chains,
              [chainId]: {
                ...chain,
                flowIds: [...chain.flowIds, flowId],
                selectedFlowId: chain.selectedFlowId || flowId // 첫 번째 Flow를 선택
              }
            }
          };
        });
        
        return flowId;
      },
      
      removeFlowFromChain: (chainId, flowId) => {
        set(state => {
          const chain = state.chains[chainId];
          if (!chain) return state;
          
          // Flow 목록에서 해당 Flow 제거
          const newFlowIds = chain.flowIds.filter(id => id !== flowId);
          
          // 새로운 selectedFlowId 결정
          let newSelectedFlowId = chain.selectedFlowId;
          if (chain.selectedFlowId === flowId) {
            newSelectedFlowId = newFlowIds.length > 0 ? newFlowIds[0] : null;
          }
          
          // 새로운 flows 객체 (삭제된 Flow 제외)
          const { [flowId]: _, ...remainingFlows } = state.flows;
          
          return {
            flows: remainingFlows,
            chains: {
              ...state.chains,
              [chainId]: {
                ...chain,
                flowIds: newFlowIds,
                selectedFlowId: newSelectedFlowId
              }
            }
          };
        });
      },
      
      setFlowStatus: (chainId, flowId, status, error) => {
        set(state => {
          const flow = state.flows[flowId];
          if (!flow) return state;
          
          return {
            flows: {
              ...state.flows,
              [flowId]: {
                ...flow,
                status,
                ...(error !== undefined ? { error } : {})
              }
            }
          };
        });
      },
      
      setFlowInputs: (chainId, flowId, inputs) => {
        set(state => {
          const flow = state.flows[flowId];
          if (!flow) return state;
          
          return {
            flows: {
              ...state.flows,
              [flowId]: {
                ...flow,
                inputs: deepClone(inputs)
              }
            }
          };
        });
      },
      
      setFlowResults: (chainId, flowId, results) => {
        set(state => {
          const flow = state.flows[flowId];
          if (!flow) return state;
          
          return {
            flows: {
              ...state.flows,
              [flowId]: {
                ...flow,
                results: deepClone(results)
              }
            }
          };
        });
      },
      
      setSelectedFlow: (chainId, flowId) => {
        set(state => {
          const chain = state.chains[chainId];
          if (!chain) return state;
          
          return {
            chains: {
              ...state.chains,
              [chainId]: {
                ...chain,
                selectedFlowId: flowId
              }
            }
          };
        });
      },
      
      moveFlow: (chainId, flowId, direction) => {
        set(state => {
          const chain = state.chains[chainId];
          if (!chain) return state;
          
          const currentIndex = chain.flowIds.indexOf(flowId);
          if (currentIndex === -1) return state;
          
          const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
          if (newIndex < 0 || newIndex >= chain.flowIds.length) return state;
          
          const newFlowIds = [...chain.flowIds];
          [newFlowIds[currentIndex], newFlowIds[newIndex]] = [newFlowIds[newIndex], newFlowIds[currentIndex]];
          
          return {
            chains: {
              ...state.chains,
              [chainId]: {
                ...chain,
                flowIds: newFlowIds
              }
            }
          };
        });
      },
      
      // 스테이지 관련 액션
      setStage: (stage) => {
        set({ stage });
      },
      
      // 오류 관련 액션
      setError: (error) => {
        set({ error });
      },
      
      // 유틸리티 액션
      getFlow: (chainId, flowId) => {
        const flow = get().flows[flowId];
        if (!flow) {
          console.log(`[FlowExecutorStore] Flow not found: ${flowId}`);
          return null;
        }
        return flow;
      },
      
      getChain: (chainId) => {
        const chain = get().chains[chainId];
        if (!chain) {
          console.log(`[FlowExecutorStore] Chain not found: ${chainId}`);
          return null;
        }
        return chain;
      },
      
      getActiveChain: () => {
        const { activeChainId, chains } = get();
        if (!activeChainId) return null;
        return chains[activeChainId] || null;
      },
      
      // 그래프 관련 액션
      getRootNodes: (chainId, flowId) => {
        const flow = get().flows[flowId];
        if (!flow) return [];
        return flow.rootIds;
      },
      
      getLeafNodes: (chainId, flowId) => {
        const flow = get().flows[flowId];
        if (!flow) return [];
        return flow.leafIds;
      },
      
      // 상태 초기화
      resetState: () => {
        set({
          ...initialState,
          nodeFactory: get().nodeFactory // NodeFactory 인스턴스 유지
        });
      }
    }),
    {
      name: 'flow-executor-store',
      partialize: (state) => ({
        chains: state.chains,
        flows: state.flows,
        activeChainId: state.activeChainId,
        stage: state.stage,
        // nodeFactory는 직렬화할 수 없으므로 제외
      })
    }
  )
); 