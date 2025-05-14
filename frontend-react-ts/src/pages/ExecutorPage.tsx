import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import FileUploader from '../components/executor/FileUploader';
import FlowChainManager from '../components/executor/FlowChainManager';
import FlowInputForm from '../components/executor/FlowInputForm';
import ResultDisplay from '../components/executor/ResultDisplay';
import { executeFlowExecutor, executeChain, registerResultCallback } from '../services/flowExecutionService';
import { useExecutorStateStore, ExecutorStage, FlowExecutionResult } from '../store/useExecutorStateStore';
import { useExecutorGraphStore } from '../store/useExecutorGraphStore';
import ExportModal from '../components/executor/ExportModal';
import ExecutorPanel from '../components/executor/ExecutorPanel';
import StageNavigationBar from '../components/executor/stages/StageNavigationBar';

const ExecutorPage: React.FC = () => {
  // 로컬 상태
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  
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
    getFlowResultById,
    addFlow,
    setFlowInputData
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
    setStage('input'); // Flow 선택 시 항상 'input' stage로 설정
  };

  // 선택된 Flow 또는 activeFlow가 변경될 때 콜백 등록
  useEffect(() => {
    if (!selectedFlowId) return;
    
    const currentResult = getFlowResultById(selectedFlowId);
    if (currentResult && stage === 'result') {
      setFlowResult(selectedFlowId, currentResult);
    }
    
    const unregister = registerResultCallback(selectedFlowId, (outputsArray) => {
      // outputsArray는 실제 결과 배열 (NodeResult[] 등)로 가정
      // 이를 FlowExecutionResult 객체로 감싸서 저장
      console.log(`[ExecutorPage] registerResultCallback received for ${selectedFlowId}:`, outputsArray);
      // 현재 상태를 알 수 없으므로, 기본적으로 success로 가정하되, 실제 실행 서비스와 맞춰야 함.
      // executeFlowExecutor는 성공 시 outputs를, 에러 시 error 객체를 반환함.
      // registerResultCallback은 outputs만 전달하므로, 이 콜백이 호출되는 시점은 성공적으로 outputs가 생성된 경우로 볼 수 있음.
      setFlowResult(selectedFlowId, { 
        status: 'success', // 또는 이 콜백이 호출되는 시점의 정확한 상태를 반영해야 함
        outputs: outputsArray, 
        error: undefined 
      });
      
      if (isExecuting) {
        setIsExecuting(false);
        if (stage === 'executing') {
          setStage('result');
        }
      }
    });
    
    return () => {
      unregister();
    };
  }, [selectedFlowId, setFlowResult, getFlowResultById, stage, isExecuting]); // isExecuting 제거 가능성 있음, 의존성 확인 필요

  // Flow 체인 가져오기
  const handleImportFlowChain = () => {
    // 파일 선택기 열기 (ExecutorPanel 내부 FileSelector에서 처리됨)
    // 이 함수는 ExecutorPanel로 전달되어 해당 컴포넌트에서 사용됨
  };
  
  // 내보내기 처리
  const handleExportWithFilename = (filename: string, includeData: boolean) => {
    try {
      // 현재 체인 데이터 추출
      const exportData = {
        version: '1.0',
        flowChain: flowChain.map(flow => {
          const result = includeData ? getFlowResultById(flow.id) : null;
          return {
            id: flow.id,
            name: flow.name,
            flowJson: flow.flowJson,
            inputData: flow.inputData || [],
            result: result // 옵션에 따라 결과 데이터 포함
          };
        })
      };
      
      // JSON 변환 및 파일 다운로드
      const json = JSON.stringify(exportData, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      
      // 정리
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      console.log(`[ExecutorPage] Flow chain exported successfully with ${includeData ? '' : 'no '}data`);
    } catch (error) {
      console.error(`[ExecutorPage] Error exporting flow chain:`, error);
      alert('Flow 체인 내보내기 중 오류가 발생했습니다.');
    }
  };

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
    
    // FlowChainManager의 handleExecuteFlow를 직접 호출하도록 변경 고려
    // 또는 여기서 setFlowResult를 사용하여 상태를 'running'으로 설정
    setFlowResult(selectedFlowId, { status: 'running', outputs: null, error: undefined });
    setIsExecuting(true);
    setStage('executing');
    setError(null);

    try {
      // executeFlowExecutor는 FlowExecutionResult를 반환하므로 onComplete 콜백 불필요
      const response: FlowExecutionResult = await executeFlowExecutor({
        flowId: flow.id,
        flowJson: flow.flowJson,
        inputs: flow.inputData || [],
        // onComplete 콜백 제거
      });

      // 실행 결과로 상태 업데이트
      setFlowResult(flow.id, response);

      if (response.status === 'error') {
        setError(response.error || '플로우 실행 중 알 수 없는 오류가 발생했습니다.');
        setStage('result'); // 오류 발생 시에도 결과 스테이지로 이동하여 ResultDisplay에 오류 표시
      } else {
        setStage('result');
      }
    } catch (err: any) {
      const errorMessage = err.message || '플로우 실행에 실패했습니다. 입력 데이터를 확인하고 다시 시도해주세요.';
      setError(errorMessage);
      setFlowResult(selectedFlowId, { status: 'error', outputs: null, error: errorMessage });
      setStage('result'); // 예외 발생 시에도 결과 스테이지로 이동
      console.error('실행 오류:', err);
    } finally {
      setIsExecuting(false); // 실행 상태는 항상 해제
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
    // resetResults(); // 체인 실행 시 이전 결과는 유지하고 각 Flow의 상태만 업데이트하므로 주석 처리
    
    try {
      const flowItems = flowChain.map(flow => ({
        id: flow.id,
        flowJson: flow.flowJson,
        inputData: flow.inputData
      }));
      
      // executeChain은 FlowExecutionResultForService 타입을 콜백으로 전달
      // useExecutorStateStore의 setFlowResult는 FlowExecutionResult 타입을 받음
      // 두 타입 구조가 동일하므로 호환 가능 (as FlowExecutionResult 캐스팅은 불필요)
      await executeChain({
        flowItems,
        onFlowStart: (flowId) => { // 체인 내 개별 Flow 시작 시
          setFlowResult(flowId, { status: 'running', outputs: null, error: undefined });
        },
        onFlowComplete: (flowId, chainResult ) => { // chainResult는 FlowExecutionResultForService 타입
          console.log(`Flow ${flowId} completed with result:`, chainResult);
          setFlowResult(flowId, chainResult); // 타입 호환됨
          
          const isLastFlow = flowId === flowItems[flowItems.length - 1].id;
          if (isLastFlow) {
            setIsExecuting(false);
            setStage('result');
          }
        },
        onError: (flowId, errorData) => { // errorData는 Error | string 타입
          console.error(`Error executing flow ${flowId}:`, errorData);
          const errorMessage = typeof errorData === 'string' ? errorData : errorData.message;
          setError(`Flow "${getFlowById(flowId)?.name || flowId}" 실행 중 오류: ${errorMessage}`);
          setFlowResult(flowId, { status: 'error', outputs: null, error: errorMessage });
          
          // 체인 실행 중 하나의 Flow라도 에러나면 전체 실행 상태를 false로, stage를 result로 변경
          setIsExecuting(false);
          setStage('result');
        }
      });

      // 모든 Flow가 성공적으로 완료되었는지 확인 (에러 발생 시 onError에서 처리됨)
      const allSucceeded = flowItems.every(item => getFlowResultById(item.id)?.status === 'success');
      if (allSucceeded && !isExecuting) { // isExecuting이 false로 설정된 후 (마지막 flow 완료 또는 에러로 중단 시)
         // 이 부분은 isLastFlow 조건 또는 onError에서 이미 처리되므로 중복될 수 있음.
         // 만약 모든 Flow가 성공하고 isExecuting이 여전히 true라면 (매우 드문 케이스), 여기서 false로 설정.
         // 하지만 onError나 isLastFlow에서 이미 처리되므로 사실상 불필요.
      }

    } catch (err: any) {
      const errorMessage = err.message || 'Flow 체인 실행에 실패했습니다. 입력 데이터를 확인하고 다시 시도해주세요.';
      setError(errorMessage);
      console.error('체인 실행 오류:', err);
      setIsExecuting(false);
      setStage('result');
    }
  };
  
  // 처음부터 다시 시작 - Change Flow 버튼 클릭 시
  const handleReset = () => {
    // Flow 체인 가져오기 함수 호출
    if (handleImportFlowChain) {
      handleImportFlowChain();
    }
  };
  
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
        onClick={handleExecuteSingleFlow}
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

  // 모든 내용 초기화 처리
  const handleClearAll = () => {
    if (window.confirm('모든 내용을 초기화하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      // 스토어 초기화
      useExecutorStateStore.getState().resetState();
      useExecutorGraphStore.getState().resetFlowGraphs();
      
      // 상태 초기화
      setStage('upload');
      setSelectedFlowId(null);
      setError(null);
      setIsExecuting(false);
    }
  };

  // Props for StageNavigationBar
  const canSetInput = flowChain.length > 0;
  const canViewResults = !!(selectedFlowId && getFlowResultById(selectedFlowId));

  return (
    <div className="min-h-screen bg-gray-100">
      <ExecutorPanel 
        onImportFlowChain={handleImportFlowChain}
        onExportFlowChain={handleExportWithFilename}
        onExecuteFlow={handleExecuteChain}
        onClearAll={handleClearAll}
        isExecuting={isExecuting}
      />

      <StageNavigationBar 
        currentStage={stage}
        onStageChange={setStage}
        canSetInput={canSetInput}
        canViewResults={canViewResults}
      />
      
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
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
        
        {stage === 'upload' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4 text-gray-700">Flow 업로드</h2>
            <p className="mb-4 text-gray-600">Flow JSON 파일을 업로드하거나, Flow Editor에서 생성한 Flow를 불러오세요.</p>
            <FileUploader />
          </div>
        )}
        
        {(stage === 'input' || stage === 'executing') && (
          <div className="flex space-x-4">
            {/* 왼쪽 패널: Flow 체인 */}
            <div className="w-1/2 overflow-y-auto pr-2">
              <FlowChainManager 
                onSelectFlow={handleFlowSelect} 
                // handleImportFlowChain prop은 FlowChainManager 내부에서 직접 파일 업로더를 사용하거나 
                // ExecutorPanel에서 처리되므로 여기서는 제거하거나, 필요시 ExecutorPanel로부터 내려받는 구조로 변경
                // 현재 FlowChainManager는 자체적으로 파일 가져오기 버튼이 있으므로 별도 prop 불필요
              />
            </div>
            
            {/* 오른쪽 패널 */}
            <div className="w-1/2 overflow-y-auto pl-2 space-y-4">
              {stage === 'input' && (
                selectedFlowId ? (
                  <>
                    <FlowInputForm flowId={selectedFlowId} />
                    <div className="mt-0">
                      {renderExecuteButton()} 
                    </div>
                    {getFlowResultById(selectedFlowId) && (
                      <div className="border border-gray-300 rounded-lg bg-white overflow-hidden mt-4">
                        <div className="p-4 bg-gray-50 border-b border-gray-300">
                          <h2 className="font-medium text-lg">최근 실행 결과</h2>
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
                )
              )}
              
              {stage === 'executing' && (
                <div className="border border-gray-300 rounded-lg p-10 text-center bg-white">
                  <div className="flex flex-col items-center justify-center">
                    <svg className="animate-spin h-12 w-12 text-blue-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <h3 className="text-lg font-medium text-gray-800 mb-2">Flow 실행 중...</h3>
                    <p className="text-gray-500">실행이 완료되면 결과가 표시됩니다.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        
        {stage === 'result' && (
          <div className="flex space-x-4">
            {/* 왼쪽 패널: Flow 설정 */}
            <div className="w-1/2 overflow-y-auto pr-2">
              <h2 className="text-lg font-semibold mb-4 text-gray-700 border-b pb-2">Flow 설정</h2>
              <FlowChainManager 
                onSelectFlow={handleFlowSelect} 
              />
              
              <div className="mt-4 flex space-x-2">
                <button
                  onClick={handleBackToInput}
                  className="px-4 py-2 border border-gray-300 bg-white text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors shadow-sm flex-1"
                >
                  입력 수정
                </button>
                <button
                  onClick={handleExecuteSingleFlow}
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
              <div className="flex-1 min-h-[45%]">
                <h2 className="text-lg font-semibold mb-2 text-gray-700 border-b pb-2">실행 결과</h2>
                {renderResults()}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExecutorPage; 