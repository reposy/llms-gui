import React, { useState, useEffect, useMemo } from 'react';
// import { Link } from 'react-router-dom'; // Not used currently
import FlowChainListView from '../components/executor/FlowChainListView';
import FlowChainDetailsView from '../components/executor/FlowChainDetailsView';
import { useFlowExecutorStore } from '../store/useFlowExecutorStore';
import ExportModal from '../components/executor/ExportModal';
import ExecutorPanel from '../components/executor/ExecutorPanel';
import StageNavigationBar from '../components/executor/stages/StageNavigationBar';
import { importFlowJsonToStore } from '../utils/flow/flowExecutorUtils';
import FlowDetailModal from '../components/executor/FlowDetailModal';

const FlowExecutorPage: React.FC = () => {
  const store = useFlowExecutorStore();
  const flowChainIds = store.flowChainIds;
  const flowChainMap = store.flowChainMap;
  const focusedFlowChainId = store.focusedFlowChainId;
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);

  useEffect(() => {
    if (!focusedFlowChainId && flowChainIds.length > 0) {
      store.setFocusedFlowChainId(flowChainIds[0]);
    }
  }, [focusedFlowChainId, flowChainIds.length]);

  const handleChainSelect = (chainId: string) => {
    store.setFocusedFlowChainId(chainId);
    setSelectedFlowId(null);
  };

  const handleFlowSelect = (flowId: string) => {
    setSelectedFlowId(flowId);
  };

  const handleCloseFlowModal = () => {
    setSelectedFlowId(null);
  };

  const handleImportFlow = () => {
    if (!focusedFlowChainId) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const json = event.target?.result as string;
          const flowData = JSON.parse(json);
          importFlowJsonToStore(focusedFlowChainId, flowData);
        } catch (error) {
          console.error('Flow 가져오기 오류:', error);
          alert('Flow 파일을 처리하는 중 오류가 발생했습니다.');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleClearAll = () => {
    if (window.confirm('모든 Flow Chain과 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      store.resetState();
      setSelectedFlowId(null);
    }
  };

  const handleStageChange = (newStage: typeof store.stage) => {
    store.setStage(newStage);
  };

  // 현재 선택된 체인
  const selectedChain = focusedFlowChainId ? flowChainMap[focusedFlowChainId] : null;

  // 결과를 볼 수 있는지 확인
  const canViewResults = useMemo(() => {
    if (!selectedChain) return false;
    return selectedChain.flowIds?.some((flowId: string) => {
      const flow = selectedChain.flowMap?.[flowId];
      return flow && flow.lastResults && flow.lastResults.length > 0;
    }) || false;
  }, [selectedChain]);

  // 입력 설정 가능한지 확인
  const canSetInput = useMemo(() => (selectedChain?.flowIds?.length || 0) > 0, [selectedChain]);

  const handleExportWithFilename = (filename: string, includeData: boolean) => {
    try {
      const exportData = {
        version: '1.1',
        chains: flowChainMap,
        flows: selectedChain?.flowMap || {}
      };
      
      if (!includeData) {
        // 데이터 제외 시 복사본 생성하여 결과 데이터 제거
        const dataWithoutResults = JSON.parse(JSON.stringify(exportData));
        Object.keys(dataWithoutResults.flows).forEach(flowId => {
          dataWithoutResults.flows[flowId].results = null;
          dataWithoutResults.flows[flowId].inputs = [];
        });
        exportData.chains = dataWithoutResults.chains;
        exportData.flows = dataWithoutResults.flows;
      }
      
      const json = JSON.stringify(exportData, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      console.log(`[ExecutorPage] Flows exported successfully with ${includeData ? '' : 'no '}data`);
    } catch (err) {
      console.error(`[ExecutorPage] Error exporting flows:`, err);
      alert('Flows 내보내기 중 오류가 발생했습니다.');
    }
  };

  const handleExecuteFlow = () => {
    if (selectedChain) {
      setIsExecuting(true);
      // Attempt to trigger executeChain in FlowChainDetail by simulating a click
      // This is a workaround. Ideally, FlowChainDetail exposes a ref or a direct function.
      const executeButton = document.querySelector('#flow-chain-detail-execute-button');
      if (executeButton instanceof HTMLElement) {
        executeButton.click();
      }
      setTimeout(() => setIsExecuting(false), 1000); // Set timeout to prevent multiple clicks
    } else {
      store.setError('실행할 활성 Flow Chain이 없습니다.');
    }
  };

  const handleExportFlowChain = (filename: string, includeData: boolean) => {
    handleExportWithFilename(filename, includeData);
  };

  const panelActions = {
    onExport: () => setExportModalOpen(true),
    onReset: handleClearAll,
    onExecuteAll: handleExecuteFlow,
  };

  const stageNavProps = {
    currentStage: store.stage,
    onStageChange: handleStageChange,
    canSetInput: canSetInput,
    canViewResults: canViewResults,
    isExecutionDisabled: !selectedChain || selectedChain.flowIds.length === 0 || (selectedChain.status === 'running'),
    onExecute: panelActions.onExecuteAll,
    error: store.error,
  };

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <ExecutorPanel 
        onImportFlowChain={handleImportFlow}
        onExportFlowChain={handleExportFlowChain}
        onExecuteFlow={handleExecuteFlow}
        onClearAll={handleClearAll}
        isExecuting={isExecuting}
      />
      <StageNavigationBar {...stageNavProps} />
      <div className="flex-grow overflow-hidden p-4">
        <div className="flex h-full space-x-4">
          {/* Left Panel */}
          <div className="w-1/3 flex flex-col space-y-4 h-full">
            <div className="bg-white shadow rounded-lg p-4 flex-grow overflow-y-auto">
              <FlowChainListView onFlowChainSelect={handleChainSelect} />
            </div>
          </div>
          {/* Right Panel */}
          <div className="w-2/3 bg-white shadow rounded-lg p-4 h-full overflow-y-auto">
            {focusedFlowChainId ? (
              <FlowChainDetailsView
                flowChainId={focusedFlowChainId}
                onFlowSelect={handleFlowSelect}
                onImportFlow={handleImportFlow}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500">Select or Create a Flow Chain from the left panel.</p>
              </div>
            )}
          </div>
        </div>
      </div>
      <ExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        onExport={handleExportWithFilename}
        defaultFilename="flows-export.json"
      />
      {/* Flow 상세 모달 */}
      {focusedFlowChainId && selectedFlowId && (
        <FlowDetailModal
          flowChainId={focusedFlowChainId}
          flowId={selectedFlowId}
          onClose={handleCloseFlowModal}
        />
      )}
    </div>
  );
};

export default FlowExecutorPage; 