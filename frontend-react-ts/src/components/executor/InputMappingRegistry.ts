// 입력 매핑 전략/플러그인 매니저
import { InputRow } from './FlowChainManager';
import { useFlowExecutorStore } from '../../store/useFlowExecutorStore';

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
  const prevFlow = flowChain?.flowMap?.[row.sourceFlowId];
  if (!prevFlow) {
    console.error(`[InputMappingRegistry] ERROR: prevFlow is undefined for sourceFlowId:`, row.sourceFlowId);
    return '';
  }
  if (Array.isArray(prevFlow?.lastResults) && prevFlow.lastResults.length > 0) {
    return prevFlow.lastResults.map((item) =>
      typeof item === 'string' ? item : typeof item === 'object' ? JSON.stringify(item) : String(item)
    );
  }
  return '';
});

export default InputMappingRegistry; 