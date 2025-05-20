import React from 'react';
import { useFlowExecutorStore } from '../../store/useFlowExecutorStore';
import { NodeStatusIndicator } from '../nodes/shared/NodeStatusIndicator';
import { executeChain } from '../../services/flowExecutionService';
import { TrashIcon, ChevronUpIcon, ChevronDownIcon, PlayIcon as PlayIconSolid } from '@heroicons/react/20/solid';
import { PlayIcon as PlayIconOutline, DocumentDuplicateIcon as RadioButtonCheckedIcon, DocumentIcon as RadioButtonUncheckedIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import FileUploader from '../executor/FileUploader';
import { downloadFlowChainAsJson } from '../../utils/data/importExportUtils';

interface FlowChainDetailProps {
  onFlowSelect: (chainId: string, flowId: string) => void;
}

export const FlowChainDetail: React.FC<FlowChainDetailProps> = ({ onFlowSelect }) => {
  const {
    chains,
    activeChainId,
    removeFlowFromChain,
    moveFlow,
    setFlowStatus,
    setChainStatus: setFlowChainStatus,
    setSelectedFlow,
    getActiveChain
  } = useFlowExecutorStore();

  const activeChain = getActiveChain();

  console.log('[FlowChainDetail] Rendering with activeChainId:', activeChainId);
  console.log('[FlowChainDetail] activeChain object:', activeChain);

  if (!activeChain) {
    return (
      <div className="w-full h-full flex items-center justify-center p-4">
        <p className="text-gray-500">Select or Create a Flow Chain from the left panel.</p>
      </div>
    );
  }

  const handleRemoveFlow = (flowId: string) => {
    if (window.confirm('Are you sure you want to delete this Flow from the chain?')) {
      removeFlowFromChain(activeChain.id, flowId);
    }
  };

  const handleMoveFlow = (flowId: string, direction: 'up' | 'down') => {
    moveFlow(activeChain.id, flowId, direction);
  };

  const handleSetSelectedFlow = (flowId: string) => {
    setSelectedFlow(activeChain.id, flowId);
  };

  const handleExecuteChain = async () => {
    if (!activeChain) return;
    try {
      setFlowChainStatus(activeChain.id, 'running');
      await executeChain({
        flowChainId: activeChain.id,
        onChainStart: (chainId) => {
        },
        onChainComplete: (chainId) => {
          setFlowChainStatus(chainId, 'success');
        },
        onFlowStart: (chainId, flowId) => {
          setFlowStatus(chainId, flowId, 'running');
        },
        onFlowComplete: (chainId, flowId, results) => {
          setFlowStatus(chainId, flowId, 'success');
        },
        onError: (chainId, flowId, error) => {
          if (flowId) {
            setFlowStatus(chainId, flowId, 'error', error.toString());
          }
          setFlowChainStatus(chainId, 'error');
        }
      });
    } catch (error) {
      console.error('Chain execution error in Detail:', error);
      setFlowChainStatus(activeChain.id, 'error');
    }
  };

  // Flow Chain 내보내기 핸들러
  const handleExportChain = () => {
    if (!activeChain) return;
    
    try {
      downloadFlowChainAsJson(activeChain.id);
      // 성공 메시지나 토스트 알림 등을 여기에 추가할 수 있습니다
    } catch (error) {
      console.error('Error exporting flow chain:', error);
      // 오류 메시지 표시 등을 여기에 추가할 수 있습니다
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-white rounded-lg shadow">
      <div className="p-3 border-b border-gray-200 flex justify-between items-center">
        <div className="flex items-center min-w-0">
          <NodeStatusIndicator status={activeChain.status} size="medium" className="mr-2 flex-shrink-0" />
          <h2 className="text-lg font-semibold text-gray-800 truncate" title={activeChain.name}>{activeChain.name}</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            title="Import Flow"
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
            disabled={activeChain.status === 'running' || activeChain.flowIds.length === 0}
            className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-md text-sm font-medium flex items-center transition-colors duration-150 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {activeChain.status === 'running' ? (
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
      
      {activeChain.flowIds.length === 0 ? (
        <div className="flex-grow flex items-center justify-center p-4">
          <p className="text-gray-500 text-center">No Flows in this chain.<br/>Click the Import Flow button above to add one.</p>
        </div>
      ) : (
        <div className="flex-grow flex flex-col">
          <ul className="overflow-y-auto divide-y divide-gray-200 flex-grow">
            {activeChain.flowIds.map((flowId, index) => {
              const flow = chains[activeChainId].flows[flowId];
              if (!flow) return null;
              return (
                <li
                  key={flowId}
                  onClick={() => onFlowSelect(activeChain.id, flowId)}
                  className="p-3 flex items-center cursor-pointer hover:bg-gray-50 transition-colors duration-150 group"
                >
                  <NodeStatusIndicator status={flow.status} size="small" className="mr-2 flex-shrink-0" />
                  <div className="flex-grow min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate" title={flow.name}>{flow.name}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {flow.status === 'error' && flow.error ? <span className="text-red-500">Error: {flow.error}</span> : 
                       (flow.results ? `${Array.isArray(flow.results) ? flow.results.length : 1} result(s)` : 'No results')}
                    </p>
                  </div>
                  <div className="ml-2 flex-shrink-0 flex items-center space-x-1 opacity-100 transition-opacity duration-150">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleSetSelectedFlow(flowId); }}
                      className={`p-1.5 rounded-md transition-colors duration-150 ${
                        activeChain.selectedFlowId === flowId ? 'text-blue-600 bg-blue-100' : 'text-gray-400 hover:text-blue-500 hover:bg-gray-100'
                      }`}
                      title="Set as chain output"
                    >
                      {activeChain.selectedFlowId === flowId ? <RadioButtonCheckedIcon className="h-5 w-5" /> : <RadioButtonUncheckedIcon className="h-5 w-5" />}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleMoveFlow(flowId, 'up'); }}
                      disabled={index === 0}
                      className="p-1.5 text-gray-400 hover:text-gray-700 rounded-md transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Move Up"
                    >
                      <ChevronUpIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleMoveFlow(flowId, 'down'); }}
                      disabled={index === activeChain.flowIds.length - 1}
                      className="p-1.5 text-gray-400 hover:text-gray-700 rounded-md transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Move Down"
                    >
                      <ChevronDownIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRemoveFlow(flowId); }}
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
          {activeChain.selectedFlowId && chains[activeChainId].flows[activeChain.selectedFlowId]?.results && (
            <div className="border-t border-gray-200 p-4 bg-gray-50">
              <div className="mb-2 flex items-center">
                <h3 className="text-sm font-semibold text-gray-700">Selected Flow Result</h3>
                <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">
                  {chains[activeChainId].flows[activeChain.selectedFlowId].name}
                </span>
              </div>
              <div className="bg-white rounded-md border border-gray-200 p-3 max-h-40 overflow-y-auto">
                <pre className="text-xs whitespace-pre-wrap text-gray-700">
                  {JSON.stringify(chains[activeChainId].flows[activeChain.selectedFlowId].results, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}; 