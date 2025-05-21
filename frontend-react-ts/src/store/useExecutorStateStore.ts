// DEPRECATED: Flow Executor는 useFlowExecutorStore만 사용하세요. 이 파일은 더 이상 직접 사용하지 마십시오.
import { useFlowExecutorStore } from './useFlowExecutorStore';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Node, Edge } from '@xyflow/react';
import { type FlowData } from '../utils/data/importExportUtils';
export type { FlowData } from '../utils/data/importExportUtils';
import { deepClone } from '../utils/helpers';
import { v4 as uuidv4 } from 'uuid';
import { NodeFactory } from '../core/NodeFactory';
import { Node as BaseNode } from '../core/Node';

export type ExecutorStage = 'upload' | 'input' | 'executing' | 'result';
export type ExecutionStatus = 'idle' | 'running' | 'success' | 'error';

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
  isGroupNode: boolean;
}

// Flow 내 개별 노드의 실행 상태
export interface FlowNodeExecutionState {
  status: ExecutionStatus;
  result?: any;
  error?: string;
  // 필요에 따라 executionId, lastTriggerNodeId 등을 추가할 수 있습니다.
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
  nodes: Record<string, GraphNode>;
  graph: Record<string, NodeRelation>;
  roots: string[];
  leafs: string[];
  nodeStates: Record<string, FlowNodeExecutionState>; // Executor에서 실행 시 각 노드의 상태
}

// Flow Chain의 정보
export interface FlowChain {
  id: string;
  name: string;
  status: ExecutionStatus;
  selectedFlowId: string | null;  // 체이닝에 사용될 Flow의 ID
  flowIds: string[];  // 실행 순서
  error?: string;
  inputs: any[]; // Flow Chain 전체의 입력 (추가)
}

// 정규화된 스토어 상태
interface ExecutorState {
  // 엔티티 컬렉션 (정규화된 데이터)
  chains: Record<string, FlowChain>;
  flows: Record<string, Flow>;
  
  // 순서 및 참조 데이터
  chainIds: string[];  // Chain 순서 유지
  activeChainId: string | null;
  stage: ExecutorStage;
  error: string | null;
  nodeFactory: NodeFactory; // 그래프 노드 생성 팩토리

  // Flow Chain 관련 액션
  addFlowChain: (name: string) => string; // 생성된 chain-id 반환
  removeFlowChain: (id: string) => void;
  setFlowChainName: (id: string, name: string) => void;
  addFlowToChain: (chainId: string, flowJson: FlowData) => string; // 생성된 flow-id 반환
  removeFlowFromChain: (chainId: string, flowId: string) => void;
  setFlowChainStatus: (chainId: string, status: ExecutionStatus, error?: string) => void;
  setFlowStatus: (chainId: string, flowId: string, status: ExecutionStatus, error?: string) => void;
  setSelectedFlow: (chainId: string, flowId: string | null) => void;
  moveFlow: (chainId: string, flowId: string, direction: 'up' | 'down') => void;
  setFlowInputs: (chainId: string, flowId: string, inputs: any[]) => void;
  setFlowChainInputs: (chainId: string, inputs: any[]) => void; // Flow Chain 입력 설정 액션 (추가)
  setFlowResults: (chainId: string, flowId: string, results: any[]) => void;
  setFlowNodeState: (chainId: string, flowId: string, nodeId: string, nodeState: FlowNodeExecutionState) => void;
  getFlowNodeState: (chainId: string, flowId: string, nodeId: string) => FlowNodeExecutionState | undefined;
  setActiveChainId: (id: string | null) => void;
  
  // 상태 관리
  setStage: (stage: ExecutorStage) => void;
  setError: (error: string | null) => void;
  resetState: () => void;
  
  // 모든 플로우의 결과 초기화
  resetResults: () => void;
  
  // 편의 함수
  getFlow: (chainId: string, flowId: string) => Flow | undefined;
  getFlowChain: (chainId: string) => FlowChain | undefined;
  getActiveFlowChain: () => FlowChain | undefined;
  
  // 그래프 데이터 접근 함수
  getRootNodes: (chainId: string, flowId: string) => string[];
  getLeafNodes: (chainId: string, flowId: string) => string[];
  getNodeInstance: (chainId: string, flowId: string, nodeId: string) => BaseNode | null;
}

/**
 * 그래프 구조 분석 함수 - 부모/자식 관계 및 루트/리프 노드 식별
 */
