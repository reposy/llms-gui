import React, { useState, useEffect, useMemo } from 'react';
import { useExecutorStateStore } from '../../store/useExecutorStateStore';
import FlowChainListView from './FlowChainListView';
import FlowChainDetailsView from './FlowChainDetailsView';
import FlowChainModal from './FlowChainModal';
import ExecutorPanelRefactored from './ExecutorPanelRefactored';
import StageNavigationBar from './stages/StageNavigationBar';
import FileUploader from './FileUploader';
import { executeFlowChain } from '../../services/flowChainExecutionService';

const FlowChainPage: React.FC = () => {
  const [selectedChainId, setSelectedChainId] = useState<string | null>(null);
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
  const [isFlowModalOpen, setIsFlowModalOpen] = useState<boolean>(false);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  
  const { 
    flows, 
    stage, 
    setStage,
    addFlowToChain,
    getChain,
    resetState,
    setActiveChainId,
    addChain
  } = useExecutorStateStore();

  // 활성 체인 ID가 변경되면 선택된 체인 ID 업데이트
  useEffect(() => {
    // 스토어에서 상태가 업데이트될 때 실행
    if (flows.activeChainId) {
      setSelectedChainId(flows.activeChainId);
    } else if (flows.chainIds.length > 0) {
      setSelectedChainId(flows.chainIds[0]);
      setActiveChainId(flows.chainIds[0]);
    } else {
      setSelectedChainId(null);
    }
  }, [flows.activeChainId, flows.chainIds.length, setActiveChainId]);

  const handleChainSelect = (chainId: string) => {
    setSelectedChainId(chainId);
    setSelectedFlowId(null);
    setActiveChainId(chainId);
  };

  const handleFlowSelect = (flowId: string) => {
    setSelectedFlowId(flowId);
    setIsFlowModalOpen(true);
  };

  const handleCloseFlowModal = () => {
    setIsFlowModalOpen(false);
  };

  const handleCreateNewChain = () => {
    addChain('새 Flow 체인');
    
    // 스토어 상태를 직접 가져와서 새 Chain ID를 찾아냄
    const state = useExecutorStateStore.getState();
    if (state.flows.chainIds.length > 0) {
      const newChainId = state.flows.chainIds[state.flows.chainIds.length - 1];
      setSelectedChainId(newChainId);
      setActiveChainId(newChainId);
    }
  };

  const handleImportFlow = () => {
    if (!selectedChainId) return;
    
    // 파일 선택기 생성
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    
    // 파일 선택 처리
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const json = event.target?.result as string;
          const flowData = JSON.parse(json);
          
          // Flow Chain에 Flow 추가
          addFlowToChain(selectedChainId!, flowData);
          
        } catch (error) {
          console.error('Flow 가져오기 오류:', error);
          alert('Flow 파일을 처리하는 중 오류가 발생했습니다.');
        }
      };
      
      reader.readAsText(file);
    };
    
    // 파일 선택기 클릭
    input.click();
  };

  const handleExecuteChain = async () => {
    if (!selectedChainId || isExecuting) return;
    
    setIsExecuting(true);
    
    try {
      // Chain 실행
      await executeFlowChain({
        flowChainId: selectedChainId,
        onChainStart: (id) => {
          console.log(`체인 실행 시작: ${id}`);
        },
        onChainComplete: (id, results) => {
          console.log(`체인 실행 완료: ${id}`, results);
          setIsExecuting(false);
          setStage('result');
        },
        onFlowStart: (chainId, flowId) => {
          console.log(`Flow 실행 시작: ${flowId}`);
        },
        onFlowComplete: (chainId, flowId, results) => {
          console.log(`Flow 실행 완료: ${flowId}`, results);
        },
        onError: (chainId, flowId, error) => {
          console.error(`실행 오류: ${flowId ? `Flow ${flowId}` : `Chain ${chainId}`}`, error);
          setIsExecuting(false);
        }
      });
    } catch (error) {
      console.error('체인 실행 중 오류 발생:', error);
      setIsExecuting(false);
    }
  };

  const handleExportFlowChain = (filename: string, includeData: boolean) => {
    // 현재 체인 정보 수집
    const chainToExport = flows.chainIds.map(chainId => {
      const chain = flows.chains[chainId];
      
      const flowsData = chain.flowIds.map(flowId => {
        const flow = chain.flows[flowId];
        return {
          id: flow.id,
          name: flow.name,
          flowJson: flow.flowJson,
          inputs: includeData ? flow.inputs : [],
          lastResults: includeData ? flow.lastResults : null
        };
      });
      
      return {
        id: chain.id,
        name: chain.name,
        selectedFlowId: chain.selectedFlowId,
        flows: flowsData
      };
    });
    
    // JSON 생성 및 다운로드
    const exportData = {
      version: '1.0',
      chains: chainToExport
    };
    
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
  };

  const handleImportFlowChain = () => {
    // 파일 선택기 생성
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    
    // 파일 선택 처리
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const json = event.target?.result as string;
          const importData = JSON.parse(json);
          
          // TODO: 가져온 Flow Chain 데이터를 처리합니다.
          console.log('가져온 Flow Chain 데이터:', importData);
          
          alert('Flow Chain을 성공적으로 가져왔습니다.');
        } catch (error) {
          console.error('Flow Chain 가져오기 오류:', error);
          alert('Flow Chain 파일을 처리하는 중 오류가 발생했습니다.');
        }
      };
      
      reader.readAsText(file);
    };
    
    // 파일 선택기 클릭
    input.click();
  };

  const handleClearAll = () => {
    if (window.confirm('모든 Flow Chain과 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      resetState();
      setSelectedChainId(null);
      setSelectedFlowId(null);
    }
  };

  const handleStageChange = (newStage: typeof stage) => {
    setStage(newStage);
  };

  // 현재 선택된 체인이 있는지 확인
  const selectedChain = selectedChainId ? flows.chains[selectedChainId] : null;
  
  // 결과를 볼 수 있는지 확인
  const canViewResults = useMemo(() => selectedChain?.flowIds.some(flowId => {
    const flow = selectedChain.flows[flowId];
    return flow.lastResults && flow.lastResults.length > 0;
  }) || false, [selectedChain]);

  // 입력 설정 가능한지 확인
  const canSetInput = useMemo(() => (selectedChain?.flowIds.length || 0) > 0, [selectedChain]);

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* 상단 패널 */}
      <ExecutorPanelRefactored
        onImportFlowChain={handleImportFlowChain}
        onExportFlowChain={handleExportFlowChain}
        onExecuteFlow={handleExecuteChain}
        onClearAll={handleClearAll}
        isExecuting={isExecuting}
      />
      
      {/* 스테이지 네비게이션 */}
      <StageNavigationBar
        currentStage={stage}
        onStageChange={handleStageChange}
        canSetInput={canSetInput}
        canViewResults={canViewResults}
      />
      
      {/* 메인 컨텐츠 */}
      <div className="flex-1 overflow-hidden">
        {stage === 'upload' ? (
          <div className="h-full flex items-center justify-center p-6">
            <FileUploader onFileUpload={handleImportFlow} />
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-6 h-full p-6">
            {/* 좌측: Flow Chain 목록 */}
            <div className="col-span-4">
              <FlowChainListView onChainSelect={handleChainSelect} />
            </div>
            
            {/* 우측: 선택된 Chain 상세 정보 */}
            <div className="col-span-8">
              {selectedChainId ? (
                <FlowChainDetailsView
                  chainId={selectedChainId}
                  onFlowSelect={handleFlowSelect}
                  onImportFlow={handleImportFlow}
                />
              ) : (
                <div className="bg-white shadow rounded-lg p-6 flex items-center justify-center h-full">
                  <div className="text-center text-gray-500">
                    <p className="mb-4">Flow 체인을 선택하거나 새로 만드세요.</p>
                    <button
                      onClick={handleCreateNewChain}
                      className="px-4 py-2 bg-indigo-600 text-white rounded shadow-sm hover:bg-indigo-700"
                    >
                      새 Flow 체인 만들기
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Flow 상세 모달 */}
      {selectedChainId && selectedFlowId && (
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

export default FlowChainPage; 