import React from 'react';
import FlowChainManager from '../../executor/FlowChainManager'; // 경로 확인
import FlowInputForm from '../../executor/FlowInputForm'; // 경로 확인
import ResultDisplay from '../../executor/ResultDisplay'; // 경로 확인
import { FlowExecutionItem, FlowExecutionResult } from '../../../store/useExecutorStateStore'; // 필요한 타입 import

interface InputStageViewProps {
  selectedFlowId: string | null;
  flowChain?: FlowExecutionItem[]; // flowChain을 optional로 변경
  onSelectFlow: (flowId: string) => void;
  onImportFlowChain: () => void; // FlowChainManager에 필요
  renderExecuteButton: () => JSX.Element;
  getFlowById: (flowId: string) => FlowExecutionItem | undefined;
  getFlowResultById: (flowId: string) => FlowExecutionResult | null;
}

const InputStageView: React.FC<InputStageViewProps> = ({
  selectedFlowId,
  // flowChain, // 더 이상 prop으로 받지 않음
  onSelectFlow,
  onImportFlowChain,
  renderExecuteButton,
  getFlowById,
  getFlowResultById,
}) => {
  return (
    <div className="flex space-x-4">
      {/* 왼쪽 패널: Flow 체인 */}
      <div className="w-1/2 overflow-y-auto pr-2">
        <FlowChainManager 
          onSelectFlow={onSelectFlow} 
          handleImportFlowChain={onImportFlowChain} 
        />
      </div>
      
      {/* 오른쪽 패널: Flow 입력 폼, 실행 버튼, 결과 */}
      <div className="w-1/2 overflow-y-auto pl-2 space-y-4">
        {selectedFlowId ? (
          <>
            <FlowInputForm flowId={selectedFlowId} />
            
            <div className="mt-0">
              {renderExecuteButton()}
            </div>

            {getFlowResultById(selectedFlowId) && (
              <div className="border border-gray-300 rounded-lg bg-white overflow-hidden">
                <div className="p-4 bg-gray-50 border-b border-gray-300">
                  <h2 className="font-medium text-lg">실행 결과</h2>
                </div>
                <div className="p-4">
                  <ResultDisplay
                    flowId={selectedFlowId}
                    result={getFlowResultById(selectedFlowId)}
                    flowName={getFlowById(selectedFlowId)?.name || ''}
                  />
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="border border-gray-300 rounded-lg p-6 text-center bg-white">
            <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">Flow를 선택해주세요</h3>
            <p className="mt-1 text-sm text-gray-500">왼쪽 패널에서 Flow를 선택하면 입력 폼이 표시됩니다.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default InputStageView; 