import React, { useState } from 'react';
import { useFlowExecutorStore } from '../../store/useFlowExecutorStore';
import FlowInputForm from './FlowInputForm';
import { executeFlowExecutor } from '../../services/flowExecutionService';
import { NodeStatusIndicator } from '../nodes/shared/NodeStatusIndicator';
import ReactMarkdown from 'react-markdown';

interface FlowDetailModalProps {
  flowChainId: string;
  flowId: string;
  onClose: () => void;
}

const FlowDetailModal: React.FC<FlowDetailModalProps> = ({ flowChainId, flowId, onClose }) => {
  const store = useFlowExecutorStore();
  const flowChainMap = store.flowChainMap;
  const flowChainIds = store.flowChainIds;
  const chain = flowChainMap[flowChainId];
  const flow = chain?.flowMap[flowId];
  const [viewMode, setViewMode] = useState<'outputs' | 'raw' | 'markdown'>('outputs');

  if (!flow) return null;

  const handleExecuteFlow = async () => {
    if (!flow) return;
    try {
      store.setFlowStatus(flowChainId, flowId, 'running');
      const response = await executeFlowExecutor({
        flowJson: flow.flowJson,
        inputs: flow.inputs,
        flowId: flow.id,
        flowChainId: flowChainId,
        onComplete: (outputs) => {
          // 결과 핸들링 필요시 구현
        }
      });
      if (response.status === 'success') {
        store.setFlowStatus(flowChainId, flowId, 'success');
        store.setFlowResult(flowChainId, flowId, response.outputs);
      } else {
        store.setFlowStatus(flowChainId, flowId, 'error', response.error);
      }
    } catch (error) {
      console.error(`[FlowDetailModal] Error executing flow ${flowId}:`, error);
      store.setFlowStatus(flowChainId, flowId, 'error', String(error));
    }
  };

  const handleInputChange = (inputs: any[]) => {
    store.setFlowInputData(flowChainId, flowId, inputs);
  };

  // outputs만 추출 및 가공
  const outputsArr = Array.isArray(flow.lastResults)
    ? flow.lastResults.flatMap(item => {
        if (Array.isArray(item.outputs)) {
          return item.outputs.map((out: any) => {
            if (out && typeof out === 'object' && out.type === 'file') {
              return `[파일] ${out.path || out.name || 'unknown file'}`;
            }
            return out;
          });
        }
        return [];
      })
    : [];
  const outputsText = outputsArr.join('\n\n');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-4/5 h-4/5 flex flex-col max-w-6xl">
        {/* 모달 헤더 */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center">
            <NodeStatusIndicator status={flow.status} className="mr-2" />
            <h2 className="text-xl font-semibold">{flow.name}</h2>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleExecuteFlow}
              disabled={flow.status === 'running'}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors duration-150 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center"
            >
              {flow.status === 'running' ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  실행 중...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Flow 실행
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors duration-150"
            >
              닫기
            </button>
          </div>
        </div>
        {/* 모달 내용 */}
        <div className="flex-grow overflow-auto p-4">
          <div className="grid grid-cols-1 gap-4">
            {/* Flow 입력 폼 */}
            <div className="col-span-1">
              <FlowInputForm 
                flowId={flowId} 
                inputs={flow.inputs} 
                onInputChange={handleInputChange} 
              />
            </div>
            {/* Flow 실행 결과 */}
            <div className="col-span-1 mt-4">
              <div className="border border-gray-300 rounded-lg overflow-hidden">
                <div className="bg-gray-50 p-4 border-b border-gray-300 flex items-center gap-4">
                  <h3 className="text-lg font-medium text-gray-800">Flow 실행 결과</h3>
                  <div className="ml-auto flex gap-2">
                    <button onClick={() => setViewMode('outputs')} className={`px-2 py-1 rounded border ${viewMode === 'outputs' ? 'bg-blue-100 text-blue-700 border-blue-300 font-bold' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'}`}>outputs만</button>
                    <button onClick={() => setViewMode('markdown')} className={`px-2 py-1 rounded border ${viewMode === 'markdown' ? 'bg-blue-100 text-blue-700 border-blue-300 font-bold' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'}`}>Markdown</button>
                    <button onClick={() => setViewMode('raw')} className={`px-2 py-1 rounded border ${viewMode === 'raw' ? 'bg-blue-100 text-blue-700 border-blue-300 font-bold' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'}`}>JSON 전체</button>
                  </div>
                </div>
                <div className="p-4 bg-white max-h-96 overflow-y-auto">
                  {viewMode === 'outputs' ? (
                    <pre className="text-xs whitespace-pre-wrap text-gray-700">
                      {outputsText || '출력 결과가 없습니다.'}
                    </pre>
                  ) : viewMode === 'markdown' ? (
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown>{outputsText || '출력 결과가 없습니다.'}</ReactMarkdown>
                    </div>
                  ) : (
                    <pre className="text-xs whitespace-pre-wrap text-gray-700">
                      {JSON.stringify(flow.lastResults, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FlowDetailModal; 