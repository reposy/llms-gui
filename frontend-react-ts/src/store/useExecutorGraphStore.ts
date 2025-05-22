// DEPRECATED: Flow Executor는 useFlowExecutorStore만 사용하세요. 이 파일은 더 이상 직접 사용하지 마십시오.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Node, Edge } from '@xyflow/react';
import { FlowData } from '../utils/data/importExportUtils';
import { NodeFactory } from '../core/NodeFactory';
import { Node as BaseNode } from '../core/Node';
import { GroupNode } from '../core/GroupNode';
import { deepClone } from '../utils/helpers';
import { v4 as uuidv4 } from 'uuid';
import { useFlowExecutorStore } from './useFlowExecutorStore';

// 그래프 노드 관계 정보 인터페이스
interface NodeRelation {
  parents: string[];  // 부모 노드 ID 목록
  childs: string[];   // 자식 노드 ID 목록
}

// 그래프 노드 정보 인터페이스
interface GraphNode {
  id: string;
  type: string;
  data: any;
  position: { x: number, y: number };
  parentNodeId: string | null;
  nodeInstance?: BaseNode;
  isGroupNode: boolean;
}

// 플로우 구조 인터페이스 (Flow 단위)
interface FlowStructure {
  id: string;
  name: string;
  nodes: Record<string, GraphNode>;
  graph: Record<string, NodeRelation>;
  nodeInstances: Record<string, BaseNode>;
  roots: string[];
  leafs: string[];
  lastResult?: any;
  status: 'idle' | 'running' | 'success' | 'error';
  inputs?: any[];
  error?: string;
}

// 플로우 체인 인터페이스 (Chain 단위)
interface FlowChain {
  id: string;
  name: string;
  flowIds: string[];
  flows: Record<string, FlowStructure>;
  status: 'idle' | 'running' | 'success' | 'error';
  selectedFlowId: string | null;
  error?: string;
}

// 스토어 상태 인터페이스
interface ExecutorGraphState {
  // Flow Chain 관리
  flowChainMap: Record<string, FlowChain>;
  flowChainIds: string[];
  activeChainId: string | null;
  nodeFactory: NodeFactory;
  
  // 체인 관리 함수
  addChain: (name: string) => string;
  removeChain: (chainId: string) => void;
  setChainName: (chainId: string, name: string) => void;
  setChainStatus: (chainId: string, status: FlowChain['status'], error?: string) => void;
  setSelectedFlow: (chainId: string, flowId: string | null) => void;
  setActiveChain: (chainId: string | null) => void;
  getChain: (chainId: string) => FlowChain | null;
  
  // Flow 관리 함수
  addFlowToChain: (chainId: string, flowData: FlowData) => string;
  removeFlowFromChain: (chainId: string, flowId: string) => void;
  setFlowName: (chainId: string, flowId: string, name: string) => void;
  setFlowStatus: (chainId: string, flowId: string, status: FlowStructure['status'], error?: string) => void;
  setFlowInputs: (chainId: string, flowId: string, inputs: any[]) => void;
  getFlow: (chainId: string, flowId: string) => FlowStructure | null;
  moveFlow: (chainId: string, flowId: string, direction: 'up' | 'down') => void;
  
  // 그래프 데이터 접근 함수
  getRootNodes: (chainId: string, flowId: string) => string[];
  getLeafNodes: (chainId: string, flowId: string) => string[];
  getNodeInstance: (chainId: string, flowId: string, nodeId: string) => BaseNode | null;
  
  // 결과 관리
  setFlowResult: (chainId: string, flowId: string, result: any) => void;
  getFlowResult: (chainId: string, flowId: string) => any;
  
