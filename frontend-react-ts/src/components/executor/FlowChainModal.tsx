import React, { useState, useEffect } from 'react';
import { useFlowExecutorStore } from '../../store/useFlowExecutorStore';
import { executeFlowExecutor } from '../../services/flowExecutionService';
import FlowInputForm from './FlowInputForm';
import ResultDisplay from './ResultDisplay';

interface FlowChainModalProps {
  isOpen: boolean;
  onClose: () => void;
  chainId: string;
  flowId: string;
}

const FlowChainModal: React.FC<FlowChainModalProps> = ({
  isOpen,
  onClose,
  chainId,
  flowId
}) => {
  const [activeTab, setActiveTab] = useState<'input' | 'result'>('input');
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  
  const store = useFlowExecutorStore();
  const chain = store.chains[chainId];
  const flow = chain?.flowMap[flowId];

  // 모달이 닫힐 때 resetState
  useEffect(() => {
    if (!isOpen) {
      setActiveTab('input');
    }
  }, [isOpen]);

  if (!isOpen || !flow) return null;

  const handleInputChange = (inputs: any[]) => {
    store.setFlowInputData(chainId, flowId, inputs);
  };

  const handleExecuteFlow = async () => {
    if (isExecuting) return;
    
    setIsExecuting(true);
    store.setFlowStatus(chainId, flowId, 'running');
    
    try {
      const result = await executeFlowExecutor({
        flowId,
        chainId,
        flowJson: flow.flowJson,
        inputs: flow.inputs
      });
      
      if (result.status === 'error') {
        store.setFlowStatus(chainId, flowId, 'error', result.error);
      } else {
        const outputs = result.outputs || [];
        store.setFlowResult(chainId, flowId, outputs);
        store.setFlowStatus(chainId, flowId, 'success');
        setActiveTab('result');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      store.setFlowStatus(chainId, flowId, 'error', errorMessage);
      console.error('[FlowChainModal] 실행 오류:', error);
    } finally {
      setIsExecuting(false);
    }
  };

  // 결과가 있으면 결과 탭 활성화 (처음 열 때)
  useEffect(() => {
    if (flow.lastResults && flow.lastResults.length > 0) {
      setActiveTab('result');
    } else {
      setActiveTab('input');
    }
  }, [flow?.lastResults]);

  return (
    <div className={`fixed inset-0 z-50 overflow-y-auto ${isOpen ? 'block' : 'hidden'}`}>
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* 배경 오버레이 */}
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>

        {/* 모달 컨테이너 */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full" style={{ width: '85%', maxWidth: '1200px' }}>
          {/* 모달 헤더 */}
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
            <div className="flex items-center">
              <h3 className="text-lg font-medium text-gray-900">
                {flow.name}
              </h3>
              <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
                flow.status === 'idle' ? 'bg-gray-100 text-gray-600' :
                flow.status === 'running' ? 'bg-blue-100 text-blue-600' :
                flow.status === 'success' ? 'bg-green-100 text-green-600' :
                'bg-red-100 text-red-600'
              }`}>
                {flow.status === 'idle' ? '준비' :
                flow.status === 'running' ? '실행 중' :
                flow.status === 'success' ? '완료' : '오류'}
              </span>
            </div>
            
            <button
              onClick={onClose}
              className="rounded-md text-gray-400 hover:text-gray-500 focus:outline-none"
            >
              <span className="sr-only">닫기</span>
              <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 탭 네비게이션 */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex">
              <button
                className={`${
                  activeTab === 'input'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm`}
                onClick={() => setActiveTab('input')}
              >
                입력 설정
              </button>
              <button
                className={`${
                  activeTab === 'result'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm ${
                  !flow.lastResults || flow.lastResults.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                onClick={() => {
                  if (flow.lastResults && flow.lastResults.length > 0) {
                    setActiveTab('result');
                  }
                }}
                disabled={!flow.lastResults || flow.lastResults.length === 0}
              >
                결과 보기
              </button>
            </nav>
          </div>

          {/* 모달 본문 */}
          <div className="bg-white p-6 max-h-[70vh] overflow-y-auto">
            {activeTab === 'input' ? (
              <>
                {/* 입력 설정 */}
                <div className="mb-4">
                  <FlowInputForm 
                    flowId={flowId}
                  />
                </div>

                {/* 실행 버튼 */}
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={handleExecuteFlow}
                    disabled={isExecuting}
                    className={`px-4 py-2 bg-indigo-600 text-white rounded-md shadow-sm text-sm font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      isExecuting ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    {isExecuting ? (
                      <span className="flex items-center">
                        <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        실행 중...
                      </span>
                    ) : 'Flow 실행'}
                  </button>
                </div>

                {/* 오류 메시지 */}
                {flow.status === 'error' && flow.error && (
                  <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md border border-red-200">
                    <h4 className="font-medium">실행 오류</h4>
                    <p className="mt-1 text-sm">{flow.error}</p>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* 결과 표시 */}
                {flow.lastResults && flow.lastResults.length > 0 ? (
                  <ResultDisplay result={{ status: flow.status, outputs: flow.lastResults, error: flow.error, flowId: flow.id }} flowId={flowId} flowName={flow.name} />
                ) : (
                  <div className="text-gray-500 italic">결과가 없습니다.</div>
                )}
              </>
            )}
          </div>

          {/* 모달 푸터 */}
          <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FlowChainModal; 