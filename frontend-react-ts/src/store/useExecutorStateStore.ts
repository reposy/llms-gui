import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { FlowData } from '../utils/data/importExportUtils';

type ExecutorStage = 'upload' | 'input' | 'executing' | 'result';

interface ExecutorState {
  // 플로우 데이터
  flowJson: FlowData | null;
  
  // 입력 데이터
  inputData: any[];
  
  // 현재 단계
  stage: ExecutorStage;
  
  // 결과 데이터
  result: any | null;
  
  // 오류 메시지
  error: string | null;
  
  // 상태 설정 함수
  setFlowJson: (flowJson: FlowData | null) => void;
  setInputData: (inputData: any[]) => void;
  setStage: (stage: ExecutorStage) => void;
  setResult: (result: any | null) => void;
  setError: (error: string | null) => void;
  
  // 상태 초기화 함수
  resetState: () => void;
}

// 초기 상태
const initialState = {
  flowJson: null,
  inputData: [],
  stage: 'upload' as ExecutorStage,
  result: null,
  error: null
};

export const useExecutorStateStore = create<ExecutorState>()(
  persist(
    (set, get) => ({
      ...initialState,
      
      // 상태 설정 함수
      setFlowJson: (flowJson) => set({ flowJson }),
      setInputData: (inputData) => set({ inputData }),
      setStage: (stage) => set({ stage }),
      setResult: (result) => set({ result }),
      setError: (error) => set({ error }),
      
      // 상태 초기화 함수
      resetState: () => set(initialState),
    }),
    {
      name: 'flow-executor-storage', // localStorage/IndexedDB 키 이름
      partialize: (state) => ({
        flowJson: state.flowJson,
        inputData: state.inputData,
        stage: state.stage
      }),
    }
  )
); 