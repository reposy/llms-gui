import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import FileUploader from '../components/executor/FileUploader';
import FlowChainManager from '../components/executor/FlowChainManager';
import FlowInputForm from '../components/executor/FlowInputForm';
import ResultDisplay from '../components/executor/ResultDisplay';
import { executeFlow, executeChain, registerResultCallback } from '../services/flowExecutionService';
import { useExecutorStateStore } from '../store/useExecutorStateStore';

type ExecutionMode = 'single' | 'chain';

const ExecutorPage: React.FC = () => {
  // 파일 입력 참조
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 로컬 상태
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [executionMode, setExecutionMode] = useState<ExecutionMode>('single');
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
  
  // Zustand 스토어에서 상태와 액션 가져오기
  const {
    flowChain,
    activeFlowIndex,
    stage,
    error,
    setStage,
    setError,
    getActiveFlow,
    getFlowById,
    setFlowResult,
    resetResults,
    getFlowResultById
  } = useExecutorStateStore();
  
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
  
  // Flow 체인 상태가 변경되면 UI 단계 업데이트
  useEffect(() => {
    if (flowChain.length === 0 && stage !== 'upload') {
      setStage('upload');
    } else if (flowChain.length > 0 && stage === 'upload') {
      setStage('input');
    }
  }, [flowChain, stage, setStage]);

  // Flow 선택 처리
  const handleFlowSelect = (flowId: string) => {
    setSelectedFlowId(flowId);
  };

  // 선택된 Flow 또는 activeFlow가 변경될 때 콜백 등록
  useEffect(() => {
    if (!selectedFlowId) return;
    
    // 콜백 등록: 결과가 업데이트되면 자동으로 화면 갱신
    const unregister = registerResultCallback(selectedFlowId, (result) => {
      // Flow 결과 업데이트
      setFlowResult(selectedFlowId, result);
      
      // 실행 중 상태가 지속되면 해제
      if (isExecuting) {
        setIsExecuting(false);
        
        // 결과 화면으로 전환 (현재 input 단계인 경우)
        if (stage === 'executing') {
          setStage('result');
        }
      }
    });
    
    // 컴포넌트 언마운트 또는 Flow 변경 시 콜백 제거
    return () => {
      unregister();
    };
  }, [selectedFlowId, setFlowResult]);

  // 단일 Flow 실행 처리
  const handleExecuteSingleFlow = async () => {
    if (!selectedFlowId) {
      setError('실행할 Flow를 선택해주세요.');
      return;
    }
    
    const flow = getFlowById(selectedFlowId);
    if (!flow) {
      setError('선택한 Flow를 찾을 수 없습니다.');
      return;
    }
    
    setIsExecuting(true);
    setStage('executing');
    setError(null);

    try {
      const response = await executeFlow({
        flowJson: flow.flowJson,
        inputs: flow.inputData || [],
        onComplete: (result) => {
          // 결과 저장 및 상태 업데이트
          setFlowResult(flow.id, result);
          setIsExecuting(false);
          setStage('result');
        }
      });

      if (response.status === 'error') {
        setError(response.error || '플로우 실행 중 알 수 없는 오류가 발생했습니다.');
        setIsExecuting(false);
      }
    } catch (err) {
      setError('플로우 실행에 실패했습니다. 입력 데이터를 확인하고 다시 시도해주세요.');
      console.error('실행 오류:', err);
      setIsExecuting(false);
      setStage('result');
    }
  };
  
  // Flow 체인 실행 처리
  const handleExecuteChain = async () => {
    if (flowChain.length === 0) {
      setError('실행할 Flow가 없습니다. 먼저 Flow를 추가해주세요.');
      return;
    }
    
    setIsExecuting(true);
    setStage('executing');
    setError(null);
    
    // 이전 결과 초기화
    resetResults();
    
    try {
      // 체인 실행을 위한 Flow 항목 준비
      const flowItems = flowChain.map(flow => ({
        id: flow.id,
        flowJson: flow.flowJson,
        inputData: flow.inputData || []
      }));
      
      // 체인 실행
      await executeChain({
        flowItems,
        onFlowComplete: (flowId, result) => {
          console.log(`Flow ${flowId} completed with result:`, result);
          setFlowResult(flowId, result);
          
          // 마지막 Flow인 경우 실행 완료 처리
          const isLastFlow = flowId === flowItems[flowItems.length - 1].id;
          if (isLastFlow) {
            setIsExecuting(false);
            setStage('result');
          }
        },
        onError: (flowId, errorMsg) => {
          console.error(`Error executing flow ${flowId}:`, errorMsg);
          setError(`Flow "${getFlowById(flowId)?.name || flowId}" 실행 중 오류: ${errorMsg}`);
          setIsExecuting(false);
          setStage('result');
        }
      });
    } catch (err) {
      setError('Flow 체인 실행에 실패했습니다. 입력 데이터를 확인하고 다시 시도해주세요.');
      console.error('체인 실행 오류:', err);
      setIsExecuting(false);
      setStage('result');
    }
  };
  
  // 실행 모드 변경 처리
  const handleExecutionModeChange = (mode: ExecutionMode) => {
    setExecutionMode(mode);
  };

  // 처음부터 다시 시작 - Change Flow 버튼 클릭 시
  const handleReset = () => {
    // 파일 선택 대화상자 직접 열기
    fileInputRef.current?.click();
  };
  
  // Input 단계로 되돌아가기
  const handleBackToInput = () => {
    setStage('input');
  };
  
  // 실행 모드 선택 UI 렌더링
  const renderExecutionModeSelector = () => {
    return (
      <div className="p-4 border border-gray-300 rounded-lg bg-white mb-4">
        <h2 className="text-lg font-medium mb-3">실행 모드</h2>
        <div className="inline-flex w-full rounded-md shadow-sm">
          <button
            type="button"
            onClick={() => handleExecutionModeChange('single')}
            className={`flex-1 flex items-center justify-center px-4 py-3 text-sm font-medium border rounded-l-md focus:outline-none focus:z-10 ${
              executionMode === 'single'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            단일 Flow 실행
          </button>
          <button
            type="button"
            onClick={() => handleExecutionModeChange('chain')}
            className={`flex-1 flex items-center justify-center px-4 py-3 text-sm font-medium border rounded-r-md focus:outline-none focus:z-10 ${
              executionMode === 'chain'
                ? 'bg-purple-600 text-white border-purple-600'
                : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300 border-l-0'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
            전체 Flow 체인 실행
          </button>
        </div>
        <p className="mt-2 text-sm text-gray-500">
          {executionMode === 'single' 
            ? '선택한 단일 Flow만 실행합니다. 이 모드에서는 선택된 Flow의 입력 및 출력만 처리됩니다.' 
            : '모든 Flow를 순서대로 실행하며, 이전 Flow 결과를 다음 Flow의 입력으로 사용할 수 있습니다. Flow 순서는 위에서 아래로 진행됩니다.'}
        </p>
      </div>
    );
  };
  
  // 단일 Flow/체인 실행 버튼 렌더링
  const renderExecuteButton = () => {
    // 실행 가능 상태 확인
    const canExecute = flowChain.length > 0;
    
    if (executionMode === 'single') {
      const selectedFlow = selectedFlowId ? getFlowById(selectedFlowId) : null;
      const hasInputs = selectedFlow?.inputData && selectedFlow.inputData.length > 0;
      
      return (
        <button
          onClick={handleExecuteSingleFlow}
          disabled={!canExecute || !selectedFlowId}
          className={`w-full rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 px-6 py-3 ${
            canExecute && selectedFlowId
              ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white'
              : 'bg-gray-400 cursor-not-allowed text-white'
          }`}
          title={!canExecute ? 'Flow를 추가해야 합니다.' : (!selectedFlowId ? 'Flow를 선택해야 합니다.' : '')}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {isExecuting 
            ? '실행 중...' 
            : (selectedFlow
              ? (hasInputs ? `"${selectedFlow.name}" 실행` : `"${selectedFlow.name}" 실행 (입력 필요)`)
              : '선택된 Flow 실행')}
        </button>
      );
    } else {
      return (
        <button
          onClick={handleExecuteChain}
          disabled={!canExecute}
          className={`w-full rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 px-6 py-3 ${
            canExecute 
              ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white' 
              : 'bg-gray-400 cursor-not-allowed text-white'
          }`}
          title={!canExecute ? 'Flow를 추가해야 합니다.' : ''}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          {isExecuting ? '실행 중...' : `Flow 체인 실행 (${flowChain.length}개)`}
        </button>
      );
    }
  };
  
  // 결과 표시 렌더링
  const renderResults = () => {
    if (executionMode === 'single' && selectedFlowId) {
      // 단일 Flow 결과 표시
      const flow = getFlowById(selectedFlowId);
      if (!flow) return <p>선택된 Flow가 없습니다.</p>;
      
      return (
        <ResultDisplay
          result={flow.result}
          isLoading={isExecuting}
          error={error}
        />
      );
    } else {
      // 전체 체인 결과 표시 (모든 Flow의 결과를 순서대로 표시)
      const allResults = flowChain
        .filter(flow => flow.result !== null)
        .map(flow => ({
          flowId: flow.id,
          flowName: flow.name,
          result: flow.result
        }));
      
      if (allResults.length === 0) {
        return <p className="text-gray-500">아직 실행된 Flow가 없습니다.</p>;
      }
      
      return (
        <div className="space-y-4">
          {allResults.map((item, index) => (
            <div key={item.flowId} className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
              <h3 className="font-medium text-lg mb-2 flex items-center text-blue-700">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
                {item.flowName} 결과
              </h3>
              <ResultDisplay
                result={item.result}
                isLoading={false}
                error={null}
              />
            </div>
          ))}
          
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded text-red-600">
              <h3 className="font-medium mb-2 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                오류
              </h3>
              <p>{error}</p>
            </div>
          )}
        </div>
      );
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <div className="flex-none h-12 bg-gray-100 border-b border-gray-200 px-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Flow Executor</h1>
        <Link 
          to="/" 
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          Go to Editor
        </Link>
      </div>

      <div className="flex-1 overflow-hidden p-4 bg-gray-50">
        {/* 진행 단계 표시 */}
        <div className="mb-6 max-w-[95%] mx-auto">
          <div className="flex items-center justify-between w-full">
            <div className={`flex flex-col items-center ${stage === 'upload' ? 'text-blue-600' : 'text-gray-600'}`}>
              <div className={`w-10 h-10 flex items-center justify-center rounded-full ${stage === 'upload' ? 'bg-blue-100 border-blue-500' : 'bg-gray-100 border-gray-300'} border-2`}>1</div>
              <span className="mt-2">Upload Flow</span>
            </div>
            <div className={`flex-1 h-1 mx-2 ${stage !== 'upload' ? 'bg-blue-300' : 'bg-gray-300'}`}></div>
            <div 
              className={`flex flex-col items-center ${stage === 'input' ? 'text-blue-600' : (stage === 'upload' ? 'text-gray-400' : 'text-gray-600')}`}
            >
              <div className={`w-10 h-10 flex items-center justify-center rounded-full ${stage === 'input' ? 'bg-blue-100 border-blue-500' : (stage !== 'upload' ? 'bg-gray-100 border-gray-300' : 'bg-gray-100 border-gray-200')} border-2`}>2</div>
              <span className="mt-2">Set Input</span>
            </div>
            <div className={`flex-1 h-1 mx-2 ${stage === 'executing' || stage === 'result' ? 'bg-blue-300' : 'bg-gray-300'}`}></div>
            <div className={`flex flex-col items-center ${stage === 'executing' || stage === 'result' ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-10 h-10 flex items-center justify-center rounded-full ${stage === 'executing' || stage === 'result' ? 'bg-blue-100 border-blue-500' : 'bg-gray-100 border-gray-200'} border-2`}>3</div>
              <span className="mt-2">View Results</span>
            </div>
          </div>
        </div>

        {/* 변경 시 필요한 숨겨진 파일 입력 */}
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept=".json,application/json"
          onChange={(e) => {
            // FileUploader에 이벤트 전달을 위한 빈 핸들러
          }}
        />

        {stage === 'upload' && (
          <div className="max-w-[95%] mx-auto">
            <FileUploader externalFileInputRef={fileInputRef} />
          </div>
        )}

        {/* 각 단계별 레이아웃 */}
        {stage === 'input' && (
          <div className="flex flex-row h-[calc(100%-4rem)] gap-4 max-w-[95%] mx-auto">
            {/* 왼쪽 패널: 실행 모드 + Flow 체인 */}
            <div className="w-1/2 overflow-y-auto pr-2">
              {renderExecutionModeSelector()}
              <FlowChainManager onSelectFlow={handleFlowSelect} />
              
              <div className="mt-6">
                {renderExecuteButton()}
              </div>
            </div>
            
            {/* 오른쪽 패널: 입력 폼 + 결과 패널 분할 */}
            <div className="w-1/2 overflow-y-auto pl-2 flex flex-col gap-4">
              {/* 입력 폼 섹션 */}
              <div className="flex-1 min-h-[45%]">
                {selectedFlowId ? (
                  <FlowInputForm flowId={selectedFlowId} />
                ) : (
                  <div className="h-full flex items-center justify-center p-6 border border-gray-300 rounded-lg bg-white shadow-sm">
                    <div className="text-center text-gray-500">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto mb-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                      </svg>
                      <p className="text-xl font-medium mb-2">Flow를 선택해주세요</p>
                      <p className="text-sm">
                        왼쪽에서 Flow를 선택하면 입력 데이터를 설정할 수 있습니다.
                      </p>
                    </div>
                  </div>
                )}
              </div>
              
              {/* 결과 패널 섹션 */}
              <div className="flex-1 min-h-[45%]">
                <div className="border border-gray-300 rounded-lg bg-white overflow-hidden">
                  <div className="p-4 bg-gray-50 border-b border-gray-300">
                    <h2 className="font-medium text-lg">실행 결과</h2>
                    <p className="text-sm text-gray-600">Flow 실행 결과가 여기에 표시됩니다.</p>
                  </div>
                  
                  <div className="p-4">
                    {selectedFlowId ? (
                      <ResultDisplay
                        result={getFlowResultById(selectedFlowId)}
                        isLoading={isExecuting}
                        error={error}
                      />
                    ) : (
                      <p className="text-gray-500">Flow를 선택하여 결과를 확인하세요.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {stage === 'executing' && (
          <div className="max-w-[95%] mx-auto">
            <div className="flex items-center justify-center p-8 border border-gray-300 rounded-lg bg-white shadow-sm">
              <div className="flex flex-col items-center">
                <div className="mb-4">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600"></div>
                </div>
                <span className="text-xl font-medium text-gray-700">
                  {executionMode === 'single' 
                    ? 'Flow 실행 중...' 
                    : 'Flow 체인 실행 중...'}
                </span>
                <p className="text-sm text-gray-500 mt-2">잠시만 기다려주세요. 처리 중입니다.</p>
              </div>
            </div>
          </div>
        )}

        {stage === 'result' && (
          <div className="flex flex-row h-[calc(100%-4rem)] gap-4 max-w-[95%] mx-auto">
            {/* 왼쪽 패널: Flow 설정 */}
            <div className="w-1/2 overflow-y-auto pr-2">
              <h2 className="text-lg font-semibold mb-4 text-gray-700 border-b pb-2">Flow 설정</h2>
              {renderExecutionModeSelector()}
              <FlowChainManager onSelectFlow={handleFlowSelect} />
              
              <div className="mt-6 flex justify-center space-x-3">
                <button
                  onClick={handleBackToInput}
                  className="px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors flex items-center shadow-sm"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z" />
                  </svg>
                  입력 수정
                </button>
                <button
                  onClick={executionMode === 'single' ? handleExecuteSingleFlow : handleExecuteChain}
                  className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center shadow-sm"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  다시 실행
                </button>
              </div>
            </div>
            
            {/* 오른쪽 패널: 입력 폼 + 결과 패널 분할 */}
            <div className="w-1/2 overflow-y-auto pl-2 flex flex-col gap-4">
              {/* 입력 폼 섹션 */}
              <div className="flex-1 min-h-[45%]">
                <div className="border border-gray-300 rounded-lg bg-white overflow-hidden">
                  <div className="p-4 bg-gray-50 border-b border-gray-300">
                    <h2 className="font-medium text-lg">입력 데이터</h2>
                    <p className="text-sm text-gray-600">Flow 입력 데이터를 확인하세요.</p>
                  </div>
                  
                  <div className="p-4">
                    {selectedFlowId ? (
                      <pre className="p-3 bg-gray-50 rounded border border-gray-200 max-h-60 overflow-y-auto whitespace-pre-wrap text-sm">
                        {JSON.stringify(getFlowById(selectedFlowId)?.inputData || [], null, 2)}
                      </pre>
                    ) : (
                      <p className="text-gray-500">Flow를 선택하여 입력 데이터를 확인하세요.</p>
                    )}
                  </div>
                </div>
              </div>
              
              {/* 결과 패널 섹션 */}
              <div className="flex-1 min-h-[45%]">
                <h2 className="text-lg font-semibold mb-2 text-gray-700 border-b pb-2">실행 결과</h2>
                {executionMode === 'single' && selectedFlowId ? (
                  // 단일 Flow 결과 표시
                  <ResultDisplay
                    result={getFlowResultById(selectedFlowId)}
                    isLoading={isExecuting}
                    error={error}
                  />
                ) : (
                  // 전체 체인 결과 표시
                  <div className="space-y-4">
                    {flowChain
                      .filter(flow => flow.result !== null)
                      .map((flow) => (
                        <div key={flow.id} className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
                          <h3 className="font-medium text-lg mb-2 flex items-center text-blue-700">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                            </svg>
                            {flow.name} 결과
                          </h3>
                          <ResultDisplay
                            result={flow.result}
                            isLoading={false}
                            error={null}
                          />
                        </div>
                      ))}
                      
                    {flowChain.filter(flow => flow.result !== null).length === 0 && (
                      <p className="text-gray-500">아직 실행된 Flow가 없습니다.</p>
                    )}
                    
                    {error && (
                      <div className="p-4 bg-red-50 border border-red-200 rounded text-red-600">
                        <h3 className="font-medium mb-2 flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          오류
                        </h3>
                        <p>{error}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExecutorPage; 