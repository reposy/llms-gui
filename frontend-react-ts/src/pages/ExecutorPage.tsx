import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import FileUploader from '../components/executor/FileUploader';
import FlowChainManager from '../components/executor/FlowChainManager';
import FlowInputForm from '../components/executor/FlowInputForm';
import ResultDisplay from '../components/executor/ResultDisplay';
import { executeFlowExecutor, executeChain, registerResultCallback } from '../services/flowExecutionService';
import { useExecutorStateStore, ExecutorStage } from '../store/useExecutorStateStore';
import { useExecutorGraphStore } from '../store/useExecutorGraphStore';
import ExportModal from '../components/executor/ExportModal';
import ExecutorPanel from '../components/executor/ExecutorPanel';
import StageNavigationBar from '../components/executor/stages/StageNavigationBar';
import UploadStageView from '../components/executor/stages/UploadStageView';
import InputStageView from '../components/executor/stages/InputStageView';
import ExecutingStageView from '../components/executor/stages/ExecutingStageView';
import ResultStageView from '../components/executor/stages/ResultStageView';

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
    
    // 선택된 Flow가 변경될 때 결과 단계에서는 결과를 확인
    const result = getFlowResultById(selectedFlowId);
    if (result && stage === 'result') {
      // 결과가 이미 있으면, 화면을 갱신하기 위한 상태 업데이트 트리거
      // 이렇게 하면 같은 값이라도 상태 변경으로 인식되어 컴포넌트가 갱신됨
      setFlowResult(selectedFlowId, result);
    }
    
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
  }, [selectedFlowId, setFlowResult, getFlowResultById, stage, isExecuting]);

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
    
    setIsExecuting(true);
    setStage('executing');
    setError(null);

    try {
      const response = await executeFlowExecutor({
        flowId: flow.id,
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
    
    resetResults();
    
    try {
      const flowItems = flowChain.map(flow => ({
        id: flow.id,
        flowJson: flow.flowJson,
        inputData: flow.inputData
      }));
      
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
      {/* 상단 네비게이션 바 - 컴포넌트로 분리 */}
      <ExecutorPanel 
        onImportFlowChain={handleImportFlowChain}
        onExportFlowChain={handleExportWithFilename}
        onExecuteFlow={handleExecuteChain}
        onClearAll={handleClearAll}
        isExecuting={isExecuting}
      />

      {/* 탭 네비게이션 -> StageNavigationBar 컴포넌트로 대체 */}
      <StageNavigationBar 
        currentStage={stage}
        onStageChange={setStage}
        canSetInput={canSetInput}
        canViewResults={canViewResults}
      />
      
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
        
        {stage === 'upload' && <UploadStageView />}
        
        {/* 입력 단계 -> InputStageView 컴포넌트로 대체 */}
        {stage === 'input' && (
          <InputStageView 
            selectedFlowId={selectedFlowId}
            onSelectFlow={handleFlowSelect}
            onImportFlowChain={handleImportFlowChain}
            renderExecuteButton={renderExecuteButton}
            getFlowById={getFlowById}
            getFlowResultById={getFlowResultById}
          />
        )}
        
        {/* 실행 중 단계 -> ExecutingStageView 컴포넌트로 대체 */}
        {stage === 'executing' && <ExecutingStageView />}
        
        {/* 결과 단계 -> ResultStageView 컴포넌트로 대체 */}
        {stage === 'result' && (
          <ResultStageView 
            selectedFlowId={selectedFlowId}
            onSelectFlow={handleFlowSelect}
            onImportFlowChain={handleImportFlowChain}
            onBackToInput={handleBackToInput}
            onExecuteSingleFlow={handleExecuteSingleFlow}
            renderResults={renderResults} 
          />
        )}
      </div>
    </div>
  );
};

export default ExecutorPage; 