const buildGraphStructure = (nodes: Node[], edges: Edge[]): {
  nodeMap: Record<string, GraphNode>;
  graphRelations: Record<string, NodeRelation>;
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
  
  // 모든 노드에 대해 관계 구조 생성
  nodes.forEach(node => {
    graphRelations[node.id] = {
      parents: [],
      childs: []
    };
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
    roots,
    leafs
  };
};

const initialState = {
  chains: {},
  flows: {},
  chainIds: [],
  activeChainId: null,
  stage: 'upload' as ExecutorStage,
  error: null,
  nodeFactory: new NodeFactory()
};

export const useExecutorStateStore = create<ExecutorState>()(
  persist(
    (set, get) => ({
      // 정규화된 상태
      ...initialState,

      // Flow Chain 관련 액션
      addFlowChain: (name) => {
        const id = `chain-${uuidv4()}`;
        set((state) => {
          return {
            chains: {
              ...state.chains,
              [id]: {
                id,
                name,
                status: 'idle',
                selectedFlowId: null,
                flowIds: [],
                error: undefined,
                inputs: [] // inputs 초기화 (추가)
              }
            },
            chainIds: [...state.chainIds, id],
            activeChainId: state.activeChainId || id
          };
        });
        return id;
      },

      removeFlowChain: (id) => set((state) => {
        const { [id]: removed, ...remainingChains } = state.chains;
        
        // Chain에 속한 Flow들도 제거
        const flowsToRemove = state.chains[id]?.flowIds || [];
        const newFlows = { ...state.flows };
        
        flowsToRemove.forEach(flowId => {
          delete newFlows[flowId];
        });
        
        // chainIds 업데이트
        const newChainIds = state.chainIds.filter(chainId => chainId !== id);
        
        // activeChainId 조정
        let newActiveChainId = state.activeChainId;
        if (newActiveChainId === id) {
          newActiveChainId = newChainIds.length > 0 ? newChainIds[0] : null;
        }
        
        return {
          chains: remainingChains,
          flows: newFlows,
          chainIds: newChainIds,
          activeChainId: newActiveChainId
        };
      }),

      setFlowChainName: (id, name) => set((state) => {
        const chain = state.chains[id];
        if (!chain) return state;
        
        return {
          chains: {
            ...state.chains,
            [id]: { ...chain, name }
          }
        };
      }),

      addFlowToChain: (chainId, flowJson) => {
        const flowId = (flowJson as any).id || `flow-${uuidv4()}`;
        
        // 그래프 구조 분석
        const { nodeMap, graphRelations, roots, leafs } = buildGraphStructure(
          flowJson.nodes || [],
          flowJson.edges || []
        );
        
        set((state) => {
          // Chain이 없으면 상태 변경 없음
          if (!state.chains[chainId]) return state;
          
          const chain = state.chains[chainId];
          
          // 새로운 Flow 생성
          const newFlow: Flow = {
            id: flowId,
            chainId,
            name: flowJson.name || `Flow ${flowId.substring(0, 8)}`,
            flowJson: deepClone(flowJson),
            inputs: [],
            lastResults: null,
            status: 'idle',
            nodes: nodeMap,
            graph: graphRelations,
            roots,
            leafs,
            nodeStates: {} // nodeStates 초기화
          };
          
          // 상태 업데이트
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
                selectedFlowId: chain.selectedFlowId || flowId
              }
            }
          };
        });
        
        return flowId;
      },

      removeFlowFromChain: (chainId, flowId) => set((state) => {
        // Chain이 없으면 상태 변경 없음
        if (!state.chains[chainId]) return state;
        
        const chain = state.chains[chainId];
        
        // flowIds에서 제거
        const newFlowIds = chain.flowIds.filter(id => id !== flowId);
        
        // selectedFlowId 조정
        let newSelectedFlowId = chain.selectedFlowId;
        if (chain.selectedFlowId === flowId) {
          newSelectedFlowId = newFlowIds.length > 0 ? newFlowIds[0] : null;
        }
        
        // Flow 엔티티 제거
        const { [flowId]: removed, ...remainingFlows } = state.flows;
        
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
      }),

      setFlowChainStatus: (chainId, status, error) => set((state) => {
        const chain = state.chains[chainId];
        if (!chain) return state;
        
        return {
          chains: {
            ...state.chains,
            [chainId]: { 
              ...chain, 
              status,
              ...(error !== undefined ? { error } : {})
            }
          }
        };
      }),

      setFlowStatus: (chainId, flowId, status, error) => set((state) => {
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
      }),

      setSelectedFlow: (chainId, flowId) => set((state) => {
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
      }),

      moveFlow: (chainId, flowId, direction) => set((state) => {
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
      }),

      setFlowInputs: (chainId, flowId, inputs) => set((state) => {
        const flow = state.flows[flowId];
        if (!flow || flow.chainId !== chainId) return state; // flow.chainId 조건 추가
        
        return {
          flows: {
            ...state.flows,
            [flowId]: {
              ...flow,
              inputs: deepClone(inputs)
            }
          }
        };
      }),

      setFlowChainInputs: (chainId, inputs) => set((state) => { // 액션 구현 (추가)
        const chain = state.chains[chainId];
        if (!chain) return state;

        return {
          chains: {
            ...state.chains,
            [chainId]: {
              ...chain,
              inputs: deepClone(inputs)
            }
          }
        };
      }),

      setFlowResults: (chainId, flowId, results) => set((state) => {
        const flow = state.flows[flowId];
        if (!flow) return state;
        
        // Handle null/undefined results case
        if (results === null || results === undefined) {
          console.warn(`[useExecutorStateStore] 결과가 null/undefined입니다: Flow ${flowId} (${flow.name})`);
          return {
            flows: {
              ...state.flows,
              [flowId]: {
                ...flow,
                lastResults: [] // Use empty array instead of null
              }
            }
          };
        }
        
        // 결과가 객체인지 확인하고 필요한 구조로 변환
        let normalizedResults = results;
        
        // 결과가 배열이 아니고 객체인 경우, 배열로 변환
        if (!Array.isArray(normalizedResults) && typeof normalizedResults === 'object' && normalizedResults !== null) {
          // 타입 단언을 사용하여 'outputs' 속성에 안전하게 접근
          const resultObj = normalizedResults as {outputs?: any};
          if (resultObj.outputs !== undefined) {
            // If outputs exists but is null, use empty array
            if (resultObj.outputs === null) {
              normalizedResults = [];
            } else {
              // 이미 적절한 구조인 경우 그대로 사용
              normalizedResults = resultObj.outputs;
            }
          } else {
            // 기타 객체인 경우 배열로 변환
            normalizedResults = [normalizedResults];
          }
        } else if (!Array.isArray(normalizedResults)) {
          // 배열이 아닌 기본 값인 경우 배열로 감싸기
          normalizedResults = [normalizedResults];
        }
        
        // 결과 로그 출력
        console.log(`[useExecutorStateStore] 결과 저장: Flow ${flowId} (${flow.name}), 결과:`, normalizedResults);
        
        return {
          flows: {
            ...state.flows,
            [flowId]: {
              ...flow,
              lastResults: normalizedResults
            }
          }
        };
      }),

      setFlowNodeState: (chainId, flowId, nodeId, nodeState) => set((state) => {
        const flow = state.flows[flowId];
        if (!flow || flow.chainId !== chainId) return state;

        return {
          flows: {
            ...state.flows,
            [flowId]: {
              ...flow,
              nodeStates: {
                ...flow.nodeStates,
                [nodeId]: deepClone(nodeState)
              }
            }
          }
        };
      }),

      getFlowNodeState: (chainId, flowId, nodeId) => {
        const flow = get().flows[flowId];
        if (!flow || flow.chainId !== chainId) return undefined;
        return flow.nodeStates[nodeId];
      },

      setActiveChainId: (id) => set({ activeChainId: id }),
      
      setStage: (stage) => set({ stage }),
      
      setError: (error) => set({ error }),
      
      resetState: () => set({
        ...initialState,
        nodeFactory: get().nodeFactory // NodeFactory 인스턴스 유지
      }),
      
      // 모든 플로우의 결과 초기화
      resetResults: () => set((state) => {
        const updatedFlows = { ...state.flows };
        
        // 모든 플로우의 lastResults를 null로 설정
        Object.keys(updatedFlows).forEach(flowId => {
          updatedFlows[flowId] = {
            ...updatedFlows[flowId],
            lastResults: null,
            status: 'idle',
            error: undefined
          };
        });
        
        // 모든 체인의 상태도 초기화
        const updatedChains = { ...state.chains };
        Object.keys(updatedChains).forEach(chainId => {
          updatedChains[chainId] = {
            ...updatedChains[chainId],
            status: 'idle',
            error: undefined
          };
        });
        
        console.log('[useExecutorStateStore] 모든 플로우 결과 초기화 완료');
        
        return {
          flows: updatedFlows,
          chains: updatedChains
        };
      }),
      
      // 편의 함수
      getFlow: (chainId, flowId) => {
        return get().flows[flowId];
      },
      
      getFlowChain: (chainId) => {
        return get().chains[chainId];
      },
      
      getActiveFlowChain: () => {
        const { activeChainId, chains } = get();
        if (!activeChainId) return undefined;
        return chains[activeChainId];
      },
      
      // 그래프 데이터 접근 함수
      getRootNodes: (chainId, flowId) => {
        const flow = get().flows[flowId];
        return flow?.roots || [];
      },
      
      getLeafNodes: (chainId, flowId) => {
        const flow = get().flows[flowId];
        return flow?.leafs || [];
      },
      
      getNodeInstance: (chainId, flowId, nodeId) => {
        const flow = get().flows[flowId];
        if (!flow) return null;
        
        const nodeFactory = get().nodeFactory;
        const nodeData = flow.nodes[nodeId];
        
        if (!nodeData) return null;
        
        try {
          return nodeFactory.create(
            nodeId,
            nodeData.type,
            nodeData.data,
            undefined // 실행 시 컨텍스트 주입
          );
        } catch (error) {
          console.error(`Failed to create node instance: ${error}`);
          return null;
        }
      }
    }),
    {
      name: 'executor-state-store',
      partialize: (state) => ({
        chains: state.chains,
        flows: state.flows,
        chainIds: state.chainIds,
        activeChainId: state.activeChainId,
        stage: state.stage,
        // nodeFactory는 직렬화할 수 없으므로 제외
      })
    }
  )
); 

export default useFlowExecutorStore; 