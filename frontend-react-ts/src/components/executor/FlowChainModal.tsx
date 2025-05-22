import React, { useState, useEffect } from 'react';
import { useFlowExecutorStore } from '../../store/useFlowExecutorStore';
import { executeFlowExecutor } from '../../services/flowExecutionService';
import FlowInputForm from './FlowInputForm';
import ResultDisplay from './ResultDisplay';
import ReactMarkdown from 'react-markdown';
import { ExecutionStatus } from '../../store/useExecutorStateStore';

// ResultDisplay 컴포넌트에서 기대하는 인터페이스와 동일하게 정의
interface FlowExecutionResult {
  status: ExecutionStatus;
  outputs: any[]; // 항상 배열로 정의
  error?: string;
  flowId?: string;
}

interface FlowChainModalProps {
  isOpen: boolean;
  onClose: () => void;
  flowChainId: string;
  flowId: string;
}

const FlowChainModal: React.FC<FlowChainModalProps> = ({
  isOpen,
  onClose,
  flowChainId,
  flowId
}) => {
  const [activeTab, setActiveTab] = useState<'input' | 'result'>('input');
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [resultTab, setResultTab] = useState<'node' | 'output'>('node');
  const [outputFormat, setOutputFormat] = useState<'text' | 'markdown'>('text');
  const flow = useFlowExecutorStore(state => state.flowChainMap[flowChainId]?.flowMap[flowId]);

  // 모달이 닫힐 때 입력 탭으로 초기화
  useEffect(() => {
    if (!isOpen) {
      setActiveTab('input');
    }
  }, [isOpen]);

  // flow.lastResults 변경 감지 및 탭 전환
  useEffect(() => {
    if (flow?.lastResults) {
      // 결과가 있으면 결과 탭으로 전환
      if (flow.lastResults.length > 0) {
        console.log(`[FlowChainModal] 결과 감지: ${flow.lastResults.length}개 항목, 결과 탭으로 전환`);
        setActiveTab('result');
      }
    }
  }, [flow?.lastResults]);

  if (!isOpen || !flow) return null;

  const handleExecuteFlow = async () => {
    if (isExecuting) return;
    setIsExecuting(true);
    useFlowExecutorStore.getState().setFlowStatus(flowChainId, flowId, 'running');
    try {
      // 입력 전처리
      let execInputs = flow.inputs;
      if (Array.isArray(execInputs) && execInputs.length > 0 && typeof execInputs[0] === 'object' && 'value' in execInputs[0]) {
        execInputs = execInputs.map((row: any) => row.value);
      }
      
      // Flow 실행
      console.log(`[FlowChainModal] Flow ${flowId} 실행 시작`);
      const result = await executeFlowExecutor({
        flowId: flowId,
        flowChainId: flowChainId,
        flowJson: flow.flowJson,
        inputs: execInputs
      });
      
      // 결과 처리
      if (result.status === 'error') {
        console.error(`[FlowChainModal] 실행 오류:`, result.error);
        useFlowExecutorStore.getState().setFlowStatus(flowChainId, flowId, 'error', result.error);
      } else {
        const outputs = result.outputs || [];
        console.log(`[FlowChainModal] 실행 성공, 결과 ${outputs.length}개 항목 저장`);
        useFlowExecutorStore.getState().setFlowStatus(flowChainId, flowId, 'success');
        setActiveTab('result');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[FlowChainModal] 실행 오류:', error);
      useFlowExecutorStore.getState().setFlowStatus(flowChainId, flowId, 'error', errorMessage);
    } finally {
      setIsExecuting(false);
    }
  };

  // lastResults 유무에 따른 렌더링
  const hasResults = flow.lastResults && Array.isArray(flow.lastResults) && flow.lastResults.length > 0;
  // 타입 안전을 위해 항상 빈 배열이라도 제공
  const safeResults = flow.lastResults && Array.isArray(flow.lastResults) ? [...flow.lastResults] : [];

  // ResultDisplay에 전달할 result 객체 생성
  const flowResult: FlowExecutionResult | null = hasResults ? {
    status: flow.status,
    outputs: safeResults,
    error: flow.error,
    flowId: flow.id
  } : null;

  // 개발 모드에서 디버깅을 위한 로깅
  useEffect(() => {
    if (flow.lastResults) {
      console.log(`[FlowChainModal] lastResults 구조 확인:`, flow.lastResults);
      if (Array.isArray(flow.lastResults) && flow.lastResults.length > 0) {
        console.log(`[FlowChainModal] 첫 번째 결과 항목 확인:`, flow.lastResults[0]);
      }
    }
  }, [flow.lastResults]);

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
          {/* 모달 본문 */}
          <div className="bg-white p-6 max-h-[70vh] overflow-y-auto">
            {/* 입력폼 */}
            <div className="mb-6">
              <FlowInputForm flowId={flowId} />
            </div>
            {/* 실행 버튼 */}
            <div className="mb-6 flex justify-end">
              <button
                onClick={handleExecuteFlow}
                disabled={isExecuting}
                className={`px-4 py-2 bg-indigo-600 text-white rounded-md shadow-sm text-sm font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${isExecuting ? 'opacity-50 cursor-not-allowed' : ''}`}
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
            {/* 결과 섹션 */}
            <div className="border-t pt-6 mt-6">
              <div className="flex gap-4 mb-2">
                <button className={`px-3 py-1 rounded-t ${resultTab === 'node' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`} onClick={() => setResultTab('node')}>노드별 결과 확인</button>
                <button className={`px-3 py-1 rounded-t ${resultTab === 'output' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`} onClick={() => setResultTab('output')}>결과만 모아보기</button>
                {resultTab === 'output' && (
                  <div className="ml-4 flex items-center gap-2">
                    <span className="text-xs text-gray-500">포맷:</span>
                    <button className={`px-2 py-0.5 rounded ${outputFormat === 'text' ? 'bg-blue-200 text-blue-800' : 'bg-white border'}`} onClick={() => setOutputFormat('text')}>Text</button>
                    <button className={`px-2 py-0.5 rounded ${outputFormat === 'markdown' ? 'bg-blue-200 text-blue-800' : 'bg-white border'}`} onClick={() => setOutputFormat('markdown')}>Markdown</button>
                  </div>
                )}
              </div>
              {resultTab === 'node' ? (
                hasResults ? (
                  <div className="space-y-3">
                    {safeResults.map((result: any, idx: number) => {
                      console.log(`[FlowChainModal] 노드별 결과 출력 항목 ${idx}:`, result);
                      return (
                        <div key={idx} className="bg-gray-50 p-3 rounded border">
                          <div className="font-semibold text-sm text-gray-700 mb-1">{result.nodeName || result.nodeType || result.nodeId}</div>
                          {typeof result.result === 'string' ? (
                            <pre className="text-xs whitespace-pre-wrap text-gray-700">{result.result}</pre>
                          ) : result.result && result.result.name ? (
                            <span className="text-xs text-gray-700">파일: {result.result.name}</span>
                          ) : (
                            <pre className="text-xs whitespace-pre-wrap text-gray-700">{JSON.stringify(result.result, null, 2)}</pre>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-gray-400 italic p-4 bg-gray-50 rounded">
                    실행 결과가 없습니다. Flow를 실행하여 결과를 확인하세요.
                  </div>
                )
              ) : (
                <ResultDisplay
                  result={flowResult}
                  flowId={flow.id}
                  flowName={flow.name}
                  outputFormat={outputFormat}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FlowChainModal; 