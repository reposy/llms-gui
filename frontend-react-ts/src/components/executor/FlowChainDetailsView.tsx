import React, { useState, forwardRef } from 'react';
import { useFlowExecutorStore } from '../../store/useFlowExecutorStore';
import { NodeStatusIndicator } from '../nodes/shared/NodeStatusIndicator';
import { executeChain, executeFlowExecutor } from '../../services/flowExecutionService';
import { TrashIcon, ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/20/solid';
import { PlayIcon as PlayIconSolid } from '@heroicons/react/24/outline';
import FlowChainResultDisplay from './FlowChainResultDisplay';
import { LargeCheckboxCheckedIcon, LargeCheckboxUncheckedIcon, PenLineIcon } from '../Icons';
import InlineEditInput from '../ui/InlineEditInput';

interface FlowChainDetailsViewProps {
  flowChainId: string;
  onFlowSelect: (flowId: string) => void;
  onImportFlow: () => void;
}

// Reusable, extensible large checkbox component using SVG
const ExecutorCheckbox = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>((props, ref) => {
  const { checked, className, ...rest } = props;
  return (
    <label
      style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}
      className={className}
      onClick={e => e.stopPropagation()}
    >
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        onClick={e => e.stopPropagation()}
        style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
        {...rest}
      />
      {checked ? (
        <LargeCheckboxCheckedIcon size={32} />
      ) : (
        <LargeCheckboxUncheckedIcon size={32} />
      )}
    </label>
  );
});
ExecutorCheckbox.displayName = 'ExecutorCheckbox';

