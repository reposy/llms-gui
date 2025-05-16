import React, { useState, useEffect } from 'react';
// import { Link } from 'react-router-dom'; // Not used currently
import { FlowChainList } from '../components/FlowExecutor/FlowChainList';
import { FlowChainDetail } from '../components/FlowExecutor/FlowChainDetail';
import { FlowChainModal } from '../components/FlowExecutor/FlowChainModal';
import { useExecutorStateStore, ExecutorStage, Flow, FlowChain, FlowData } from '../store/useExecutorStateStore';
import ExportModal from '../components/executor/ExportModal';
import ExecutorPanel from '../components/executor/ExecutorPanel';
import StageNavigationBar from '../components/executor/stages/StageNavigationBar';
// import { Box, Grid } from '@mui/material'; // Removed @mui/material

const ExecutorPage: React.FC = () => {
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [modalFlow, setModalFlow] = useState<{ chainId: string; flowId: string } | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  
  const {
    flowExecutorStore,
    setStage,
    setError,
    getActiveFlowChain,
    // getFlowChain, // Not directly used in UI logic here
    // getFlow, // Not directly used in UI logic here
    // setFlowResults, // Handled by execution service callbacks
    resetState,
    // addFlowToChain, // FileUploader가 직접 스토어 액션 사용하므로 ExecutorPage에서 직접 호출 필요 X
    // setFlowInputs, // Handled within FlowChainModal
  } = useExecutorStateStore();
  
  const { stage, error } = flowExecutorStore;
  const activeChain = getActiveFlowChain();
  
  useEffect(() => {
    if (flowExecutorStore.chainIds.length === 0 && stage !== 'upload') {
      setStage('upload');
    } else if (flowExecutorStore.chainIds.length > 0 && stage === 'upload') {
      setStage('input');
    }
  }, [flowExecutorStore.chainIds, stage, setStage]);

  useEffect(() => {
    if (!activeChain || !activeChain.selectedFlowId) return;
    const flow = activeChain.flowMap[activeChain.selectedFlowId];
    if (!flow) return;
    
    if (flow.status !== 'running' && flow.lastResults && stage === 'executing') {
          setStage('result');
        }
  }, [activeChain, stage, setStage]);

  const handleExportWithFilename = (filename: string, includeData: boolean) => {
    try {
      const exportData = {
        version: '1.1',
        flowExecutorStore: { ...flowExecutorStore } // Create a shallow copy to avoid direct mutation before stringify
      };
      
      if (!includeData) {
        const flowsWithoutData = JSON.parse(JSON.stringify(flowExecutorStore)); 
        Object.values(flowsWithoutData.flowChainMap).forEach((chain: any) => {
          Object.values(chain.flowMap).forEach((flowItem: any) => { // Renamed to avoid conflict
            flowItem.lastResults = null;
            flowItem.inputs = [];
          });
        });
        exportData.flowExecutorStore = flowsWithoutData;
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

  const handleReset = () => {
    resetState();
    setStage('upload');
  };

  const handleExecuteFlow = () => {
    if (activeChain) {
    setIsExecuting(true);
      // Attempt to trigger executeChain in FlowChainDetail by simulating a click
      // This is a workaround. Ideally, FlowChainDetail exposes a ref or a direct function.
      const executeButton = document.querySelector('#flow-chain-detail-execute-button');
      if (executeButton instanceof HTMLElement) {
        executeButton.click();
      }
      setTimeout(() => setIsExecuting(false), 1000); // Set timeout to prevent multiple clicks
    } else {
      setError('실행할 활성 Flow Chain이 없습니다.');
    }
  };

  const handleExportFlowChain = (filename: string, includeData: boolean) => {
    handleExportWithFilename(filename, includeData);
  };

  const panelActions = {
    onExport: () => setExportModalOpen(true),
    onReset: handleReset,
    onExecuteAll: handleExecuteFlow,
  };

  const stageNavProps = {
    currentStage: stage,
    onStageChange: setStage,
    canSetInput: flowExecutorStore.chainIds.length > 0,
    canViewResults: !!(activeChain && activeChain.selectedFlowId && activeChain.flowMap[activeChain.selectedFlowId]?.lastResults),
    isExecutionDisabled: !activeChain || activeChain.flowIds.length === 0 || (activeChain.status === 'running'),
    onExecute: panelActions.onExecuteAll,
    error,
  };

  const openFlowModal = (chainId: string, flowId: string) => {
    setModalFlow({ chainId, flowId });
  };

  const closeFlowModal = () => {
    setModalFlow(null);
  };

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <ExecutorPanel 
        onImportFlowChain={() => {}} // 필요한 경우 구현
        onExportFlowChain={handleExportFlowChain}
        onExecuteFlow={handleExecuteFlow}
        onClearAll={handleReset}
        isExecuting={isExecuting}
      />
      <StageNavigationBar {...stageNavProps} />
      <div className="flex-grow overflow-hidden p-4">
        <div className="flex h-full space-x-4">
          {/* Left Panel */}
          <div className="w-1/3 flex flex-col space-y-4 h-full">
            <div className="bg-white shadow rounded-lg p-4 flex-grow overflow-y-auto">
              <FlowChainList />
            </div>
          </div>
          {/* Right Panel */}
          <div className="w-2/3 bg-white shadow rounded-lg p-4 h-full overflow-y-auto">
            <FlowChainDetail onFlowSelect={openFlowModal} />
          </div>
                        </div>
                      </div>

      <ExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        onExport={handleExportWithFilename}
        defaultFilename="flows-export.json"
      />

      {/* FlowChainModal is now expected to be triggered from FlowChainDetail clicks */}
      {/* Ensure FlowChainDetail has a mechanism to open this modal by passing setModalFlow or similar */}
      {modalFlow && (
        <FlowChainModal
          chainId={modalFlow.chainId}
          flowId={modalFlow.flowId}
          open={!!modalFlow}
          onClose={closeFlowModal}
        />
      )}
    </div>
  );
};

export default ExecutorPage; 