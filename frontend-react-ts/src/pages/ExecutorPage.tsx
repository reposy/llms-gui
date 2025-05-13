import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import FileUploader from '../components/executor/FileUploader';
import FlowChainManager from '../components/executor/FlowChainManager';
import FlowInputForm from '../components/executor/FlowInputForm';
import ResultDisplay from '../components/executor/ResultDisplay';
import { executeFlowExecutor, executeChain, registerResultCallback } from '../services/flowExecutionService';
import { useExecutorStateStore } from '../store/useExecutorStateStore';
import { useExecutorGraphStore } from '../store/useExecutorGraphStore';
import ExportModal from '../components/executor/ExportModal';

const ExecutorPage: React.FC = () => {
  // 파일 입력 참조
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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
    
    // 결과가 있는 경우 result 단계로 전환
    const result = getFlowResultById(flowId);
    if (result && stage !== 'result') {
      setStage('result');
    }
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
  }, [selectedFlowId, setFlowResult, getFlowResultById, stage]);

  // Flow 체인 가져오기
  const handleImportFlowChain = () => {
    try {
      // 파일 선택기 생성
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json';
      
      // 파일 선택 처리
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const json = event.target?.result as string;
            let importData;
            
            try {
              importData = JSON.parse(json);
            } catch (parseError) {
              console.error(`[ExecutorPage] JSON 파싱 오류:`, parseError);
              alert('JSON 파일 형식이 올바르지 않습니다.');
              return;
            }
            
            // 기본 유효성 검사
            if (!importData || typeof importData !== 'object') {
              throw new Error('유효하지 않은 Flow 체인 파일 형식입니다.');
            }
            
            // 버전 확인
            if (!importData.version) {
              console.warn('[ExecutorPage] 버전 정보가 없는 파일입니다.');
              // 버전 없이 계속 진행
            }
            
            // flowChain 배열 존재 확인
            if (!Array.isArray(importData.flowChain)) {
              // flowChain이 없으면 단일 Flow JSON으로 가정하고 변환 시도
              console.log('[ExecutorPage] flowChain 배열이 없습니다. 단일 Flow JSON으로 처리합니다.');
              
              // 단일 Flow 객체 생성
              importData = {
                version: '1.0',
                flowChain: [{
                  id: `flow-${Date.now()}`,
                  name: file.name.replace(/\.json$/, '') || '가져온 Flow',
                  flowJson: importData,
                  inputData: []
                }]
              };
            }
            
            // 각 Flow 추가
            importData.flowChain.forEach((flow: any) => {
              try {
                // flowJson 유효성 검사
                if (!flow.flowJson || typeof flow.flowJson !== 'object') {
                  console.warn(`[ExecutorPage] 유효하지 않은 flowJson 형식, flow:`, flow);
                  return; // 이 Flow는 건너뛰고 계속 진행
                }
                
                // 원본 ID 보존: flow.id가 있으면 해당 ID 사용, 없으면 파일명 기반 ID 생성
                const flowName = flow.name || flow.flowJson.name || '가져온-flow';
                const timestamp = Date.now();
                const random = Math.floor(Math.random() * 1000);
                
                // 파일명에서 특수문자 제거하고 소문자로 변환하여 ID 생성
                const namePart = flowName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase().substring(0, 20);
                const flowId = flow.id || `${namePart}-${timestamp}-${random}`;
                
                const flowToAdd = {
                  ...flow.flowJson,
                  id: flowId
                };
                
                // Flow 추가 (원본 ID 보존)
                addFlow(flowToAdd);
                
                // 입력 데이터 설정
                if (flow.inputData && flow.inputData.length > 0) {
                  setFlowInputData(flowId, flow.inputData);
                }
              } catch (flowError) {
                console.error(`[ExecutorPage] Flow 추가 중 오류:`, flowError);
                // 이 Flow는 건너뛰고 계속 진행
              }
            });
            
            console.log(`[ExecutorPage] Flow chain imported successfully`);
          } catch (error) {
            console.error(`[ExecutorPage] Error parsing imported flow chain:`, error);
            alert(`Flow 체인 파일을 파싱하는 도중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
          }
        };
        
        reader.readAsText(file);
      };
      
      // 파일 선택기 클릭
      input.click();
    } catch (error) {
      console.error(`[ExecutorPage] Error importing flow chain:`, error);
      alert('Flow 체인 가져오기 중 오류가 발생했습니다.');
    }
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
  
  // 처음부터 다시 시작 - Change Flow 버튼 클릭 시
  const handleReset = () => {
    // 파일 선택 대화상자 직접 열기
    fileInputRef.current?.click();
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

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 상단 네비게이션 바 */}
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900">Flow Executor</h1>
        <div className="flex gap-2">
          <button
            onClick={handleClearAll}
            className="px-3 py-1 text-red-600 border border-red-600 rounded hover:bg-red-50 transition-colors text-sm font-medium flex items-center"
            title="모든 Flow와 실행 결과를 초기화합니다."
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            모든 내용 초기화
          </button>
          
          <button
            onClick={handleImportFlowChain}
            className="px-3 py-1 text-blue-600 border border-blue-600 rounded hover:bg-blue-50 transition-colors text-sm font-medium flex items-center"
            title="Flow Chain 파일을 가져와서 전체 Flow 환경을 복원합니다"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Flow Chain 가져오기
          </button>
          
          <button
            onClick={() => {
              handleExportWithFilename(`flow-chain-${new Date().toISOString().slice(0, 10)}.json`, false);
            }}
            className={`px-3 py-1 text-blue-600 border border-blue-600 rounded hover:bg-blue-50 transition-colors text-sm font-medium flex items-center ${flowChain.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={flowChain.length === 0}
            title="Flow 체인을 데이터 없이 내보냅니다"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            내보내기
          </button>
          
          <Link
            to="/editor"
            className="px-3 py-1 text-blue-600 border border-blue-600 rounded hover:bg-blue-50 transition-colors text-sm font-medium flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Go to Editor
          </Link>
          
          <button
            className="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors shadow-sm text-sm font-medium flex items-center"
            onClick={handleExecuteSingleFlow}
            disabled={isExecuting}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            플로우 실행
          </button>
        </div>
      </nav>

      {/* 내보내기 모달 */}
      {exportModalOpen && (
        <ExportModal
          isOpen={exportModalOpen}
          onClose={() => setExportModalOpen(false)}
          onExport={handleExportWithFilename}
          defaultFilename={`flow-chain-${new Date().toISOString().slice(0, 10)}.json`}
        />
      )}

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
                  onClick={handleExecuteSingleFlow}
                  className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center shadow-sm"
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