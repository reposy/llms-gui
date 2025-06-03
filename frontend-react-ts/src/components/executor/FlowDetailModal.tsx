import React, { useRef } from 'react';
import { useFlowExecutorStore } from '../../store/useFlowExecutorStore';
import FlowInputForm, { FlowInputFormRef } from './FlowInputForm';
import { executeFlowExecutor } from '../../services/flowExecutionService';
import { NodeStatusIndicator } from '../nodes/shared/NodeStatusIndicator';

interface FlowDetailModalProps {
  flowChainId: string;
  flowId: string;
  onClose: () => void;
}

const FlowDetailModal: React.FC<FlowDetailModalProps> = ({ flowChainId, flowId, onClose }) => {
  const store = useFlowExecutorStore();
  const flowChainMap = store.flowChainMap;
  const chain = flowChainMap[flowChainId];
  const flow = chain?.flowMap[flowId];
  const flowInputFormRef = useRef<FlowInputFormRef>(null);

  if (!flow) return null;

  const handleExecuteFlow = async () => {
    if (!flow) return;
    try {
      store.setFlowStatus(flowChainId, flowId, 'running');
      
      // FlowInputForm에서 실행 모드 정보 가져오기 (현재 편집 중인 경우)
      let executionMode = flowInputFormRef.current?.getExecutionMode();
      let commonInputs = flowInputFormRef.current?.getCommonInputs();
      let forEachItems = flowInputFormRef.current?.getForEachItems();
      let executableInputs = flowInputFormRef.current?.getExecutableInputs();
      
      // FlowInputForm에서 데이터를 가져올 수 없는 경우, 저장된 설정 사용
      if (!executionMode && flow.executionConfig) {
        executionMode = flow.executionConfig.mode;
        commonInputs = flow.executionConfig.commonInputs || [];
        forEachItems = flow.executionConfig.forEachItems || [];
      }
      
      // 기본값 설정
      executionMode = executionMode || 'batch';
      commonInputs = commonInputs || [];
      forEachItems = forEachItems || [];
      executableInputs = executableInputs || flow.inputs;
      
      console.log('[FlowDetailModal] 실행 모드:', executionMode);
      console.log('[FlowDetailModal] 실행용 입력:', { 
        mode: executionMode, 
        executableInputs, 
        commonInputs, 
        forEachItems 
      });
      
      const response = await executeFlowExecutor({
        flowJson: flow.flowJson,
        inputs: executionMode === 'forEach' ? forEachItems : executableInputs,
        flowId: flow.id,
        flowChainId: flowChainId,
        executionMode: executionMode,
        commonInputs: executionMode === 'forEach' ? commonInputs : undefined,
      });
      
      if (response.status === 'success') {
        store.setFlowStatus(flowChainId, flowId, 'success');
        store.setFlowResult(flowChainId, flowId, response.outputs);
      } else {
        store.setFlowStatus(flowChainId, flowId, 'error', response.error);
      }
    } catch (error) {
      // console.error(`[FlowDetailModal] Error executing flow ${flowId}:`, error);
      store.setFlowStatus(flowChainId, flowId, 'error', String(error));
    }
  };

  const handleInputChange = (inputs: any[]) => {
    store.setFlowInputData(flowChainId, flowId, inputs);
  };

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
        <div className="flex-grow overflow-auto p-4 bg-gray-50">
          <div className="grid grid-cols-1 gap-4">
            {/* Flow 입력 폼 */}
            <div className="col-span-1">
              <FlowInputForm 
                flowId={flowId} 
                inputs={flow.inputs} 
                onInputChange={handleInputChange} 
                ref={flowInputFormRef}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FlowDetailModal; 