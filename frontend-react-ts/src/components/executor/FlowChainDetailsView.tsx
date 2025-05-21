import React, { useState, useEffect } from 'react';
import { useFlowExecutorStore } from '../../store/useFlowExecutorStore';
import FlowChainGraphView from './FlowChainGraphView';

interface FlowChainDetailsViewProps {
  chainId: string;
  onFlowSelect: (flowId: string) => void;
  onImportFlow: () => void;
}

const FlowChainDetailsView: React.FC<FlowChainDetailsViewProps> = ({
  chainId,
  onFlowSelect,
  onImportFlow,
}) => {
  const store = useFlowExecutorStore();
  const chain = store.chains[chainId];
  const flowIds = chain ? chain.flowIds : [];
  const flowMap = chain ? chain.flowMap : {};
  const [showGraphDetails, setShowGraphDetails] = useState(false);
  const [selectedFlowForGraph, setSelectedFlowForGraph] = useState<string | null>(null);

  if (!chain) return <div className="p-4 text-gray-500">존재하지 않는 체인입니다.</div>;

  return (
    <div className="bg-white rounded-lg shadow p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">{chain.name}</h2>
        <div className="flex gap-2">
          <button
            onClick={onImportFlow}
            className="px-3 py-1 text-blue-600 border border-blue-600 rounded hover:bg-blue-50 transition-colors text-sm"
          >
            Flow 가져오기
          </button>
          <button
            onClick={() => setShowGraphDetails((prev) => !prev)}
            className="px-3 py-1 text-gray-600 border border-gray-400 rounded hover:bg-gray-100 transition-colors text-sm"
          >
            {showGraphDetails ? '목록 보기' : '그래프 보기'}
          </button>
        </div>
      </div>
      {showGraphDetails ? (
        <div className="flex-1 overflow-auto">
          <FlowChainGraphView
            flowId={selectedFlowForGraph || (flowIds.length > 0 ? flowIds[0] : '')}
            chainId={chainId}
          />
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <ul>
            {flowIds.map((flowId) => {
              const flow = flowMap[flowId];
              return (
                <li
                  key={flowId}
                  className="border-b border-gray-200 last:border-b-0 p-3 cursor-pointer hover:bg-gray-50"
                  onClick={() => onFlowSelect(flowId)}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-medium text-gray-900">{flow.name}</h3>
                      <div className="text-xs text-gray-500 mt-1">
                        {flow.inputs && flow.inputs.length ? `${flow.inputs.length}개의 입력` : '입력 없음'}
                        {flow.status && (
                          <span className={`ml-2 font-medium ${flow.status === 'success' ? 'text-green-500' : flow.status === 'error' ? 'text-red-500' : flow.status === 'running' ? 'text-blue-500' : 'text-gray-400'}`}>
                            • {flow.status.charAt(0).toUpperCase() + flow.status.slice(1)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

export default FlowChainDetailsView; 