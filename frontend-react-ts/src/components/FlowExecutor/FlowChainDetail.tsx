import React from 'react';
import { useExecutorStateStore } from '../../store/useExecutorStateStore';
import { NodeStatusIndicator } from '../nodes/shared/NodeStatusIndicator';
import { executeChain } from '../../services/flowExecutionService';
import { TrashIcon, ChevronUpIcon, ChevronDownIcon, PlayIcon as PlayIconSolid } from '@heroicons/react/20/solid';
import { PlayIcon as PlayIconOutline, DocumentDuplicateIcon as RadioButtonCheckedIcon, DocumentIcon as RadioButtonUncheckedIcon } from '@heroicons/react/24/outline';
import FileUploader from '../executor/FileUploader';

interface FlowChainDetailProps {
  onFlowSelect: (chainId: string, flowId: string) => void;
}

export const FlowChainDetail: React.FC<FlowChainDetailProps> = ({ onFlowSelect }) => {
  const {
    flowExecutorStore,
    removeFlowFromChain,
    moveFlow,
    setFlowStatus,
    setFlowChainStatus,
    setSelectedFlow,
  } = useExecutorStateStore((state) => ({
    flowExecutorStore: state.flowExecutorStore,
    removeFlowFromChain: state.removeFlowFromChain,
    moveFlow: state.moveFlow,
    setFlowStatus: state.setFlowStatus,
    setFlowChainStatus: state.setFlowChainStatus,
    setSelectedFlow: state.setSelectedFlow,
  }));

  const activeChainId = flowExecutorStore.activeChainId;
  const activeChain = activeChainId ? flowExecutorStore.flowChainMap[activeChainId] : null;

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

  return (
    <div className="w-full h-full flex flex-col bg-white rounded-lg shadow">
      <div className="p-3 border-b border-gray-200 flex justify-between items-center">
        <div className="flex items-center min-w-0">
          <NodeStatusIndicator status={activeChain.status} size="medium" className="mr-2 flex-shrink-0" />
          <h2 className="text-lg font-semibold text-gray-800 truncate" title={activeChain.name}>{activeChain.name}</h2>
        </div>
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
      
      {activeChain.flowIds.length === 0 ? (
        <div className="flex-grow flex items-center justify-center p-4">
          <p className="text-gray-500 text-center">No Flows in this chain.<br/>Upload a Flow JSON using the uploader on the left to add one.</p>
        </div>
      ) : (
        <ul className="flex-grow overflow-y-auto divide-y divide-gray-200">
          {activeChain.flowIds.map((flowId, index) => {
            const flow = activeChain.flowMap[flowId];
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
                     (flow.lastResults ? `${Array.isArray(flow.lastResults) ? flow.lastResults.length : 1} result(s)` : 'No results')}
                  </p>
                </div>
                <div className="ml-2 flex-shrink-0 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
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
      )}
      {activeChain && (
        <div className="p-3 border-t border-gray-200 mt-auto">
          <FileUploader className="border-none p-0 shadow-none bg-transparent" /> 
        </div>
      )}
    </div>
  );
}; 