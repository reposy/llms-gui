import type { InputRow } from '../types/flow/InputRow';

/**
 * flow-result 타입의 입력에서 실제 텍스트 데이터를 추출하는 함수
 * 
 * @param inputRow - flow-result 타입의 InputRow
 * @param flowChainMap - Flow Chain 맵 (store에서 가져온 데이터)
 * @returns 추출된 텍스트 (NodeResult들을 "\n\n"로 조인)
 */
export const extractFlowResultText = (
  inputRow: InputRow,
  flowChainMap: Record<string, any>
): string => {
  console.log('[extractFlowResultText] 입력 데이터:', { inputRow, availableChains: Object.keys(flowChainMap) });
  
  // flow-result 타입이 아니거나 필수 데이터가 없으면 빈 문자열 반환
  if (inputRow.type !== 'flow-result' || !inputRow.flowChainId || !inputRow.sourceFlowId) {
    console.log('[extractFlowResultText] 필수 조건 미충족:', {
      type: inputRow.type,
      flowChainId: inputRow.flowChainId,
      sourceFlowId: inputRow.sourceFlowId
    });
    return '';
  }

  const chain = flowChainMap[inputRow.flowChainId];
  if (!chain) {
    console.warn(`[extractFlowResultText] Flow chain not found: ${inputRow.flowChainId}`);
    return '';
  }

  console.log('[extractFlowResultText] 찾은 체인:', {
    chainId: inputRow.flowChainId,
    flowIds: chain.flowIds,
    selectedFlowIds: chain.selectedFlowIds,
    sourceFlowId: inputRow.sourceFlowId
  });

  try {
    let nodeResults: any[] = [];
    
    if (inputRow.sourceFlowId === '__all__') {
      // Flow Chain 전체 결과: flowIds의 모든 lastResults를 하나의 배열로 합침
      nodeResults = chain.flowIds.flatMap((fid: string) => {
        const flow = chain.flowMap[fid];
        console.log(`[extractFlowResultText] __all__ - 플로우 ${fid} 결과:`, flow?.lastResults);
        return flow?.lastResults || [];
      });
    } else if (inputRow.sourceFlowId === '__selected__') {
      // Flow Chain 선택 결과: selectedFlowIds의 lastResults를 하나의 배열로 합침
      nodeResults = chain.selectedFlowIds.flatMap((fid: string) => {
        const flow = chain.flowMap[fid];
        console.log(`[extractFlowResultText] __selected__ - 플로우 ${fid} 결과:`, flow?.lastResults);
        return flow?.lastResults || [];
      });
    } else {
      // 개별 Flow 결과: 해당 flow의 lastResults
      const flow = chain.flowMap[inputRow.sourceFlowId];
      nodeResults = flow?.lastResults || [];
      console.log(`[extractFlowResultText] 개별 플로우 ${inputRow.sourceFlowId} 결과:`, nodeResults);
    }
    
    console.log('[extractFlowResultText] 수집된 노드 결과들:', nodeResults);
    
    // NodeResult 객체들에서 result 필드만 추출하고 "\n\n"로 조인
    const resultTexts = nodeResults
      .map((nodeResult: any) => {
        if (typeof nodeResult === 'string') {
          return nodeResult;
        } else if (nodeResult && typeof nodeResult === 'object') {
          return nodeResult.result || '';
        }
        return '';
      })
      .filter(text => typeof text === 'string' && text.trim() !== ''); // 문자열인지 확인 후 빈 문자열 제거
    
    const finalResult = resultTexts.join('\n\n');
    console.log('[extractFlowResultText] 최종 결과:', finalResult);
    
    return finalResult;
  } catch (error) {
    console.error('[extractFlowResultText] Flow result 데이터 추출 오류:', error);
    return '';
  }
};

/**
 * InputRow 배열에서 flow-result 타입들을 실제 텍스트로 변환하는 함수
 * 
 * @param inputs - InputRow 배열 또는 일반 값 배열
 * @param flowChainMap - Flow Chain 맵 (store에서 가져온 데이터)
 * @returns 변환된 값 배열
 */
export const resolveFlowResultInputs = (
  inputs: any[],
  flowChainMap?: Record<string, any>
): any[] => {
  if (!Array.isArray(inputs)) return [];
  
  return inputs.map((input) => {
    // InputRow 타입인지 확인 (type 필드가 있는 객체)
    if (input && typeof input === 'object' && 'type' in input) {
      if (input.type === 'flow-result') {
        // flow-result 타입: 텍스트로 변환
        return extractFlowResultText(input, flowChainMap || {});
      } else if (input.type === 'property') {
        // property 타입: JSON 파싱하여 동적 속성 객체로 변환
        try {
          const parsed = JSON.parse(input.value as string || '{}');
          // DynamicPropertyInput 형태인지 검증
          if (parsed && typeof parsed === 'object' && 'nodeType' in parsed && 'property' in parsed) {
            return parsed;
          } else {
            console.warn('[resolveFlowResultInputs] Invalid property JSON structure:', parsed);
            return input.value;
          }
        } catch (error) {
          console.warn('[resolveFlowResultInputs] Failed to parse property JSON:', error);
          return input.value;
        }
      } else if (input.type === 'file') {
        // file 타입: 객체 그대로 전달 (File 객체)
        return input.value;
      } else {
        // text 등 기타 InputRow 타입: value 추출
        return input.value;
      }
    } else {
      // 이미 변환된 값인 경우 그대로 반환
      return input;
    }
  });
}; 