import React, { useState } from 'react';
import { useFlowExecutorStore } from '../../store/useFlowExecutorStore';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';

interface FlowChainListViewProps {
  onChainSelect: (chainId: string) => void;
}

const FlowChainListView: React.FC<FlowChainListViewProps> = ({ onChainSelect }) => {
  const [newChainName, setNewChainName] = useState<string>('');
  const store = useFlowExecutorStore();
  const flowChainMap = store.flowChainMap;
  const flowChainIds = store.flowChainIds;
  const focusedFlowChainId = store.focusedFlowChainId;

  const handleAddChain = () => {
    const name = newChainName.trim() || `새 Flow 체인 ${flowChainIds.length + 1}`;
    const newChainId = store.addChain(name);
    setNewChainName('');
    if (newChainId) {
      onChainSelect(newChainId);
      store.setFocusedFlowChainId(newChainId);
    }
  };

  const handleRemoveChain = (e: React.MouseEvent, chainId: string) => {
    e.stopPropagation();
    if (window.confirm('이 Flow 체인을 삭제하시겠습니까? 체인 내의 모든 Flow 데이터가 삭제됩니다.')) {
      store.removeChain(chainId);
    }
  };

  const handleChainClick = (chainId: string) => {
    onChainSelect(chainId);
    store.setFocusedFlowChainId(chainId);
  };

  const handleImportChain = () => {
    // Implementation for importing a chain
  };

  const handleExportChain = () => {
    // Implementation for exporting a chain
  };

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
        <h2 className="text-lg font-medium text-gray-700">Flow 체인 목록</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleImportChain}
            className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm font-medium flex items-center transition-colors duration-150"
          >
            <svg className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            Import
          </button>
          <button
            onClick={handleExportChain}
            className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-md text-sm font-medium flex items-center transition-colors duration-150"
          >
            <ArrowDownTrayIcon className="h-5 w-5 mr-1.5" />
            Export
          </button>
        </div>
        <div className="text-sm text-gray-500 ml-4">
          {flowChainIds.length}개의 체인
        </div>
      </div>

      <div className="p-4">
        {/* 새 체인 추가 */}
        <div className="mb-4 flex">
          <input
            type="text"
            value={newChainName}
            onChange={(e) => setNewChainName(e.target.value)}
            placeholder="새 체인 이름"
            className="flex-1 border border-gray-300 rounded-l px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          />
          <button
            onClick={handleAddChain}
            className="bg-indigo-600 text-white rounded-r px-4 py-2 text-sm hover:bg-indigo-700"
          >
            체인 추가
          </button>
        </div>

        {/* 체인 목록 */}
        {flowChainIds.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>등록된 Flow 체인이 없습니다.</p>
            <p className="text-sm mt-2">위의 "체인 추가" 버튼을 클릭하여 새 체인을 만드세요.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
            {flowChainIds.map((chainId: string) => {
              const chain = flowChainMap[chainId];
              if (!chain) return null;

              return (
                <div
                  key={chainId}
                  className={`border rounded p-3 ${
                    focusedFlowChainId === chainId ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50'
                  } cursor-pointer transition-colors`}
                  onClick={() => handleChainClick(chainId)}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">{chain.name}</span>
                      <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                        chain.status === 'idle' ? 'bg-gray-100 text-gray-600' :
                        chain.status === 'running' ? 'bg-blue-100 text-blue-600' :
                        chain.status === 'success' ? 'bg-green-100 text-green-600' :
                        'bg-red-100 text-red-600'
                      }`}>
                        {chain.status === 'idle' ? '준비' :
                         chain.status === 'running' ? '실행 중' :
                         chain.status === 'success' ? '완료' : '오류'}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={(e) => handleRemoveChain(e, chainId)}
                        className="p-1 rounded-full hover:bg-red-100 hover:text-red-500"
                        title="체인 삭제"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  {/* Flow 통계 정보 */}
                  <div className="mt-2 flex text-xs text-gray-500">
                    <div className="mr-3">
                      <span className="font-medium">Flow 수:</span> {chain.flowIds.length}
                    </div>
                    {chain.selectedFlowId && (
                      <div>
                        <span className="font-medium">선택된 Flow:</span> {chain.flowMap[chain.selectedFlowId]?.name || '없음'}
                      </div>
                    )}
                    {chain.status === 'error' && chain.error && (
                      <div className="ml-auto text-red-500">
                        <span className="font-medium">오류:</span> {chain.error}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default FlowChainListView; 