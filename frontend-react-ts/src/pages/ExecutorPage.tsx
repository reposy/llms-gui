import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import FileUploader from '../components/executor/FileUploader';
import FlowChainManager from '../components/executor/FlowChainManager';
import FlowInputForm from '../components/executor/FlowInputForm';
import ResultDisplay from '../components/executor/ResultDisplay';
import { executeFlow, executeChain } from '../services/flowExecutionService';
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
    resetResults
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
      });

      if (response.status === 'error') {
        setError(response.error || '플로우 실행 중 알 수 없는 오류가 발생했습니다.');
      } else {
        setFlowResult(flow.id, response.outputs);
      }
    } catch (err) {
      setError('플로우 실행에 실패했습니다. 입력 데이터를 확인하고 다시 시도해주세요.');
      console.error('실행 오류:', err);
    } finally {
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
        },
        onError: (flowId, errorMsg) => {
          console.error(`Error executing flow ${flowId}:`, errorMsg);
          setError(`Flow "${getFlowById(flowId)?.name || flowId}" 실행 중 오류: ${errorMsg}`);
        }
      });
    } catch (err) {
      setError('Flow 체인 실행에 실패했습니다. 입력 데이터를 확인하고 다시 시도해주세요.');
      console.error('체인 실행 오류:', err);
    } finally {
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
        <div className="space-y-2">
          <label className="flex items-center space-x-2">
            <input
              type="radio"
              name="execution-mode"
              checked={executionMode === 'single'}
              onChange={() => handleExecutionModeChange('single')}
              className="form-radio h-4 w-4 text-blue-600"
            />
            <span>단일 Flow 실행</span>
          </label>
          <label className="flex items-center space-x-2">
            <input
              type="radio"
              name="execution-mode"
              checked={executionMode === 'chain'}
              onChange={() => handleExecutionModeChange('chain')}
              className="form-radio h-4 w-4 text-blue-600"
            />
            <span>전체 Flow 체인 실행</span>
          </label>
          <p className="text-sm text-gray-500 mt-2">
            {executionMode === 'single' 
              ? '선택한 단일 Flow만 실행합니다.' 
              : '모든 Flow를 순서대로 실행하며, 이전 Flow 결과를 다음 Flow의 입력으로 사용할 수 있습니다.'}
          </p>
        </div>
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
          className={`px-6 py-3 rounded-lg text-white font-medium ${
            canExecute && selectedFlowId
              ? (hasInputs ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700')
              : 'bg-gray-400 cursor-not-allowed'
          } transition-colors`}
          title={!canExecute ? 'Flow를 추가해야 합니다.' : (!selectedFlowId ? 'Flow를 선택해야 합니다.' : '')}
        >
          {selectedFlow
            ? (hasInputs ? `"${selectedFlow.name}" 실행` : `"${selectedFlow.name}" 실행 (입력 필요)`)
            : '선택된 Flow 실행'}
        </button>
      );
    } else {
      return (
        <button
          onClick={handleExecuteChain}
          disabled={!canExecute}
          className={`px-6 py-3 rounded-lg text-white font-medium ${
            canExecute ? 'bg-purple-600 hover:bg-purple-700' : 'bg-gray-400 cursor-not-allowed'
          } transition-colors`}
          title={!canExecute ? 'Flow를 추가해야 합니다.' : ''}
        >
          {`Flow 체인 실행 (${flowChain.length}개)`}
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
            <div key={item.flowId} className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-medium text-lg mb-2">{item.flowName} 결과</h3>
              <ResultDisplay
                result={item.result}
                isLoading={false}
                error={null}
              />
            </div>
          ))}
          
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded text-red-600">
              <h3 className="font-medium mb-2">오류</h3>
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
              
              <div className="mt-6 flex justify-center">
                {renderExecuteButton()}
              </div>
            </div>
            
            {/* 오른쪽 패널: 선택된 Flow의 입력 데이터 */}
            <div className="w-1/2 overflow-y-auto pl-2">
              {selectedFlowId ? (
                <FlowInputForm flowId={selectedFlowId} />
              ) : (
                <div className="h-full flex items-center justify-center p-4 border border-gray-300 rounded-lg bg-white">
                  <div className="text-center text-gray-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                    </svg>
                    <p className="text-lg font-medium mb-2">Flow를 선택해주세요</p>
                    <p className="text-sm">
                      왼쪽에서 Flow를 선택하면 입력 데이터를 설정할 수 있습니다.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {stage === 'executing' && (
          <div className="max-w-[95%] mx-auto">
            <div className="flex items-center justify-center p-8 border border-gray-300 rounded-lg bg-white">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <span className="ml-3">
                {executionMode === 'single' 
                  ? 'Flow 실행 중...' 
                  : 'Flow 체인 실행 중...'}
              </span>
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
                  className="px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
                >
                  입력 수정
                </button>
                <button
                  onClick={executionMode === 'single' ? handleExecuteSingleFlow : handleExecuteChain}
                  className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                >
                  다시 실행
                </button>
              </div>
            </div>
            
            {/* 오른쪽 패널: 실행 결과 */}
            <div className="w-1/2 overflow-y-auto pl-2">
              <h2 className="text-lg font-semibold mb-4 text-gray-700 border-b pb-2">실행 결과</h2>
              {renderResults()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExecutorPage; 