import React, { useState, useEffect } from 'react';
import { useFlowExecutorStore } from '../../store/useFlowExecutorStore';
import { executeFlowExecutor } from '../../services/flowExecutionService';
import FlowInputForm from './FlowInputForm';
import ResultDisplay from './ResultDisplay';
import ReactMarkdown from 'react-markdown';

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
  const [resultTab, setResultTab] = useState<'node' | 'output'>('node');
  const [outputFormat, setOutputFormat] = useState<'text' | 'markdown'>('text');
  const [inputEditMode, setInputEditMode] = useState(false);
  const [pendingInputs, setPendingInputs] = useState<any[]>([]);
  
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
    setPendingInputs(inputs);
  };

  const handleSaveInputs = () => {
    store.setFlowInputData(chainId, flowId, pendingInputs);
    setInputEditMode(false);
  };

  const handleCancelInputs = () => {
    setPendingInputs(flow?.inputs || []);
    setInputEditMode(false);
  };

  const handleExecuteFlow = async () => {
    if (isExecuting) return;
    setIsExecuting(true);
    store.setFlowStatus(chainId, flowId, 'running');
    try {
      // flow의 최신 nodes/edges 정보로 실행
      const result = await executeFlowExecutor({
        flowId,
        chainId,
        flowJson: flow.flowJson,
        inputs: flow.inputs,
        nodes: flow.flowJson.nodes,
        edges: flow.flowJson.edges
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

          {/* 모달 본문 */}
          <div className="bg-white p-6 max-h-[70vh] overflow-y-auto">
            {/* 입력폼 */}
            <div className="mb-6">
              <FlowInputForm
                flowId={flowId}
                inputs={pendingInputs}
                onInputChange={handleInputChange}
              />
              {inputEditMode && (
                <div className="flex gap-2 mt-2">
                  <button className="px-3 py-1 bg-green-500 text-white rounded" onClick={handleSaveInputs}>저장</button>
                  <button className="px-3 py-1 bg-gray-300 text-gray-700 rounded" onClick={handleCancelInputs}>취소</button>
                </div>
              )}
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
                flow.lastResults && flow.lastResults.length > 0 ? (
                  <div className="space-y-3">
                    {flow.lastResults.map((result: any, idx: number) => (
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
                    ))}
                  </div>
                ) : (
                  <div className="text-gray-400 italic">실행 결과가 없습니다</div>
                )
              ) : (
                flow.lastResults && flow.lastResults.length > 0 ? (
                  <div className="bg-gray-50 p-3 rounded max-h-60 overflow-y-auto text-xs">
                    {outputFormat === 'markdown' ? (
                      <ReactMarkdown className="prose prose-sm max-w-none">
                        {flow.lastResults.map((r: any) => typeof r.result === 'string' ? r.result : (r.result && r.result.name ? `파일: ${r.result.name}` : JSON.stringify(r.result, null, 2))).join('\n')}
                      </ReactMarkdown>
                    ) : (
                      <pre>{flow.lastResults.map((r: any) => typeof r.result === 'string' ? r.result : (r.result && r.result.name ? `파일: ${r.result.name}` : JSON.stringify(r.result, null, 2))).join('\n')}</pre>
                    )}
                  </div>
                ) : (
                  <div className="text-gray-400 italic">실행 결과가 없습니다</div>
                )
              )}
            </div>
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