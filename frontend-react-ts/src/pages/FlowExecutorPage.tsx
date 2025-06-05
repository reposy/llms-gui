import React, { useState, useEffect, useMemo } from 'react';
// import { Link } from 'react-router-dom'; // Not used currently
import FlowChainListView from '../components/executor/FlowChainListView';
import FlowChainDetailsView from '../components/executor/FlowChainDetailsView';
import { useFlowExecutorStore } from '../store/useFlowExecutorStore';
import ExportModal from '../components/executor/ExportModal';
import ExecutorPanel from '../components/executor/ExecutorPanel';
import StageNavigationBar from '../components/executor/stages/StageNavigationBar';
import FlowDetailModal from '../components/executor/FlowDetailModal';
import { executeChain } from '../services/flowExecutionService';
import { useImportService } from '../hooks/useImportService';

const FlowExecutorPage: React.FC = () => {
  const store = useFlowExecutorStore();
  const { openFileImport } = useImportService();
  const flowChainIds = store.flowChainIds;
  const flowChainMap = store.flowChainMap;
  const focusedFlowChainId = store.focusedFlowChainId;
  const [selectedFlowIds, setSelectedFlowIds] = useState<string[]>([]);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);

  useEffect(() => {
    if (!focusedFlowChainId && flowChainIds.length > 0) {
      store.setFocusedFlowChainId(flowChainIds[0]);
    }
  }, [focusedFlowChainId, flowChainIds.length]);

  const handleChainSelect = (chainId: string) => {
    store.setFocusedFlowChainId(chainId);
    setSelectedFlowIds([]);
  };

  const handleFlowSelect = (flowId: string) => {
    console.log('[FlowExecutorPage] handleFlowSelect called with flowId:', flowId);
    console.log('[FlowExecutorPage] focusedFlowChainId:', focusedFlowChainId);
    setSelectedFlowIds([flowId]);
    console.log('[FlowExecutorPage] selectedFlowIds updated to:', [flowId]);
  };

  const handleCloseFlowModal = () => {
    setSelectedFlowIds([]);
  };

  const handleImportFlow = () => {
    if (!focusedFlowChainId) {
      alert('Flow를 추가할 FlowChain을 먼저 선택해주세요.');
      return;
    }
    
    // ✅ 중앙화된 Import 서비스 사용
    openFileImport({
      targetChainId: focusedFlowChainId,
      onSuccess: (result) => {
        console.log(`[FlowExecutorPage] Import 성공:`, result);
        // 성공 시 추가 로직 (예: 토스트 알림)
      },
      onError: (error) => {
        console.error('[FlowExecutorPage] Import 실패:', error);
        alert(`Flow 가져오기 실패: ${error.message}`);
      }
    });
  };

  const handleClearAll = () => {
    if (window.confirm('모든 Flow Chain과 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      store.resetState();
      setSelectedFlowIds([]);
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
      // useFlowExecutorStore의 전체 상태를 가져오기
      const storeState = useFlowExecutorStore.getState();
      
      console.log('[FlowExecutorPage] Export - current store state:', {
        flowChainIds: storeState.flowChainIds,
        flowChainMapKeys: Object.keys(storeState.flowChainMap),
        focusedFlowChainId: storeState.focusedFlowChainId
      });
      
      // export 데이터 구조
      const exportData = {
        version: '1.3', // 새로운 export 형식 버전
        timestamp: new Date().toISOString(),
        storeSnapshot: {
          flowChainMap: includeData ? storeState.flowChainMap : 
            // 실행 데이터 제외하고 복사
            Object.fromEntries(
              Object.entries(storeState.flowChainMap).map(([chainId, chain]) => {
                console.log(`[FlowExecutorPage] Export - processing chain ${chainId}:`, {
                  name: chain.name,
                  flowIds: chain.flowIds,
                  flowMapKeys: Object.keys(chain.flowMap || {}),
                  flowMapDetails: Object.entries(chain.flowMap || {}).map(([flowId, flow]) => ({
                    flowId,
                    flowName: flow?.name,
                    flowType: typeof flow,
                    hasFlowJson: !!flow?.flowJson
                  }))
                });
                
                return [
                  chainId,
                  {
                    ...chain,
                    status: undefined, // 실행 상태 제거
                    error: undefined,
                    flowMap: Object.fromEntries(
                      Object.entries(chain.flowMap || {}).map(([flowId, flow]) => [
                        flowId,
                        {
                          ...flow,
                          status: undefined, // 실행 상태 제거
                          lastResults: undefined, // 실행 결과 제거
                          error: undefined
                        }
                      ])
                    )
                  }
                ];
              })
            ),
          flowChainIds: storeState.flowChainIds,
          focusedFlowChainId: storeState.focusedFlowChainId,
          stage: storeState.stage,
          // 실행 관련 상태는 포함하지 않음
          ...(includeData ? { error: storeState.error } : {})
        }
      };
      
      console.log('[FlowExecutorPage] Export - final export data structure:', {
        version: exportData.version,
        storeSnapshotKeys: Object.keys(exportData.storeSnapshot),
        flowChainMapKeys: Object.keys(exportData.storeSnapshot.flowChainMap || {})
      });
      
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
      
      console.log(`[ExecutorPage] FlowExecutor store exported successfully ${includeData ? 'with execution data' : 'as clean state'}`);
    } catch (err) {
      console.error(`[ExecutorPage] Error exporting FlowExecutor store:`, err);
      alert('FlowExecutor 상태 내보내기 중 오류가 발생했습니다.');
    }
  };

  const handleExecuteFlow = async () => {
    if (!selectedChain) {
      store.setError('실행할 활성 Flow Chain이 없습니다.');
      return;
    }

    setIsExecuting(true);
    try {
      // 현재 화면의 모든 Flow Chain을 순차적으로 실행
      for (const chainId of flowChainIds) {
        const chain = flowChainMap[chainId];
        if (!chain || chain.flowIds.length === 0) {
          console.log(`[FlowExecutorPage] Skipping empty chain: ${chainId}`);
          continue;
        }

        console.log(`[FlowExecutorPage] Executing chain: ${chainId}`);
        
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
      }
      
      console.log('[FlowExecutorPage] All chains executed successfully');
    } catch (error) {
      console.error('[FlowExecutorPage] Error executing flow chains:', error);
      store.setError(`Flow Chain 실행 중 오류가 발생했습니다: ${error}`);
    } finally {
      setIsExecuting(false);
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
      {(() => {
        const shouldShowModal = focusedFlowChainId && selectedFlowIds.length > 0 && selectedFlowIds[0];
        console.log('[FlowExecutorPage] Modal render condition:', {
          focusedFlowChainId,
          selectedFlowIdsLength: selectedFlowIds.length,
          firstSelectedFlowId: selectedFlowIds[0],
          shouldShowModal
        });
        return shouldShowModal;
      })() && focusedFlowChainId && (
        <FlowDetailModal
          flowChainId={focusedFlowChainId}
          flowId={selectedFlowIds[0]}
          onClose={handleCloseFlowModal}
        />
      )}
    </div>
  );
};

export default FlowExecutorPage; 