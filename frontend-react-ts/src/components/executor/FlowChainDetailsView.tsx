import React, { useState, useEffect } from 'react';
import { useFlowExecutorStore } from '../../store/useFlowExecutorStore';
import { executeFlowChain } from '../../services/flowChainExecutionService';
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
  const [showGraphDetails, setShowGraphDetails] = useState(false);
  const [selectedFlowForGraph, setSelectedFlowForGraph] = useState<string | null>(null);
  
  const store = useFlowExecutorStore();
  const chain = store.getChain(chainId);
  const graphChain = chain;
  const graphFlows = graphChain?.flowMap || {};

  useEffect(() => {
    if (chain && !chain.selectedFlowId && chain.flowIds.length > 0) {
      store.setSelectedFlow(chainId, chain.flowIds[0]);
    }
  }, [chain, chainId, store]);

  if (!chain) {
    return <div className="p-4">체인 정보를 찾을 수 없습니다: {chainId}</div>;
  }

  const handleSelectFlow = (flowId: string) => {
    store.setSelectedFlow(chainId, flowId);
    onFlowSelect(flowId);
  };

  const handleMoveFlow = (flowId: string, direction: 'up' | 'down') => {
    store.moveFlow(chainId, flowId, direction);
  };

  const handleRemoveFlow = (flowId: string) => {
    if (window.confirm('정말로 이 Flow를 제거하시겠습니까?')) {
      store.removeFlowFromChain(chainId, flowId);
    }
  };

  const handleRunChain = async () => {
    store.setChainStatus(chainId, 'running');
    chain.flowIds.forEach(flowId => {
      store.setFlowStatus(chainId, flowId, 'idle');
    });
    try {
      await executeFlowChain({
        flowChainId: chainId,
        onChainStart: () => console.log(`Chain execution started: ${chainId}`),
        onChainComplete: (results) => {
          console.log(`Chain execution completed: ${chainId}`, results);
        },
        onFlowStart: (flowId, flowName, index) => {
          console.log(`Flow execution started: ${flowId} (${flowName}) in chain ${chainId}`);
        },
        onFlowComplete: (flowId, flowName, results, index) => {
          console.log(`Flow execution completed: ${flowId} (${flowName}) in chain ${chainId}`, results);
        },
        onError: (flowId, error) => {
          console.error(`Error in ${flowId ? `flow ${flowId}` : `chain ${chainId}`}:`, error);
        }
      });
    } catch (error) {
      console.error('Chain execution error:', error);
      store.setChainStatus(chainId, 'error');
    }
  };

  const handleViewGraphDetails = (flowId: string) => {
    setSelectedFlowForGraph(flowId);
    setShowGraphDetails(true);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">{chain.name}</h2>
        <div className="flex gap-2">
          <button 
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
            onClick={handleRunChain}
            disabled={chain.status === 'running' || chain.flowIds.length === 0}
          >
            {chain.status === 'running' ? '실행 중...' : '체인 실행'}
          </button>
          <button 
            className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
            onClick={onImportFlow}
          >
            Flow 추가
          </button>
        </div>
      </div>
      {chain.flowIds.length === 0 ? (
        <div className="p-4 border border-gray-300 rounded bg-gray-50 text-center">
          <p className="text-gray-600">체인에 Flow가 없습니다.</p>
          <button 
            className="mt-2 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
            onClick={onImportFlow}
          >
            Flow 추가하기
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {chain.flowIds.map((flowId, index) => {
            const flow = chain.flowMap && chain.flowMap[flowId] ? chain.flowMap[flowId] : undefined;
            if (!flow) return null;
            const flowStructure = graphFlows[flowId];
            const hasGraphInfo = flowStructure !== undefined;
            return (
              <div 
                key={flowId}
                className={`p-3 border rounded flex flex-col ${
                  flow.status === 'running' 
                    ? 'border-blue-300 bg-blue-50' 
                    : flow.status === 'error'
                    ? 'border-red-300 bg-red-50'
                    : flow.status === 'success'
                    ? 'border-green-300 bg-green-50'
                    : 'border-gray-300 bg-white'
                }`}
              >
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${
                        flow.status === 'running' ? 'bg-blue-500' :
                        flow.status === 'error' ? 'bg-red-500' :
                        flow.status === 'success' ? 'bg-green-500' :
                        'bg-gray-300'
                      }`}></span>
                      <span className="font-medium">{flow.name}</span>
                    </div>
                    {hasGraphInfo && (
                      <div className="text-xs text-gray-500 mt-1">
                        노드: {Object.keys(flowStructure.nodeMap).length} |
                        루트: {flowStructure.roots.length} |
                        리프: {flowStructure.leafs.length}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {hasGraphInfo && (
                      <button
                        className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
                        onClick={() => handleViewGraphDetails(flowId)}
                        title="그래프 구조 보기"
                      >
                        그래프 보기
                      </button>
                    )}
                    <button
                      className={`px-2 py-1 text-xs ${
                        chain.selectedFlowId === flowId
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 hover:bg-gray-200'
                      } rounded`}
                      onClick={() => handleSelectFlow(flowId)}
                    >
                      {chain.selectedFlowId === flowId ? '선택됨' : '선택'}
                    </button>
                    <div className="flex gap-1">
                      <button
                        disabled={index === 0}
                        className="p-1 text-gray-500 hover:text-gray-700 disabled:text-gray-300"
                        onClick={() => handleMoveFlow(flowId, 'up')}
                      >
                        ↑
                      </button>
                      <button
                        disabled={index === chain.flowIds.length - 1}
                        className="p-1 text-gray-500 hover:text-gray-700 disabled:text-gray-300"
                        onClick={() => handleMoveFlow(flowId, 'down')}
                      >
                        ↓
                      </button>
                    </div>
                    <button
                      className="p-1 text-red-500 hover:text-red-700"
                      onClick={() => handleRemoveFlow(flowId)}
                    >
                      ×
                    </button>
                  </div>
                </div>
                {flow.error && (
                  <div className="mt-2 p-2 bg-red-100 text-red-700 text-sm rounded">
                    {flow.error}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {showGraphDetails && selectedFlowForGraph && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-11/12 max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-medium">
                {chain.flowMap && chain.flowMap[selectedFlowForGraph]?.name ? chain.flowMap[selectedFlowForGraph].name : 'Flow'} - 그래프 구조
              </h3>
              <button
                className="text-gray-500 hover:text-gray-700"
                onClick={() => setShowGraphDetails(false)}
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <FlowChainGraphView flowId={selectedFlowForGraph} chainId={chainId} />
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end">
              <button
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                onClick={() => setShowGraphDetails(false)}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FlowChainDetailsView; 