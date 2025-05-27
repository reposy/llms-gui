// 입력 매핑 전략/플러그인 매니저
import { useFlowExecutorStore } from '../store/useFlowExecutorStore';
import type { InputRow } from '../types/flow';

export type InputRowMapper = (row: InputRow, flowChainId: string) => any;

class InputMappingRegistry {
  private static mappers: Record<string, InputRowMapper> = {};

  static register(type: string, mapper: InputRowMapper) {
    this.mappers[type] = mapper;
  }

  static resolve(row: InputRow, flowChainId: string) {
    const mapper = this.mappers[row.type];
    if (!mapper) throw new Error(`No input mapper for type: ${row.type}`);
    return mapper(row, flowChainId);
  }
}

// 기본 매핑 함수 등록
InputMappingRegistry.register('text', (row) => row.value ?? '');
InputMappingRegistry.register('file', (row) => row.value as File);
InputMappingRegistry.register('flow-result', (row, flowChainId) => {
  const store = useFlowExecutorStore.getState();
  const flowChain = store.flowChainMap[flowChainId];
  if (!flowChain) {
    console.error(`[InputMappingRegistry] ERROR: flowChain is undefined for flowChainId:`, flowChainId);
    return [];
  }
  if (row.sourceFlowId) {
    // 단일 flow 결과
    const flow = flowChain.flowMap?.[row.sourceFlowId];
    if (!flow) {
      console.error(`[InputMappingRegistry] ERROR: flow is undefined for sourceFlowId:`, row.sourceFlowId);
      return [];
    }
    if (Array.isArray(flow.lastResults) && flow.lastResults.length > 0) {
      return flow.lastResults.map((item: any) =>
        typeof item === 'string' ? item : typeof item === 'object' ? JSON.stringify(item) : String(item)
      );
    }
    return [];
  } else {
    // 선택된 flow 전체 결과
    if (!Array.isArray(flowChain.selectedFlowIds) || flowChain.selectedFlowIds.length === 0) {
      return [];
    }
    return flowChain.selectedFlowIds.flatMap(fid => {
      const flow = flowChain.flowMap?.[fid];
      if (!flow || !Array.isArray(flow.lastResults) || flow.lastResults.length === 0) return [];
      return flow.lastResults.map((item: any) =>
        typeof item === 'string' ? item : typeof item === 'object' ? JSON.stringify(item) : String(item)
      );
    });
  }
});

export default InputMappingRegistry; 