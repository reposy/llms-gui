import React, { useState, useEffect, useMemo } from 'react';
// import { Link } from 'react-router-dom'; // Not used currently
import { FlowChainList } from '../components/FlowExecutor/FlowChainList';
import { FlowChainDetail } from '../components/FlowExecutor/FlowChainDetail';
import FlowChainModal from '../components/executor/FlowChainModal';
import { useFlowExecutorStore } from '../store/useFlowExecutorStore';
import ExportModal from '../components/executor/ExportModal';
import ExecutorPanel from '../components/executor/ExecutorPanel';
import StageNavigationBar from '../components/executor/stages/StageNavigationBar';
import FlowChainListView from '../components/executor/FlowChainListView';
import FlowChainDetailsView from '../components/executor/FlowChainDetailsView';

const ExecutorPage: React.FC = () => {
  const store = useFlowExecutorStore();
  const chainIds = store.chainIds;
  const chains = store.chains;
  const focusedFlowChainId = store.focusedFlowChainId;
  const [selectedChainId, setSelectedChainId] = useState<string | null>(null);
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
  const [isFlowModalOpen, setIsFlowModalOpen] = useState<boolean>(false);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);

  // 활성 체인 ID가 변경되면 선택된 체인 ID 업데이트
  useEffect(() => {
    if (focusedFlowChainId) {
      setSelectedChainId(focusedFlowChainId);
    } else if (chainIds.length > 0) {
      setSelectedChainId(chainIds[0]);
      store.setFocusedFlowChainId(chainIds[0]);
    } else {
      setSelectedChainId(null);
    }
  }, [focusedFlowChainId, chainIds.length]);

  const handleChainSelect = (chainId: string) => {
    setSelectedChainId(chainId);
    setSelectedFlowId(null);
    store.setFocusedFlowChainId(chainId);
  };

  const handleFlowSelect = (flowId: string) => {
    setSelectedFlowId(flowId);
    setIsFlowModalOpen(true);
  };

  const handleCloseFlowModal = () => {
    setIsFlowModalOpen(false);
  };

  const handleImportFlow = () => {
    if (!selectedChainId) return;
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
          store.addFlowToChain(selectedChainId, flowData);
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
      setSelectedChainId(null);
      setSelectedFlowId(null);
    }
  };

  const handleStageChange = (newStage: typeof store.stage) => {
    store.setStage(newStage);
  };

  // 현재 선택된 체인
  const selectedChain = selectedChainId ? chains[selectedChainId] : null;

  // 결과를 볼 수 있는지 확인
  const canViewResults = useMemo(() => {
    if (!selectedChain) return false;
    return selectedChain.flowIds?.some(flowId => {
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
        chains,
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
              <FlowChainListView onChainSelect={handleChainSelect} />
            </div>
          </div>
          {/* Right Panel */}
          <div className="w-2/3 bg-white shadow rounded-lg p-4 h-full overflow-y-auto">
            {selectedChainId ? (
              <FlowChainDetailsView
                chainId={selectedChainId}
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
      {selectedChainId && selectedFlowId && isFlowModalOpen && (
        <FlowChainModal
          isOpen={isFlowModalOpen}
          onClose={handleCloseFlowModal}
          chainId={selectedChainId}
          flowId={selectedFlowId}
        />
      )}
    </div>
  );
};

export default ExecutorPage; 