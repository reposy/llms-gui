import React, { useState, useEffect, useMemo } from 'react';
import { useFlowExecutorStore } from '../../store/useFlowExecutorStore';
import FlowChainListView from './FlowChainListView';
import FlowChainDetailsView from './FlowChainDetailsView';
import FlowChainModal from './FlowChainModal';
import StageNavigationBar from './stages/StageNavigationBar';
import FileUploader from './FileUploader';

const FlowChainPage: React.FC = () => {
  const store = useFlowExecutorStore();
  const chainIds = store.chainIds;
  const chains = store.chains;
  const focusedFlowChainId = store.focusedFlowChainId;
  const [selectedChainId, setSelectedChainId] = useState<string | null>(null);
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
  const [isFlowModalOpen, setIsFlowModalOpen] = useState<boolean>(false);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);

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

  const handleCreateNewChain = () => {
    const newChainId = store.addChain('새 Flow 체인');
    setSelectedChainId(newChainId);
    store.setFocusedFlowChainId(newChainId);
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
  const canViewResults = useMemo(() => selectedChain?.flowIds.some(flowId => {
    const flow = selectedChain.flowMap[flowId];
    return flow.lastResults && flow.lastResults.length > 0;
  }) || false, [selectedChain]);

  // 입력 설정 가능한지 확인
  const canSetInput = useMemo(() => (selectedChain?.flowIds.length || 0) > 0, [selectedChain]);

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* 상단 패널 */}
      <div className="p-4 flex items-center justify-between bg-white border-b border-gray-200">
        <button
          onClick={handleCreateNewChain}
          className="px-4 py-2 bg-indigo-600 text-white rounded shadow-sm hover:bg-indigo-700"
        >
          새 Flow 체인 만들기
        </button>
        <button
          onClick={handleClearAll}
          className="px-4 py-2 bg-red-500 text-white rounded shadow-sm hover:bg-red-600"
        >
          전체 초기화
        </button>
      </div>
      {/* 스테이지 네비게이션 */}
      <StageNavigationBar
        currentStage={store.stage}
        onStageChange={handleStageChange}
        canSetInput={canSetInput}
        canViewResults={canViewResults}
      />
      {/* 메인 컨텐츠 */}
      <div className="flex-1 overflow-hidden">
        {store.stage === 'upload' ? (
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