import React, { useState, useEffect } from 'react';
import FlowChainManager from './FlowChainManager';
import FlowInputForm from './FlowInputForm';
import { useExecutorStateStore } from '../../store/useExecutorStateStore';
import { useExecutorGraphStore } from '../../store/useExecutorGraphStore';
import { registerResultCallback } from '../../services/flowExecutionService';

const ExecutorPanel: React.FC = () => {
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
  const [showResults, setShowResults] = useState<boolean>(false);
  
  const { flowChain, getActiveFlow, getFlowResultById } = useExecutorStateStore();
  const { getFlowResult } = useExecutorGraphStore();
  
  const activeFlow = getActiveFlow();
  const activeFlowId = activeFlow?.id || null;
  
  // 결과 콜백 등록
  useEffect(() => {
    if (!activeFlowId) return;
    
    // 결과가 업데이트되면 UI 리렌더링
    const unregister = registerResultCallback(activeFlowId, () => {
      // React 컴포넌트 상태 업데이트를 강제하기 위한 빈 함수
      setShowResults(true);
    });
    
    return () => {
      unregister(); // 클린업 시 콜백 해제
    };
  }, [activeFlowId]);
  
  // 선택된 Flow 변경 처리
  const handleSelectFlow = (flowId: string) => {
    setSelectedFlowId(flowId);
  };
  
  // 현재 선택된 Flow의 결과
  const selectedFlowResult = selectedFlowId 
    ? getFlowResultById(selectedFlowId) || getFlowResult(selectedFlowId)
    : null;

  return (
    <div className="h-full flex flex-col">
      <h1 className="text-2xl font-bold mb-4">Flow Executor</h1>
      
      {/* Flow 체인 목록 및 입력 폼을 가로로 나눠서 표시 */}
      <div className="flex flex-1 gap-4 h-full">
        {/* 왼쪽: Flow 체인 관리 */}
        <div className="w-1/3">
          <FlowChainManager onSelectFlow={handleSelectFlow} />
        </div>
        
        {/* 오른쪽: 선택된 Flow의 입력 폼과 결과 */}
        <div className="flex-1 flex flex-col">
          {/* 상단: 입력 폼 */}
          <div className="flex-1 overflow-auto mb-4">
            {selectedFlowId ? (
              <FlowInputForm flowId={selectedFlowId} />
            ) : (
              <div className="border border-gray-300 rounded-lg bg-white p-8 text-center text-gray-500">
                <p>왼쪽에서 Flow를 선택하세요</p>
              </div>
            )}
          </div>
          
          {/* 하단: 결과 표시 */}
          {selectedFlowId && (
            <div className="flex-1 overflow-auto">
              <div className="border border-gray-300 rounded-lg bg-white overflow-hidden">
                <div className="p-3 bg-gray-50 border-b border-gray-300 flex justify-between items-center">
                  <h2 className="font-medium">실행 결과</h2>
                  <button
                    className="text-sm text-blue-500 hover:text-blue-700"
                    onClick={() => setShowResults(!showResults)}
                  >
                    {showResults ? '숨기기' : '보기'}
                  </button>
                </div>
                
                {showResults && (
                  <div className="p-4">
                    {selectedFlowResult ? (
                      <pre className="whitespace-pre-wrap bg-gray-50 p-3 rounded border border-gray-200 text-sm overflow-auto max-h-96">
                        {typeof selectedFlowResult === 'string' 
                          ? selectedFlowResult 
                          : JSON.stringify(selectedFlowResult, null, 2)}
                      </pre>
                    ) : (
                      <p className="text-gray-500 text-center py-4">아직 실행 결과가 없습니다</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExecutorPanel; 