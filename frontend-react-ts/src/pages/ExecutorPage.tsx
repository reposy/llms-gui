import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import FileUploader from '../components/executor/FileUploader';
import InputDataForm from '../components/executor/InputDataForm';
import ResultDisplay from '../components/executor/ResultDisplay';
import { executeFlow } from '../services/flowExecutionService';
import { useExecutorStateStore } from '../store/useExecutorStateStore';

const ExecutorPage: React.FC = () => {
  // 파일 입력 참조
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 로컬 상태
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [hasSubmittedInput, setHasSubmittedInput] = useState<boolean>(false);
  
  // Zustand 스토어에서 상태와 액션 가져오기
  const {
    flowJson,
    inputData,
    result,
    error,
    stage,
    setFlowJson,
    setInputData,
    setResult,
    setError,
    setStage
  } = useExecutorStateStore();
  
  // Zustand 상태가 변경되면 동기화
  useEffect(() => {
    // 이전 세션에서 이미 플로우를 불러왔다면 해당 단계부터 시작
    if (flowJson && stage === 'upload') {
      setStage('input');
    }
    
    // 저장된 입력 데이터가 있으면 제출 상태 설정
    if (inputData && inputData.length > 0) {
      setHasSubmittedInput(true);
    }
  }, [flowJson, stage, setStage, inputData]);

  // 플로우 JSON 업로드 처리
  const handleFileUpload = (jsonData: any) => {
    setFlowJson(jsonData);
    setStage('input');
    setResult(null);
    setError(null);
  };

  // 입력 데이터 처리
  const handleInputDataSubmit = (data: any[]) => {
    setInputData(data);
    setHasSubmittedInput(true);
    console.log('Input data submitted:', data);
  };

  // 워크플로우 실행
  const handleExecute = async () => {
    if (!flowJson) {
      setError('먼저 플로우 JSON 파일을 업로드해주세요.');
      return;
    }
    
    // 입력 데이터가 Submit 되었는지 확인
    if (!hasSubmittedInput || !inputData || inputData.length === 0) {
      if (!window.confirm('입력 데이터가 제출되지 않았습니다. 빈 입력 데이터로 실행하시겠습니까?')) {
        return;
      }
    }

    setIsExecuting(true);
    setStage('executing');
    setError(null);

    try {
      const response = await executeFlow({
        flowJson,
        inputs: inputData || [],
      });

      if (response.status === 'error') {
        setError(response.error || '플로우 실행 중 알 수 없는 오류가 발생했습니다.');
      } else {
        setResult(response.outputs);
      }
    } catch (err) {
      setError('플로우 실행에 실패했습니다. 입력 데이터를 확인하고 다시 시도해주세요.');
      console.error('실행 오류:', err);
    } finally {
      setIsExecuting(false);
      setStage('result');
    }
  };

  // 처음부터 다시 시작 - Change Flow 버튼 클릭 시
  const handleReset = () => {
    if (window.confirm('다른 플로우를 가져오면 Flow Editor에 반영됩니다. 계속하시겠습니까? Flow Editor에 저장되지 않은 내용이 있다면 덮어쓰게 됩니다.')) {
      // 파일 선택 대화상자 직접 열기
      fileInputRef.current?.click();
    }
  };
  
  // Input 단계로 되돌아가기
  const handleBackToInput = () => {
    setStage('input');
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
              <span className="mt-2">Provide Input</span>
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
            // 실제 처리는 FileUploader 컴포넌트에서 수행됨
          }}
        />

        {stage === 'upload' && (
          <div className="max-w-[95%] mx-auto">
            <FileUploader onFileUpload={handleFileUpload} externalFileInputRef={fileInputRef} />
          </div>
        )}

        {/* 좌우 분할 레이아웃 (input, executing, result 단계에서 적용) */}
        {(stage === 'input' || stage === 'executing' || stage === 'result') && (
          <div className={`${stage === 'result' ? 'flex flex-row h-[calc(100%-4rem)]' : 'flex flex-col'} gap-4 max-w-[95%] mx-auto`}>
            {/* 왼쪽 패널: Flow Configuration과 Input Data */}
            <div className={`${stage === 'result' ? 'w-1/2 overflow-y-auto pr-4 h-full' : 'w-full'}`}>
              {stage === 'result' && (
                <h2 className="text-lg font-semibold mb-4 text-gray-700 border-b pb-2">입력 설정</h2>
              )}

              <div className="p-3 border border-gray-300 rounded-lg bg-white mb-6">
                <div className="flex justify-between items-center mb-2">
                  <h2 className="text-lg font-medium">Flow Configuration</h2>
                  <button 
                    onClick={handleReset}
                    className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                  >
                    Change Flow
                  </button>
                </div>
                <div className="p-2 bg-gray-50 rounded border border-gray-200">
                  <p className="font-medium">{flowJson?.name || 'Uploaded Flow'}</p>
                  <p className="text-sm text-gray-600">
                    {flowJson?.nodes?.length || 0} nodes, {flowJson?.edges?.length || 0} connections
                  </p>
                </div>
              </div>

              <InputDataForm onInputDataSubmit={handleInputDataSubmit} />

              {stage === 'input' && (
                <div className="flex justify-center mt-6">
                  <button
                    onClick={handleExecute}
                    className={`px-6 py-3 rounded-lg text-white font-medium ${
                      hasSubmittedInput ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'
                    } transition-colors`}
                    title={hasSubmittedInput ? '제출된 입력 데이터로 실행' : '입력 데이터가 아직 제출되지 않음'}
                  >
                    {hasSubmittedInput 
                      ? 'Execute Flow' 
                      : 'Execute Flow (Submit Input First)'}
                  </button>
                </div>
              )}
            </div>

            {/* 분할선 - 결과 단계에서만 표시 */}
            {stage === 'result' && (
              <div className="h-full w-px bg-gray-300"></div>
            )}

            {/* 오른쪽 패널: 실행 결과 (executing, result 단계에서만 표시) */}
            {(stage === 'executing' || stage === 'result') && (
              <div className={`${stage === 'result' ? 'w-1/2 overflow-y-auto pl-4 h-full' : 'w-full'}`}>
                {stage === 'result' && (
                  <h2 className="text-lg font-semibold mb-4 text-gray-700 border-b pb-2">실행 결과</h2>
                )}
                
                <ResultDisplay 
                  result={result} 
                  isLoading={isExecuting} 
                  error={error} 
                />
                
                {stage === 'result' && !isExecuting && (
                  <div className="flex justify-center mt-6">
                    <button
                      onClick={handleExecute}
                      className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                    >
                      Run Again
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExecutorPage; 