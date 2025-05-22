import React, { useState } from 'react';
import { useFlowExecutorStore } from '../../store/useFlowExecutorStore';
import { NodeStatusIndicator } from '../nodes/shared/NodeStatusIndicator';
import { executeChain, executeFlowExecutor } from '../../services/flowExecutionService';
import { TrashIcon, ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/20/solid';
import { PlayIcon as PlayIconSolid, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import FileUploader from './FileUploader';
import FlowInputForm from './FlowInputForm';

interface FlowChainDetailsViewProps {
  chainId: string;
  onFlowSelect: (flowId: string) => void;
  onImportFlow: () => void;
}

const FlowChainDetailsView: React.FC<FlowChainDetailsViewProps> = ({ chainId, onFlowSelect, onImportFlow }) => {
  const store = useFlowExecutorStore();
  const flowChainMap = store.flowChainMap;
  const flowChainIds = flowChainMap[chainId]?.flowIds || [];
  const flowMap = flowChainMap[chainId]?.flowMap || {};
  const [isExecuting, setIsExecuting] = useState(false);
  const [executingFlowId, setExecutingFlowId] = useState<string | null>(null);

  if (!flowChainMap[chainId]) {
    return (
      <div className="w-full h-full flex items-center justify-center p-4">
        <p className="text-gray-500">Select or Create a Flow Chain from the left panel.</p>
      </div>
    );
  }

  const handleRemoveFlow = (flowId: string) => {
    if (window.confirm('이 Flow를 체인에서 삭제하시겠습니까?')) {
      store.removeFlowFromChain(chainId, flowId);
    }
  };

  const handleMoveFlow = (flowId: string, direction: 'up' | 'down') => {
    store.moveFlow(chainId, flowId, direction);
  };

  const handleSetSelectedFlow = (flowId: string) => {
    store.setSelectedFlow(chainId, flowId);
  };

  const handleExecuteChain = async () => {
    if (!flowChainMap[chainId]) return;
    try {
      setIsExecuting(true);
      await executeChain({
        flowChainId: chainId,
        onFlowStart: (flowChainId, flowId) => {
          store.setFlowStatus(flowChainId, flowId, 'running');
        },
        onFlowComplete: (flowChainId, flowId, results) => {
          store.setFlowStatus(flowChainId, flowId, 'success');
          store.setFlowResult(flowChainId, flowId, results);
        },
        onError: (flowChainId, flowId, error) => {
          store.setFlowStatus(flowChainId, flowId, 'error', error?.toString());
        }
      });
    } catch (error) {
      console.error('Chain execution error in Detail:', error);
      store.setChainStatus(chainId, 'error');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleExportChain = () => {
    // TODO: implement export logic if needed
    alert('Export 기능은 별도 구현 필요');
  };

  const handleExecuteFlow = async (flowId: string) => {
    const flow = flowMap[flowId];
    if (!flow) return;
    setExecutingFlowId(flowId);
    const storeInputs = flowChainMap[chainId]?.flowMap[flowId]?.inputs;
    const execInputs = storeInputs && Array.isArray(storeInputs) ? storeInputs : [];
    store.setFlowStatus(chainId, flowId, 'running');
    try {
      const result = await executeFlowExecutor({
        flowId,
        chainId: chainId,
        flowJson: flow.flowJson,
        inputs: execInputs
      });
      store.setFlowResult(chainId, flowId, result.outputs || []);
      store.setFlowStatus(chainId, flowId, result.status === 'success' ? 'success' : 'error', result.error);
    } catch (error) {
      store.setFlowStatus(chainId, flowId, 'error', error instanceof Error ? error.message : String(error));
    } finally {
      setExecutingFlowId(null);
    }
  };

  const selectedFlow = flowChainMap[chainId]?.selectedFlowId ? flowMap[flowChainMap[chainId]?.selectedFlowId] : null;

  return (
    <div className="w-full h-full flex flex-col bg-white rounded-lg shadow">
      <div className="p-3 border-b border-gray-200 flex justify-between items-center">
        <div className="flex items-center min-w-0">
          <NodeStatusIndicator status={flowChainMap[chainId]?.status} className="mr-2 flex-shrink-0" />
          <h2 className="text-lg font-semibold text-gray-800 truncate" title={flowChainMap[chainId]?.name}>{flowChainMap[chainId]?.name}</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            title="Flow 가져오기"
            onClick={onImportFlow}
            className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm font-medium flex items-center transition-colors duration-150"
          >
            <FileUploader buttonStyle={true} className="import-flow-button" />
          </button>
          <button
            title="Export Chain"
            onClick={handleExportChain}
            className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-md text-sm font-medium flex items-center transition-colors duration-150"
          >
            <ArrowDownTrayIcon className="h-5 w-5 mr-1.5" />
            Export
          </button>
          <button
            id="flow-chain-detail-execute-button"
            onClick={handleExecuteChain}
            disabled={flowChainMap[chainId]?.status === 'running' || flowChainIds.length === 0 || isExecuting}
            className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-md text-sm font-medium flex items-center transition-colors duration-150 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {flowChainMap[chainId]?.status === 'running' || isExecuting ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Running...
              </>
            ) : (
              <>
                <PlayIconSolid className="mr-1.5 h-5 w-5" />
                Execute Chain
              </>
            )}
          </button>
        </div>
      </div>
      {flowChainIds.length === 0 ? (
        <div className="flex-grow flex items-center justify-center p-4">
          <p className="text-gray-500 text-center">No Flows in this chain.<br/>Click the Import Flow button above to add one.</p>
        </div>
      ) : (
        <div className="flex-grow flex flex-col">
          <ul className="overflow-y-auto divide-y divide-gray-200 flex-grow">
            {flowChainIds.map((flowId, index) => {
              const flow = flowMap[flowId];
              if (!flow) return null;
              return (
                <li
                  key={flowId}
                  onClick={() => onFlowSelect(flowId)}
                  className="p-3 flex items-center cursor-pointer hover:bg-gray-50 transition-colors duration-150 group"
                >
                  <NodeStatusIndicator status={flow.status} className="mr-2 flex-shrink-0" />
                  <div className="flex-grow min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate" title={flow.name}>{flow.name}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {flow.status === 'error' && flow.error ? <span className="text-red-500">Error: {flow.error}</span> : 
                        (flow.lastResults ? `${Array.isArray(flow.lastResults) ? flow.lastResults.length : 1} result(s)` : 'No results')}
                    </p>
                  </div>
                  <div className="ml-2 flex-shrink-0 flex items-center space-x-1 opacity-100 transition-opacity duration-150">
                    <button
                      onClick={e => { e.stopPropagation(); handleSetSelectedFlow(flowId); }}
                      className={`p-1.5 rounded-md transition-colors duration-150 ${flowChainMap[chainId]?.selectedFlowId === flowId ? 'text-blue-600 bg-blue-100' : 'text-gray-400 hover:text-blue-500 hover:bg-gray-100'}`}
                      title="Set as chain output"
                    >
                      {flowChainMap[chainId]?.selectedFlowId === flowId ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="currentColor" /></svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="white" /></svg>
                      )}
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); handleExecuteFlow(flowId); }}
                      className={`p-1.5 rounded-md transition-colors duration-150 ${executingFlowId === flowId ? 'bg-green-100 text-green-600' : 'text-gray-400 hover:text-green-600 hover:bg-green-100'}`}
                      title="이 Flow만 실행"
                      disabled={executingFlowId === flowId || flow.status === 'running'}
                    >
                      {executingFlowId === flowId || flow.status === 'running' ? (
                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : (
                        <PlayIconSolid className="h-5 w-5" />
                      )}
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); handleMoveFlow(flowId, 'up'); }}
                      disabled={index === 0}
                      className="p-1.5 text-gray-400 hover:text-gray-700 rounded-md transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Move Up"
                    >
                      <ChevronUpIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); handleMoveFlow(flowId, 'down'); }}
                      disabled={index === flowChainIds.length - 1}
                      className="p-1.5 text-gray-400 hover:text-gray-700 rounded-md transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Move Down"
                    >
                      <ChevronDownIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); handleRemoveFlow(flowId); }}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded-md transition-colors duration-150"
                      title="Delete Flow"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          {/* 선택된 Flow의 실행 결과 표시 */}
          {flowChainMap[chainId]?.selectedFlowId && selectedFlow && (
            <div className="border-t border-gray-200 p-4 bg-gray-50">
              <div className="mb-2 flex items-center">
                <h3 className="text-sm font-semibold text-gray-700">Selected Flow Result</h3>
                <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">
                  {selectedFlow.name}
                </span>
              </div>
              <div className="bg-white rounded-md border border-gray-200 p-3 max-h-40 overflow-y-auto">
                {selectedFlow.lastResults ? (
                  Array.isArray(selectedFlow.lastResults) && selectedFlow.lastResults.length > 0 ? (
                    <pre className="text-xs whitespace-pre-wrap text-gray-700">
                      {JSON.stringify(selectedFlow.lastResults, null, 2)}
                    </pre>
                  ) : (
                    <p className="text-xs text-gray-500">실행은 완료되었지만 결과가 없거나 비어 있습니다.</p>
                  )
                ) : (
                  <p className="text-xs text-gray-500">아직 실행 결과가 없습니다.</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FlowChainDetailsView; 