import React, { useState, useEffect } from 'react';
// import { Link } from 'react-router-dom'; // Not used currently
import { FlowChainList } from '../components/FlowExecutor/FlowChainList';
import { FlowChainDetail } from '../components/FlowExecutor/FlowChainDetail';
import { FlowChainModal } from '../components/FlowExecutor/FlowChainModal';
import { ExecutorStage, Flow, FlowChain } from '../store/useFlowExecutorStore';
import { useFlowExecutorStore } from '../store/useFlowExecutorStore';
import { type FlowData } from '../utils/data/importExportUtils';
import ExportModal from '../components/executor/ExportModal';
import ExecutorPanel from '../components/executor/ExecutorPanel';
import StageNavigationBar from '../components/executor/stages/StageNavigationBar';
// import { Box, Grid } from '@mui/material'; // Removed @mui/material

const ExecutorPage: React.FC = () => {
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [modalFlow, setModalFlow] = useState<{ chainId: string; flowId: string } | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  
  // 스토어에서 상태와 액션 가져오기
  const {
    stage,
    error,
    chains,
    flows,
    focusedFlowChainId,
    chainIds,
    getChain,
    getFlow,
    getFocusedChain,
    setStage,
    resetState
  } = useFlowExecutorStore();
  
  // 활성 체인 가져오기
  const focusedChain = getFocusedChain();
  
  useEffect(() => {
    // 체인이 없는 경우 upload 단계로 이동
    if (chainIds.length === 0 && stage !== 'upload') {
      setStage('upload');
    } else if (chainIds.length > 0 && stage === 'upload') {
      setStage('input');
    }
  }, [chains, stage, setStage]);

  useEffect(() => {
    if (!focusedChain || !focusedChain.selectedFlowId) return;
    const flow = flows[focusedChain.selectedFlowId];
    if (!flow) return;
    
    if (flow.status !== 'running' && flow.results && stage === 'executing') {
      setStage('result');
    }
  }, [focusedChain, stage, setStage, flows]);

  const handleExportWithFilename = (filename: string, includeData: boolean) => {
    try {
      const exportData = {
        version: '1.1',
        chains,
        flows
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

  const handleReset = () => {
    // 확인 대화 상자 표시
    if (window.confirm('모든 내용을 초기화하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      try {
        console.log('[ExecutorPage] 모든 내용 초기화 시작');
        
        // 로컬 스토리지에서 저장된 상태 정보 직접 제거
        localStorage.removeItem('executor-state-store');
        localStorage.removeItem('executor-graph-storage');
        localStorage.removeItem('flow-executor-store');
        
        // Zustand 스토어 상태 초기화
        resetState();
        
        console.log('[ExecutorPage] 초기화 완료');
        
        // 페이지 새로고침
        window.location.reload();
      } catch (error) {
        console.error('[ExecutorPage] 초기화 중 오류 발생:', error);
        alert('초기화 중 오류가 발생했습니다.');
      }
    }
  };

  const handleExecuteFlow = () => {
    if (focusedChain) {
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
    canSetInput: Object.keys(chains).length > 0,
    canViewResults: !!(focusedChain && focusedChain.selectedFlowId && flows[focusedChain.selectedFlowId]?.results),
    isExecutionDisabled: !focusedChain || focusedChain.flowIds.length === 0 || (focusedChain.status === 'running'),
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