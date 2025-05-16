import React from 'react';
import { useExecutorStateStore } from '../../store/useExecutorStateStore';
import { NodeStatusIndicator } from '../nodes/shared/NodeStatusIndicator';
import { PlusIcon, TrashIcon, PenLineIcon, ArrowDownTrayIcon } from '../Icons';
import { FlowChainData, importFlowChainFromJson } from '../../utils/data/importExportUtils';

export const FlowChainList: React.FC = () => {
  const { flowExecutorStore, addFlowChain, removeFlowChain, setFlowChainName, setActiveChainId } = useExecutorStateStore(); // setActiveChainId 추가
  const { activeChainId } = flowExecutorStore;
  
  const handleAddChain = () => {
    const newChainName = `Flow Chain ${flowExecutorStore.chainIds.length + 1}`;
    const newChainId = addFlowChain(newChainName); // addFlowChain이 id를 반환하도록 수정 필요 (또는 store에서 생성된 id를 가져옴)
    // setActiveChainId(newChainId); // 새 체인 생성 시 활성화 (addFlowChain 내부에서 처리하도록 변경되었으므로 주석 처리)
  };

  // Flow Chain 가져오기 핸들러
  const handleImportChain = () => {
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
          const chainData = JSON.parse(json) as FlowChainData;
          
          // Chain 데이터 검증
          if (!chainData || !chainData.name || !chainData.flowIds || !chainData.flowMap) {
            throw new Error('유효하지 않은 Flow Chain 데이터입니다.');
          }
          
          // Chain 가져오기
          const newChainId = importFlowChainFromJson(chainData);
          
          if (newChainId) {
            // 새 체인 활성화
            setActiveChainId(newChainId);
            console.log(`[FlowChainList] Successfully imported chain: ${newChainId}`);
          } else {
            throw new Error('Flow Chain 가져오기에 실패했습니다.');
          }
        } catch (error) {
          console.error('Flow Chain 가져오기 오류:', error);
          alert('Flow Chain 파일을 처리하는 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : String(error)));
        }
      };
      
      reader.readAsText(file);
    };
    
    // 파일 선택기 클릭
    input.click();
  };

  const handleRemoveChain = (e: React.MouseEvent, chainId: string) => {
    e.stopPropagation(); // 상위 li의 onClick 이벤트 전파 방지
    if (window.confirm('Are you sure you want to delete this Flow Chain?')) {
      removeFlowChain(chainId);
    }
  };

  const handleRenameChain = (e: React.MouseEvent, chainId: string, currentName: string) => {
    e.stopPropagation();
    const newName = window.prompt('Enter new name for the Flow Chain:', currentName);
    if (newName && newName.trim() !== '' && newName !== currentName) {
      setFlowChainName(chainId, newName.trim());
    }
  };

  const handleChainSelect = (chainId: string) => {
    console.log('[FlowChainList] handleChainSelect called with chainId:', chainId);
    setActiveChainId(chainId);
    // 스토어 상태 변경 후 즉시 확인 (디버깅용)
    setTimeout(() => {
      const currentActive = useExecutorStateStore.getState().flowExecutorStore.activeChainId;
      console.log('[FlowChainList] activeChainId in store after setActiveChainId:', currentActive);
    }, 0);
  };

  return (
    <div className="w-full h-full flex flex-col bg-white rounded-lg shadow">
      <div className="p-3 border-b border-gray-200 flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-700">Flow Chains</h2>
        <div className="flex gap-2">
          <button
            onClick={handleImportChain}
            className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-md text-sm font-medium flex items-center transition-colors duration-150"
            title="Import Flow Chain"
          >
            <ArrowDownTrayIcon size={18} className="mr-1.5" />
            Import
          </button>
          <button
            onClick={handleAddChain}
            className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm font-medium flex items-center transition-colors duration-150"
            title="Add new Flow Chain"
          >
            <PlusIcon size={18} className="mr-1.5" />
            Add Chain
          </button>
        </div>
      </div>
      
      {flowExecutorStore.chainIds.length === 0 ? (
        <div className="flex-grow flex items-center justify-center">
          <p className="text-gray-500">No Flow Chains created yet.</p>
        </div>
      ) : (
        <ul className="flex-grow overflow-y-auto divide-y divide-gray-200">
          {flowExecutorStore.chainIds.map((chainId) => {
            const chain = flowExecutorStore.flowChainMap[chainId];
            if (!chain) return null; // Should not happen if data is consistent
            return (
              <li
                key={chainId}
                onClick={() => handleChainSelect(chainId)}
                className={`p-3 flex items-center cursor-pointer hover:bg-gray-50 transition-colors duration-150 ${
                  activeChainId === chainId ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                }`}
              >
                <NodeStatusIndicator status={chain.status} size="small" className="mr-2 flex-shrink-0" />
                <div className="flex-grow min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate" title={chain.name}>{chain.name}</p>
                  <p className="text-xs text-gray-500">{`${chain.flowIds.length} flow${chain.flowIds.length === 1 ? '' : 's'}`}</p>
                </div>
                <div className="ml-2 flex-shrink-0 space-x-1">
                  <button
                    onClick={(e) => handleRenameChain(e, chainId, chain.name)}
                    className="p-1.5 text-gray-500 hover:text-blue-600 rounded-md transition-colors duration-150"
                    title="Rename Flow Chain"
                  >
                    <PenLineIcon size={16} />
                  </button>
                  <button
                    onClick={(e) => handleRemoveChain(e, chainId)}
                    className="p-1.5 text-gray-500 hover:text-red-600 rounded-md transition-colors duration-150"
                    title="Delete Flow Chain"
                  >
                    <TrashIcon size={16} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};