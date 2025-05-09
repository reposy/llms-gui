import { useNodeState } from '../store/useNodeStateStore';
import { GroupExecutionItemResult } from '../types/execution';
// NodeState 타입을 가져오려고 시도합니다. 실제 경로와 export 여부에 따라 조정이 필요할 수 있습니다.
// import { NodeState } from '../types/execution'; 

// NodeState['status'] 타입을 직접적으로 사용하거나, useNodeState의 반환 타입에서 추론합니다.
// useNodeState의 실제 반환 타입을 정확히 알 수 없으므로, 안전하게 literal type을 사용하거나, 
// useNodeState가 반환하는 객체에서 status의 타입을 명시적으로 가져올 수 있다면 그것을 사용합니다.
// 예시: type NodeOverallExecutionStatus = ReturnType<typeof useNodeState>['status'];
// 우선 가장 확실한 literal type으로 정의합니다.
type NodeOverallExecutionStatus = 'idle' | 'running' | 'success' | 'error' | 'skipped';

interface FormattedGroupNodeResultsHook {
  status: NodeOverallExecutionStatus;
  error?: string;
  rawResults: any[] | undefined; // 원본 결과 배열
  formattedResults: GroupExecutionItemResult[] | undefined; // UI 표시에 사용될 포맷팅된 결과
}

export const useFormattedGroupNodeResults = (nodeId: string | null): FormattedGroupNodeResultsHook => {
  const nodeState = useNodeState(nodeId || '');

  let formattedResults: GroupExecutionItemResult[] | undefined;
  // nodeState.result가 실제로 배열인지 확인하고, 아니면 undefined로 설정합니다.
  const rawResults = Array.isArray(nodeState.result) ? nodeState.result : undefined;

  if (nodeState.status === 'success' && rawResults) {
    formattedResults = rawResults.map((outputValue) => ({
      item: outputValue, 
      finalOutput: outputValue,
      status: 'success', 
      error: undefined,
      conditionalBranch: undefined,
      nodeResults: {} // 빈 객체라도 nodeResults 속성 추가
    }));
  }

  return {
    status: nodeState.status as NodeOverallExecutionStatus, // status 타입을 명시적으로 캐스팅
    error: nodeState.error,
    rawResults: rawResults,
    formattedResults: formattedResults,
  };
}; 