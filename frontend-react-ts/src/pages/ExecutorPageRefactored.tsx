import React, { useState, useRef, useEffect } from 'react';
import FileUploader from '../components/executor/FileUploader';
import FlowChainManager from '../components/executor/FlowChainManager';
import FlowInputForm from '../components/executor/FlowInputForm';
import ResultDisplay from '../components/executor/ResultDisplay';
import { registerResultCallback } from '../services/flowExecutionService';
import ExecutorPanel from '../components/executor/ExecutorPanelRefactored';
import useFlowExecutor from '../hooks/useFlowExecutor';

const ExecutorPage: React.FC = () => {
  // 파일 입력 참조
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 커스텀 훅을 통한 상태 및 기능 가져오기
  const { 
    isExecuting,
    error,
    handleImportFlowChain,
    handleExportFlowChain,
    handleExecuteSingleFlow,
    handleExecuteChain,
    handleClearAll,
    flowChain,
    stage,
    setStage,
    getActiveFlow,
    getFlowById,
    getFlowResultById
  } = useFlowExecutor();
  
  // 로컬 상태
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
  
  // 활성 Flow 가져오기
  const activeFlow = getActiveFlow();
  
  // 활성 Flow가 변경되면 선택된 Flow ID 업데이트
  useEffect(() => {
    if (activeFlow) {
      setSelectedFlowId(activeFlow.id);
    } else {
      setSelectedFlowId(null);
    }
  }, [activeFlow]);
  
  // Flow 선택 처리
  const handleFlowSelect = (flowId: string) => {
    setSelectedFlowId(flowId);
    
    // 결과가 있는 경우 result 단계로 전환
    const result = getFlowResultById(flowId);
    if (result && stage !== 'result') {
      setStage('result');
    }
  };

  // 선택된 Flow의 실행 처리
  const handleExecuteSelectedFlow = () => {
    if (selectedFlowId) {
      handleExecuteSingleFlow(selectedFlowId);
    }
  };

  // 선택된 Flow 또는 activeFlow가 변경될 때 콜백 등록
  useEffect(() => {
    if (!selectedFlowId) return;
    
    // 콜백 등록: 결과가 업데이트되면 자동으로 화면 갱신
    const unregister = registerResultCallback(selectedFlowId, () => {
      // 실행 중 상태가 계속되면 해제
      if (isExecuting && stage === 'executing') {
        // 결과 화면으로 전환 
        setStage('result');
      }
    });
    
    // 컴포넌트 언마운트 또는 Flow 변경 시 콜백 제거
    return () => {
      unregister();
    };
  }, [selectedFlowId, isExecuting, stage, setStage]);
  
  // Input 단계로 되돌아가기
  const handleBackToInput = () => {
    setStage('input');
  };
  
  // 단일 Flow 실행 버튼 렌더링
  const renderExecuteButton = () => {
    // 실행 가능 상태 확인
    const canExecute = flowChain.length > 0;
    
    const selectedFlow = selectedFlowId ? getFlowById(selectedFlowId) : null;
    const hasInputs = selectedFlow?.inputData && selectedFlow.inputData.length > 0;
    
    return (
      <button
        className={`w-full px-6 py-3 font-medium rounded-md shadow ${
          !canExecute || !hasInputs || isExecuting
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700'
        }`}
        onClick={handleExecuteSelectedFlow}
        disabled={!canExecute || !hasInputs || isExecuting}
      >
        {isExecuting ? (
          <div className="flex items-center justify-center">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            실행 중...
          </div>
        ) : canExecute ? (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 inline-block mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            플로우 실행
          </>
        ) : (
          '플로우를 추가해주세요'
        )}
      </button>
    );
  };
  
  // 결과 표시 렌더링
  const renderResults = () => {
    if (selectedFlowId) {
      // 단일 Flow 결과 표시
      const flow = getFlowById(selectedFlowId);
      if (!flow) return null;
      
      const result = getFlowResultById(selectedFlowId);
      console.log(`[ExecutorPage] Rendering results for flow ${selectedFlowId}:`, result);
      
      return (
        <ResultDisplay
          flowId={selectedFlowId}
          result={result}
          flowName={flow.name}
        />
      );
    }
    
    return (
      <div className="p-6 text-gray-500 text-center">
        <p>실행 결과가 여기에 표시됩니다.</p>
        <p className="text-sm mt-2">Flow를 선택하고 실행해보세요.</p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 상단 네비게이션 바 */}
      <ExecutorPanel
        onImportFlowChain={handleImportFlowChain}
        onExportFlowChain={handleExportFlowChain}
        onExecuteFlow={handleExecuteChain} // 전체 체인 실행
        onClearAll={handleClearAll}
        isExecuting={isExecuting}
      />

      {/* 탭 네비게이션 */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center">
            <button
              className={`${
                stage === 'upload' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              } py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
              onClick={() => setStage('upload')}
            >
              <span className="bg-gray-200 text-gray-600 w-6 h-6 rounded-full flex items-center justify-center mr-2">1</span>
              Upload Flow
            </button>
            <button
              className={`${
                stage === 'input' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              } py-4 px-1 border-b-2 font-medium text-sm mx-8 flex items-center`}
              onClick={() => stage !== 'upload' && setStage('input')}
              disabled={stage === 'upload'}
            >
              <span className={`${
                stage === 'upload' ? 'bg-gray-100 text-gray-400' : 'bg-gray-200 text-gray-600'
              } w-6 h-6 rounded-full flex items-center justify-center mr-2`}>2</span>
              Set Input
            </button>
            <button
              className={`${
                stage === 'result' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              } py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
              onClick={() => stage === 'result' && setStage('result')}
              disabled={stage !== 'result'}
            >
              <span className={`${
                stage === 'result' ? 'bg-gray-200 text-gray-600' : 'bg-gray-100 text-gray-400'
              } w-6 h-6 rounded-full flex items-center justify-center mr-2`}>3</span>
              View Results
            </button>
          </div>
        </div>
      </div>
      
      {/* 주요 컨텐츠 영역 */}
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* 오류 메시지 표시 영역 */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">오류가 발생했습니다</h3>
                <div className="mt-2 text-sm text-red-700">{error}</div>
              </div>
            </div>
          </div>
        )}
        
        {/* 업로드 단계 */}
        {stage === 'upload' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4 text-gray-700">Flow 업로드</h2>
            <p className="mb-4 text-gray-600">Flow JSON 파일을 업로드하거나, Flow Editor에서 생성한 Flow를 불러오세요.</p>
            <FileUploader />
          </div>
        )}
        
        {/* 입력 단계 */}
        {stage === 'input' && (
          <div className="flex space-x-4">
            {/* 왼쪽 패널: Flow 체인 */}
            <div className="w-1/2 overflow-y-auto pr-2">
              <FlowChainManager onSelectFlow={handleFlowSelect} handleImportFlowChain={handleImportFlowChain} />
            </div>
            
            {/* 오른쪽 패널: Flow 입력 폼 */}
            <div className="w-1/2 overflow-y-auto pl-2">
              {selectedFlowId ? (
                <FlowInputForm flowId={selectedFlowId} />
              ) : (
                <div className="border border-gray-300 rounded-lg p-6 text-center bg-white">
                  <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">Flow를 선택해주세요</h3>
                  <p className="mt-1 text-sm text-gray-500">왼쪽 패널에서 Flow를 선택하면 입력 폼이 표시됩니다.</p>
                </div>
              )}
              
              {/* 실행 버튼 */}
              {selectedFlowId && (
                <div className="mt-4">
                  {renderExecuteButton()}
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* 실행 중 단계 */}
        {stage === 'executing' && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex flex-col items-center justify-center py-10">
              <div className="w-12 h-12 rounded-full border-t-2 border-b-2 border-indigo-500 animate-spin mb-4"></div>
              <span className="text-xl font-medium text-gray-700">
                Flow 실행 중...
              </span>
              <p className="text-sm text-gray-500 mt-2">잠시만 기다려주세요. 처리 중입니다.</p>
            </div>
          </div>
        )}
        
        {/* 결과 단계 */}
        {stage === 'result' && (
          <div className="flex space-x-4">
            {/* 왼쪽 패널: Flow 설정 */}
            <div className="w-1/2 overflow-y-auto pr-2">
              <h2 className="text-lg font-semibold mb-4 text-gray-700 border-b pb-2">Flow 설정</h2>
              <FlowChainManager onSelectFlow={handleFlowSelect} handleImportFlowChain={handleImportFlowChain} />
              
              <div className="mt-4 flex space-x-2">
                <button
                  onClick={handleBackToInput}
                  className="px-4 py-2 border border-gray-300 bg-white text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors shadow-sm flex-1"
                >
                  입력 수정
                </button>
                <button
                  onClick={handleExecuteSelectedFlow}
                  className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center shadow-sm"
                  disabled={isExecuting}
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
              <div className="flex-1 min-h-[45%]">
                <h2 className="text-lg font-semibold mb-2 text-gray-700 border-b pb-2">실행 결과</h2>
                {renderResults()}
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* 파일 입력 (숨김) */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            // 파일 업로드 처리 (필요시 구현)
          }
        }}
      />
    </div>
  );
};

export default ExecutorPage; 