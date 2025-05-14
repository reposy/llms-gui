import React from 'react';
import FlowChainManager from '../../executor/FlowChainManager';
import ResultDisplay from '../../executor/ResultDisplay';
import { FlowExecutionItem, FlowExecutionResult } from '../../../store/useExecutorStateStore'; // 필요한 타입 import

interface ResultStageViewProps {
  selectedFlowId: string | null;
  // flowChain: FlowExecutionItem[]; // FlowChainManager가 직접 store를 사용하므로 제거 가능
  onSelectFlow: (flowId: string) => void;
  onImportFlowChain: () => void;
  onBackToInput: () => void;
  onExecuteSingleFlow: () => void;
  renderResults: () => JSX.Element | null; // renderResults는 ExecutorPage에 남아있으므로 prop으로 받음
  // getFlowById: (flowId: string) => FlowExecutionItem | undefined; // ResultDisplay가 flowName을 직접 받거나, renderResults 내부에서 처리
  // getFlowResultById: (flowId: string) => FlowExecutionResult | null; // renderResults 내부에서 처리
}

const ResultStageView: React.FC<ResultStageViewProps> = ({
  selectedFlowId,
  onSelectFlow,
  onImportFlowChain,
  onBackToInput,
  onExecuteSingleFlow,
  renderResults,
}) => {
  return (
    <div className="flex space-x-4">
      {/* 왼쪽 패널: Flow 설정 */}
      <div className="w-1/2 overflow-y-auto pr-2">
        <h2 className="text-lg font-semibold mb-4 text-gray-700 border-b pb-2">Flow 설정</h2>
        <FlowChainManager 
          onSelectFlow={onSelectFlow} 
          handleImportFlowChain={onImportFlowChain} 
        />
        
        <div className="mt-4 flex space-x-2">
          <button
            onClick={onBackToInput}
            className="px-4 py-2 border border-gray-300 bg-white text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors shadow-sm flex-1"
          >
            입력 수정
          </button>
          <button
            onClick={onExecuteSingleFlow}
            className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center shadow-sm"
            disabled={!selectedFlowId} // 선택된 Flow가 있을 때만 활성화
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            다시 실행
          </button>
        </div>
      </div>
      
      {/* 오른쪽 패널: 실행 결과 */}
      <div className="w-1/2 overflow-y-auto pl-2 bg-white rounded-lg shadow border border-gray-200 p-4 flex flex-col">
        <div className="flex-1 min-h-[45%]"> {/* 원래 스타일에 있던 min-h 값 유지 */}
          <h2 className="text-lg font-semibold mb-2 text-gray-700 border-b pb-2">실행 결과</h2>
          {renderResults()} {/* ExecutorPage에서 전달받은 renderResults 함수 사용 */}
        </div>
      </div>
    </div>
  );
};

export default ResultStageView; 