const FlowChainDetailsView: React.FC<FlowChainDetailsViewProps> = ({ flowChainId, onFlowSelect, onImportFlow }) => {
  const flowChain = useFlowExecutorStore(state => state.flowChainMap[flowChainId]);
  const flowIds = flowChain?.flowIds || [];
  const flowMap = flowChain?.flowMap || {};
  const [isExecuting, setIsExecuting] = useState(false);
  const [executingFlowId, setExecutingFlowId] = useState<string | null>(null);
  const [editingFlowId, setEditingFlowId] = useState<string | null>(null);

  if (!flowChain) { 
    return (
      <div className="w-full h-full flex items-center justify-center p-4">
        <p className="text-gray-500">Select or Create a Flow Chain from the left panel.</p>
      </div>
    );
  }

  const handleRemoveFlow = (flowId: string) => {
    if (window.confirm('이 Flow를 체인에서 삭제하시겠습니까?')) {
      useFlowExecutorStore.getState().removeFlowFromFlowChain(flowChainId, flowId);
    }
  };

  const handleMoveFlow = (flowId: string, direction: 'up' | 'down') => {
    useFlowExecutorStore.getState().moveFlow(flowChainId, flowId, direction);
  };

  const handleExecuteChain = async () => {
    if (!flowChain) return;
    setIsExecuting(true);
    try {
      await executeChain({
        flowChainId: flowChainId,
        onFlowStart: (flowChainId, flowId) => {
          useFlowExecutorStore.getState().setFlowStatus(flowChainId, flowId, 'running');
        },
        onFlowComplete: (flowChainId, flowId, results) => {
          useFlowExecutorStore.getState().setFlowStatus(flowChainId, flowId, 'success');
          useFlowExecutorStore.getState().setFlowResult(flowChainId, flowId, results);
        },
        onError: (flowChainId, flowId, error) => {
          useFlowExecutorStore.getState().setFlowStatus(flowChainId, flowId, 'error', error?.toString());
        }
      });
    } catch (error) {
      // console.error('Chain execution error in Detail:', error);
      useFlowExecutorStore.getState().setFlowChainStatus(flowChainId, 'error');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleExecuteFlow = async (flowId: string) => {
    const flow = useFlowExecutorStore.getState().flowChainMap[flowChainId]?.flowMap[flowId];
    if (!flow) return;
    setExecutingFlowId(flowId);
    const execInputs = flow.inputs && Array.isArray(flow.inputs) ? flow.inputs : [];
    useFlowExecutorStore.getState().setFlowStatus(flowChainId, flowId, 'running');
    try {
      const result = await executeFlowExecutor({
        flowId: flowId,
        flowChainId: flowChainId,
        flowJson: flow.flowJson,
        inputs: execInputs
      });
      useFlowExecutorStore.getState().setFlowResult(flowChainId, flowId, result.outputs || []);
      useFlowExecutorStore.getState().setFlowStatus(flowChainId, flowId, result.status === 'success' ? 'success' : 'error', result.error);
    } catch (error) {
      useFlowExecutorStore.getState().setFlowStatus(flowChainId, flowId, 'error', error instanceof Error ? error.message : String(error));
    } finally {
      setExecutingFlowId(null);
    }
  };

  const selectedFlowIds = flowChain.selectedFlowIds || [];
  const setSelectedFlowIds = useFlowExecutorStore(state => state.setSelectedFlowIds);

  // 체크박스 핸들러
  const handleFlowCheckboxChange = (flowId: string, checked: boolean) => {
    let newSelected = selectedFlowIds.slice();
    if (checked) {
      if (!newSelected.includes(flowId)) newSelected.push(flowId);
    } else {
      newSelected = newSelected.filter(id => id !== flowId);
    }
    setSelectedFlowIds(flowChainId, newSelected);
  };

  // 선택된 flows를 순서대로 추출
  const selectedFlows = flowIds
    .filter(id => selectedFlowIds.includes(id))
    .map(id => {
      const flow = flowMap[id];
      return flow ? { flowId: id, flowName: flow.name, result: flow.lastResults } : undefined;
    })
    .filter((f): f is { flowId: string; flowName: string; result: any } => !!f);

  function validateFlowName(newName: string, currentId: string) {
    if (!newName.trim()) return '이름을 입력하세요.';
    if (Object.values(flowMap).some(f => f.id !== currentId && f.name === newName.trim())) return '이미 존재하는 이름입니다.';
    return null;
  }

  function handleSaveFlowName(flowId: string, newName: string) {
    useFlowExecutorStore.getState().setFlowName(flowChainId, flowId, newName);
    setEditingFlowId(null);
  }

  function handleCancelEdit() {
    setEditingFlowId(null);
  }

  return (
    <div className="w-full h-full flex flex-col bg-white rounded-lg shadow">
      <div className="p-3 border-b border-gray-200 flex justify-between items-center">
        <div className="flex items-center min-w-0">
          <NodeStatusIndicator status={flowChain.status} className="mr-2 flex-shrink-0" />
          <h2 className="text-lg font-semibold text-gray-800 truncate" title={flowChain.name}>{flowChain.name}</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            title="Flow 가져오기"
            onClick={onImportFlow}
            className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm font-medium flex items-center transition-colors duration-150"
          >
            <svg className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            Import Flow
          </button>
          <button
            id="flow-chain-detail-execute-button"
            onClick={handleExecuteChain}
            disabled={flowChain.status === 'running' || flowIds.length === 0 || isExecuting}
            className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-md text-sm font-medium flex items-center transition-colors duration-150 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {flowChain.status === 'running' || isExecuting ? (
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
      {flowIds.length === 0 ? (
        <div className="flex-grow flex items-center justify-center p-4">
          <p className="text-gray-500 text-center">No Flows in this chain.<br/>Click the Import Flow button above to add one.</p>
        </div>
      ) : (
        <div className="flex-grow flex flex-col">
          {/* Flow 리스트 헤더: 전체 선택 체크박스 */}
          <div className="flex items-center px-3 py-2 border-b border-gray-200 bg-gray-50">
            <ExecutorCheckbox
              className="mr-3"
              checked={selectedFlowIds.length === flowIds.length && flowIds.length > 0}
              onChange={e => {
                if (e.target.checked) {
                  setSelectedFlowIds(flowChainId, flowIds.slice());
                } else {
                  setSelectedFlowIds(flowChainId, []);
                }
              }}
            />
            <span className="text-xs text-gray-500">전체 선택</span>
          </div>
          <ul className="overflow-y-auto divide-y divide-gray-200 flex-grow">
            {flowIds.map((flowId, index) => {
              const flow = flowMap[flowId];
              if (!flow) return null;
              const checked = selectedFlowIds.includes(flowId);
              return (
                <li
                  key={flowId}
                  className="p-3 flex items-center transition-colors duration-150 group bg-white"
                  onClick={() => onFlowSelect(flowId)}
                  style={{ cursor: 'pointer' }}
                >
                  <ExecutorCheckbox
                    className="mr-3"
                    checked={checked}
                    onChange={e => handleFlowCheckboxChange(flowId, e.target.checked)}
                  />
                  <NodeStatusIndicator status={flow.status} className="mr-2 flex-shrink-0" />
                  <div className="flex-grow min-w-0">
                    {editingFlowId === flowId ? (
                      <InlineEditInput
                        value={flow.name}
                        onSave={newName => handleSaveFlowName(flowId, newName)}
                        onCancel={handleCancelEdit}
                        validate={v => validateFlowName(v, flowId)}
                      />
                    ) : (
                      <div className="flex items-center gap-1">
                        <p
                          className="text-sm font-medium text-gray-800 truncate cursor-pointer"
                          title={flow.name}
                          onClick={e => { e.stopPropagation(); setEditingFlowId(flowId); }}
                          tabIndex={0}
                          aria-label="Flow 이름 편집"
                          style={{ marginBottom: 0 }}
                        >
                          {flow.name}
                        </p>
                        <button
                          className="ml-1 p-1 rounded hover:bg-gray-100"
                          onClick={e => { e.stopPropagation(); setEditingFlowId(flowId); }}
                          title="이름 편집"
                          tabIndex={0}
                        >
                          <PenLineIcon size={16} />
                        </button>
                      </div>
                    )}
                    <p className="text-xs text-gray-500 truncate">
                      {flow.status === 'error' && flow.error ? <span className="text-red-500">Error: {flow.error}</span> : 
                        (flow.lastResults ? `${Array.isArray(flow.lastResults) ? flow.lastResults.length : 1} result(s)` : 'No results')}
                    </p>
                  </div>
                  <div className="ml-2 flex-shrink-0 flex items-center space-x-1 opacity-100 transition-opacity duration-150">
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
                      disabled={index === flowIds.length - 1}
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
          {/* 선택된 Flow들의 실행 결과 표시 */}
          <div className="mt-6">
            <FlowChainResultDisplay flowResults={selectedFlows} />
          </div>
        </div>
      )}
    </div>
  );
};

export default FlowChainDetailsView; 