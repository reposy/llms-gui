import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { FlowData } from '../utils/data/importExportUtils';
import { useExecutorGraphStore } from './useExecutorGraphStore';

type ExecutorStage = 'upload' | 'input' | 'executing' | 'result';

// Flow 항목 인터페이스
interface FlowItem {
  id: string;
  name: string;
  flowJson: FlowData;
  inputData: any[];
  result: any | null;
}

interface ExecutorState {
  // Flow 체인 데이터
  flowChain: FlowItem[];
  
  // 현재 선택된/활성화된 Flow 인덱스
  activeFlowIndex: number;
  
  // 현재 단계
  stage: ExecutorStage;
  
  // 오류 메시지
  error: string | null;
  
  // 체인 상태 설정 함수
  addFlow: (flowJson: FlowData) => void;
  removeFlow: (id: string) => void;
  moveFlowUp: (id: string) => void;
  moveFlowDown: (id: string) => void;
  setFlowInputData: (id: string, inputData: any[]) => void;
  setFlowResult: (id: string, result: any | null) => void;
  
  // 현재 활성 Flow 설정
  setActiveFlowIndex: (index: number) => void;
  
  // 기타 상태 설정 함수
  setStage: (stage: ExecutorStage) => void;
  setError: (error: string | null) => void;
  
  // 상태 초기화 함수
  resetState: () => void;
  resetResults: () => void;
  
  // 편의 함수
  getFlowById: (id: string) => FlowItem | undefined;
  getFlowResultById: (id: string) => any | null;
  getActiveFlow: () => FlowItem | null;
}

// 초기 상태
const initialState = {
  flowChain: [],
  activeFlowIndex: 0,
  stage: 'upload' as ExecutorStage,
  error: null
};

// 고유 ID 생성 함수
const generateId = () => `flow-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

export const useExecutorStateStore = create<ExecutorState>()(
  persist(
    (set, get) => ({
      ...initialState,
      
      // Flow 체인 관리 함수
      addFlow: (flowJson) => set((state) => {
        const newFlow: FlowItem = {
          id: generateId(),
          name: flowJson.name || `Flow ${state.flowChain.length + 1}`,
          flowJson,
          inputData: [],
          result: null
        };
        
        // 그래프 스토어에 Flow 그래프 정보 저장
        const graphStore = useExecutorGraphStore.getState();
        graphStore.setFlowGraph(newFlow.id, flowJson);
        
        return {
          flowChain: [...state.flowChain, newFlow],
          stage: state.stage === 'upload' ? 'input' : state.stage
        };
      }),
      
      removeFlow: (id) => set((state) => {
        const newFlowChain = state.flowChain.filter(flow => flow.id !== id);
        let newActiveFlowIndex = state.activeFlowIndex;
        
        // 현재 활성 Flow가 삭제된 경우 인덱스 조정
        if (newFlowChain.length <= newActiveFlowIndex) {
          newActiveFlowIndex = Math.max(0, newFlowChain.length - 1);
        }
        
        // 그래프 스토어에서도 Flow 정보 제거
        // (getFlowGraph 함수를 사용하기 때문에 명시적 제거는 필요 없으나, 메모리 관리 차원에서 추가)
        
        return {
          flowChain: newFlowChain,
          activeFlowIndex: newActiveFlowIndex,
          stage: newFlowChain.length === 0 ? 'upload' : state.stage
        };
      }),
      
      moveFlowUp: (id) => set((state) => {
        const index = state.flowChain.findIndex(flow => flow.id === id);
        if (index <= 0) return state; // 이미 첫 번째이거나 존재하지 않음
        
        const newFlowChain = [...state.flowChain];
        const temp = newFlowChain[index];
        newFlowChain[index] = newFlowChain[index - 1];
        newFlowChain[index - 1] = temp;
        
        // 활성 Flow가 이동된 경우 인덱스 조정
        let newActiveFlowIndex = state.activeFlowIndex;
        if (index === state.activeFlowIndex) {
          newActiveFlowIndex = index - 1;
        } else if (index - 1 === state.activeFlowIndex) {
          newActiveFlowIndex = index;
        }
        
        return {
          flowChain: newFlowChain,
          activeFlowIndex: newActiveFlowIndex
        };
      }),
      
      moveFlowDown: (id) => set((state) => {
        const index = state.flowChain.findIndex(flow => flow.id === id);
        if (index === -1 || index >= state.flowChain.length - 1) return state; // 이미 마지막이거나 존재하지 않음
        
        const newFlowChain = [...state.flowChain];
        const temp = newFlowChain[index];
        newFlowChain[index] = newFlowChain[index + 1];
        newFlowChain[index + 1] = temp;
        
        // 활성 Flow가 이동된 경우 인덱스 조정
        let newActiveFlowIndex = state.activeFlowIndex;
        if (index === state.activeFlowIndex) {
          newActiveFlowIndex = index + 1;
        } else if (index + 1 === state.activeFlowIndex) {
          newActiveFlowIndex = index;
        }
        
        return {
          flowChain: newFlowChain,
          activeFlowIndex: newActiveFlowIndex
        };
      }),
      
      setFlowInputData: (id, inputData) => set((state) => {
        const newFlowChain = state.flowChain.map(flow => 
          flow.id === id ? { ...flow, inputData } : flow
        );
        
        return { flowChain: newFlowChain };
      }),
      
      setFlowResult: (id, result) => set((state) => {
        const newFlowChain = state.flowChain.map(flow => 
          flow.id === id ? { ...flow, result } : flow
        );
        
        return { flowChain: newFlowChain };
      }),
      
      // 활성 Flow 인덱스 설정
      setActiveFlowIndex: (index) => set({ activeFlowIndex: index }),
      
      // 상태 설정 함수
      setStage: (stage) => set({ stage }),
      setError: (error) => set({ error }),
      
      // 상태 초기화 함수
      resetState: () => {
        // 그래프 스토어 초기화
        useExecutorGraphStore.getState().resetFlowGraphs();
        
        // 실행기 상태 초기화
        set(initialState);
      },
      
      resetResults: () => set((state) => {
        const newFlowChain = state.flowChain.map(flow => ({
          ...flow,
          result: null
        }));
        
        return {
          flowChain: newFlowChain,
          stage: 'input',
          error: null
        };
      }),
      
      // 편의 함수
      getFlowById: (id) => {
        return get().flowChain.find(flow => flow.id === id);
      },
      
      getFlowResultById: (id) => {
        const flow = get().flowChain.find(flow => flow.id === id);
        return flow ? flow.result : null;
      },
      
      getActiveFlow: () => {
        const { flowChain, activeFlowIndex } = get();
        return flowChain.length > 0 && activeFlowIndex < flowChain.length
          ? flowChain[activeFlowIndex]
          : null;
      }
    }),
    {
      name: 'flow-executor-storage', // localStorage/IndexedDB 키 이름
      partialize: (state) => ({
        flowChain: state.flowChain,
        activeFlowIndex: state.activeFlowIndex,
        stage: state.stage
      }),
    }
  )
); 