  // 초기화
  resetState: () => void;
  resetResults: () => void;
  resetFlowGraphs: () => void;
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
      parentNodeId: node.parentNode || null,
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
        null // 컨텍스트는 실행 시점에 주입
      );
      
      nodeInstances[node.id] = nodeInstance;
      nodeMap[node.id].nodeInstance = nodeInstance;
    } catch (error) {
      console.error(`[ExecutorGraphStore] Failed to create node instance for ${node.id}:`, error);
    }
  });
  
  // 3. 그룹 노드 및 내부 노드 관계 설정
  const nodesInGroups = new Set<string>();
  nodes.forEach(node => {
    if (node.type === 'group' && node.data?.nodeIds) {
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
  flowChainMap: {},
  flowChainIds: [],
  activeChainId: null,
  nodeFactory: new NodeFactory()
};

// 스토어 생성
export const useExecutorGraphStore = create<ExecutorGraphState>()(
  persist(
    (set, get) => ({
      ...initialState,
      
      // 체인 관리 함수
      addChain: (name) => {
        const chainId = `chain-${uuidv4()}`;
        
        set(state => {
          const newChains = {
            ...state.flowChainMap,
            [chainId]: {
              id: chainId,
              name,
              flowIds: [],
              flows: {},
              status: 'idle',
              selectedFlowId: null
            }
          };
          
          console.log(`[ExecutorGraphStore] Adding new chain: ${chainId}, name: ${name}`);
          console.log(`[ExecutorGraphStore] Current chains before update:`, Object.keys(state.flowChainMap));
          
          return {
            flowChainMap: newChains,
            flowChainIds: [...state.flowChainIds, chainId],
            activeChainId: state.activeChainId || chainId
          };
        });
        
        // 상태 업데이트 확인
        const updatedState = useExecutorGraphStore.getState();
        const chain = updatedState.flowChainMap[chainId];
        
        if (!chain) {
          console.warn(`[ExecutorGraphStore] Chain ${chainId} was not immediately available after creation`);
        } else {
          console.log(`[ExecutorGraphStore] Chain ${chainId} successfully created and available`);
        }
        
        return chainId;
      },
      
      removeChain: (chainId) => {
        set(state => {
          const { [chainId]: removed, ...remainingChains } = state.flowChainMap;
          const newChainIds = state.flowChainIds.filter(id => id !== chainId);
          
          // activeChainId 조정
          let newActiveChainId = state.activeChainId;
          if (newActiveChainId === chainId) {
            newActiveChainId = newChainIds.length > 0 ? newChainIds[0] : null;
          }
          
          return {
            flowChainMap: remainingChains,
            flowChainIds: newChainIds,
            activeChainId: newActiveChainId
          };
        });
      },
      
      setChainName: (chainId, name) => {
        set(state => {
          const chain = state.flowChainMap[chainId];
          if (!chain) return state;
          
          return {
            flowChainMap: {
              ...state.flowChainMap,
              [chainId]: {
                ...chain,
                name
              }
            }
          };
        });
      },
      
      setChainStatus: (chainId, status, error) => {
        set(state => {
          const chain = state.flowChainMap[chainId];
          if (!chain) return state;
          
          return {
            flowChainMap: {
              ...state.flowChainMap,
              [chainId]: {
                ...chain,
                status,
                error: status === 'error' ? error : undefined
              }
            }
          };
        });
      },
      
      setSelectedFlow: (chainId, flowId) => {
        set(state => {
          const chain = state.flowChainMap[chainId];
          if (!chain) return state;
          
          return {
            flowChainMap: {
              ...state.flowChainMap,
              [chainId]: {
                ...chain,
                selectedFlowId: flowId
              }
            }
          };
        });
      },
      
      setActiveChain: (chainId) => {
        set({ activeChainId: chainId });
      },
      
      getChain: (chainId) => {
        const state = get();
        if (!chainId || !state.flowChainMap) {
          console.warn(`[ExecutorGraphStore] Invalid chainId or flowChainMap not initialized`);
          return null;
        }
        
        const chain = state.flowChainMap[chainId];
        if (!chain) {
          console.warn(`[ExecutorGraphStore] Chain ${chainId} not found in flowChainMap`);
        }
        
        return chain || null;
      },
      
      // Flow 관리 함수
      addFlowToChain: (chainId, flowData) => {
        const flowId = `flow-${uuidv4()}`;
        
        // 현재 상태 확인
        const currentState = useExecutorGraphStore.getState();
        const existingChain = currentState.flowChainMap[chainId];
        
        if (!existingChain) {
          console.warn(`[ExecutorGraphStore] addFlowToChain: Chain ${chainId} not found before update`);
        }
        
        set(state => {
          const chain = state.flowChainMap[chainId];
          if (!chain) {
            console.error(`[ExecutorGraphStore] addFlowToChain: Chain ${chainId} not found, cannot add flow`);
            return state;
          }
          
          // 깊은 복사로 사이드 이펙트 방지
          const flowDataClone = deepClone(flowData);
          const { nodeMap, graphRelations, nodeInstances, roots, leafs } = buildGraphStructure(
            flowDataClone.nodes || [],
            flowDataClone.edges || [],
            state.nodeFactory
          );
          
          // 새 Flow 구조 생성
          const flowStructure: FlowStructure = {
            id: flowId,
            name: flowData.name || `Flow ${Object.keys(chain.flows).length + 1}`,
            nodes: nodeMap,
            graph: graphRelations,
            nodeInstances,
            roots,
            leafs,
            status: 'idle'
          };
          
          console.log(`[ExecutorGraphStore] addFlowToChain: Adding flow to chain ${chainId}, generated new flowId: ${flowId}`);
          console.log(`[ExecutorGraphStore] addFlowToChain: Flow data summary: nodes=${flowDataClone.nodes?.length || 0}, edges=${flowDataClone.edges?.length || 0}, roots=${roots.length}`);
          
          const updatedChain = {
            ...chain,
            flows: {
              ...chain.flows,
              [flowId]: flowStructure
            },
            flowIds: [...chain.flowIds, flowId]
          };
          
          console.log(`[ExecutorGraphStore] Chain ${chainId} now has ${updatedChain.flowIds.length} flows:`, updatedChain.flowIds);
          
          return {
            flowChainMap: {
              ...state.flowChainMap,
              [chainId]: updatedChain
            }
          };
        });
        
        // 상태 업데이트 확인
        const updatedState = useExecutorGraphStore.getState();
        const updatedChain = updatedState.flowChainMap[chainId];
        
        if (!updatedChain) {
          console.warn(`[ExecutorGraphStore] Chain ${chainId} not available after flow addition`);
          return flowId; // 오류가 있어도 flowId는 반환해야함
        }
        
        const flow = updatedChain.flows[flowId];
        if (!flow) {
          console.warn(`[ExecutorGraphStore] Flow ${flowId} not found in chain ${chainId} after addition`);
          console.log(`[ExecutorGraphStore] Available flows in chain:`, Object.keys(updatedChain.flows));
        } else {
          console.log(`[ExecutorGraphStore] Flow ${flowId} successfully added to chain ${chainId}`);
        }
        
        console.log(`[ExecutorGraphStore] Created new flow in chain ${chainId}:`, flowId);
        return flowId;
      },
      
      removeFlowFromChain: (chainId, flowId) => {
        set(state => {
          const chain = state.flowChainMap[chainId];
          if (!chain) return state;
          
          const { [flowId]: removed, ...remainingFlows } = chain.flows;
          
          return {
            flowChainMap: {
              ...state.flowChainMap,
              [chainId]: {
                ...chain,
                flows: remainingFlows,
                flowIds: chain.flowIds.filter(id => id !== flowId),
                selectedFlowId: chain.selectedFlowId === flowId ? null : chain.selectedFlowId
              }
            }
          };
        });
      },
      
      setFlowName: (chainId, flowId, name) => {
        set(state => {
          const chain = state.flowChainMap[chainId];
          if (!chain) return state;
          
          const flow = chain.flows[flowId];
          if (!flow) return state;
          
          return {
            flowChainMap: {
              ...state.flowChainMap,
              [chainId]: {
                ...chain,
                flows: {
                  ...chain.flows,
                  [flowId]: {
                    ...flow,
                    name
                  }
                }
              }
            }
          };
        });
      },
      
      setFlowStatus: (chainId, flowId, status, error) => {
        set(state => {
          const chain = state.flowChainMap[chainId];
          if (!chain) return state;
          
          const flow = chain.flows[flowId];
          if (!flow) return state;
          
          return {
            flowChainMap: {
              ...state.flowChainMap,
              [chainId]: {
                ...chain,
                flows: {
                  ...chain.flows,
                  [flowId]: {
                    ...flow,
                    status,
                    error: status === 'error' ? error : undefined
                  }
                }
              }
            }
          };
        });
      },
      
      setFlowInputs: (chainId, flowId, inputs) => {
        set(state => {
          const chain = state.flowChainMap[chainId];
          if (!chain) return state;
          
          const flow = chain.flows[flowId];
          if (!flow) return state;
          
          return {
            flowChainMap: {
              ...state.flowChainMap,
              [chainId]: {
                ...chain,
                flows: {
                  ...chain.flows,
                  [flowId]: {
                    ...flow,
                    inputs: deepClone(inputs)
                  }
                }
              }
            }
          };
        });
      },
      
      getFlow: (chainId, flowId) => {
        const state = get();
        const chain = state.flowChainMap[chainId];
        if (!chain) {
          console.log(`[ExecutorGraphStore] getFlow: Chain not found: ${chainId}`);
          return null;
        }
        
        const flow = chain.flows[flowId];
        if (!flow) {
          console.log(`[ExecutorGraphStore] getFlow: Flow not found in chain ${chainId}, looking for flowId: ${flowId}`);
          console.log(`[ExecutorGraphStore] getFlow: Available flows in chain:`, Object.keys(chain.flows));
          return null;
        }
        
        console.log(`[ExecutorGraphStore] getFlow: Found flow ${flowId} in chain ${chainId}, status: ${flow.status}, rootNodes: ${flow.roots.length}`);
        return flow;
      },
      
      moveFlow: (chainId, flowId, direction) => {
        set(state => {
          const chain = state.flowChainMap[chainId];
          if (!chain) return state;
          
          const currentIndex = chain.flowIds.indexOf(flowId);
          if (currentIndex === -1) return state;
          
          const newFlowIds = [...chain.flowIds];
          
          if (direction === 'up' && currentIndex > 0) {
            // 위로 이동
            [newFlowIds[currentIndex], newFlowIds[currentIndex - 1]] = 
            [newFlowIds[currentIndex - 1], newFlowIds[currentIndex]];
          } else if (direction === 'down' && currentIndex < chain.flowIds.length - 1) {
            // 아래로 이동
            [newFlowIds[currentIndex], newFlowIds[currentIndex + 1]] = 
            [newFlowIds[currentIndex + 1], newFlowIds[currentIndex]];
          } else {
            // 이동 불가
            return state;
          }
          
          return {
            flowChainMap: {
              ...state.flowChainMap,
              [chainId]: {
                ...chain,
                flowIds: newFlowIds
              }
            }
          };
        });
      },
      
      // 그래프 데이터 접근 함수
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
        return flow ? flow.nodeInstances[nodeId] || null : null;
      },
      
      // 결과 관리
      setFlowResult: (chainId, flowId, result) => {
        set(state => {
          const chain = state.flowChainMap[chainId];
          if (!chain) return state;
          
          const flow = chain.flows[flowId];
          if (!flow) return state;
          
          return {
            flowChainMap: {
              ...state.flowChainMap,
              [chainId]: {
                ...chain,
                flows: {
                  ...chain.flows,
                  [flowId]: {
                    ...flow,
                    lastResult: result
                  }
                }
              }
            }
          };
        });
      },
      
      getFlowResult: (chainId, flowId) => {
        const flow = get().getFlow(chainId, flowId);
        return flow ? flow.lastResult : null;
      },
      
      // 초기화
      resetState: () => {
        set({
          flowChainMap: {},
          flowChainIds: [],
          activeChainId: null
        });
      },
      
      // resetState와 동일한 기능을 수행하는 별칭 함수
      resetFlowGraphs: () => {
        set({
          flowChainMap: {},
          flowChainIds: [],
          activeChainId: null
        });
      },
      
      // 모든 플로우의 결과 초기화
      resetResults: () => set(state => {
        // 복사된 flowChainMap 객체 생성
        const updatedFlowChainMap = { ...state.flowChainMap };
        
        // 각 체인의 각 플로우에 대해 결과 및 상태 초기화
        Object.keys(updatedFlowChainMap).forEach(chainId => {
          const chain = updatedFlowChainMap[chainId];
          const updatedFlows = { ...chain.flows };
          
          Object.keys(updatedFlows).forEach(flowId => {
            updatedFlows[flowId] = {
              ...updatedFlows[flowId],
              lastResult: null,
              status: 'idle',
              error: undefined
            };
          });
          
          updatedFlowChainMap[chainId] = {
            ...chain,
            flows: updatedFlows,
            status: 'idle',
            error: undefined
          };
        });
        
        console.log('[useExecutorGraphStore] 모든 플로우 결과 초기화 완료');
        
        return {
          flowChainMap: updatedFlowChainMap
        };
      })
    }),
    {
      name: 'executor-graph-storage'
    }
  )
);

export default useFlowExecutorStore; 