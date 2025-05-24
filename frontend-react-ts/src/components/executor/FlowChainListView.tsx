import React, { useRef, useState } from 'react';
import { useFlowExecutorStore } from '../../store/useFlowExecutorStore';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { TrashIcon } from '@heroicons/react/20/solid';
import { PlayIcon } from '../Icons';
import { executeChain } from '../../services/flowExecutionService';

interface FlowChainListViewProps {
  onFlowChainSelect: (flowChainId: string) => void;
}

const FlowChainListView: React.FC<FlowChainListViewProps> = ({ onFlowChainSelect }) => {
  const [newFlowChainName, setNewFlowChainName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const store = useFlowExecutorStore();
  const flowChainMap = store.flowChainMap;
  const flowChainIds = store.flowChainIds;
  const focusedFlowChainId = store.focusedFlowChainId;
  const setStore = useFlowExecutorStore.setState;

  const handleAddFlowChain = () => {
    const name = newFlowChainName.trim() || `새 Flow 체인 ${flowChainIds.length + 1}`;
    const newFlowChainId = store.addFlowChain(name);
    setNewFlowChainName('');
    if (newFlowChainId) {
      onFlowChainSelect(newFlowChainId);
      store.setFocusedFlowChainId(newFlowChainId);
    }
  };

  const handleRemoveFlowChain = (e: React.MouseEvent, flowChainId: string) => {
    e.stopPropagation();
    if (window.confirm('이 Flow 체인을 삭제하시겠습니까? 체인 내의 모든 Flow 데이터가 삭제됩니다.')) {
      store.removeFlowChain(flowChainId);
    }
  };

  const handleFlowChainClick = (flowChainId: string) => {
    onFlowChainSelect(flowChainId);
    store.setFocusedFlowChainId(flowChainId);
  };

  const handleExportFlowChain = () => {
    if (!focusedFlowChainId) {
      alert('내보낼 체인을 먼저 선택하세요.');
      return;
    }
    const flowChain = flowChainMap[focusedFlowChainId];
    if (!flowChain) {
      alert('선택된 체인 정보를 찾을 수 없습니다.');
      return;
    }
    const dataStr = JSON.stringify(flowChain, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${flowChain.name || 'flow-chain'}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
  };

  const handleImportFlowChain = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (!json.id || !json.name || !Array.isArray(json.flowIds) || typeof json.flowMap !== 'object') {
          alert('유효하지 않은 Flow Chain 데이터입니다.');
          return;
        }
        let newId = json.id;
        if (flowChainMap[newId]) {
          newId = `${json.id}-copy-${Date.now()}`;
        }
        let newName = json.name;
        if (Object.values(flowChainMap).some(c => c.name === newName)) {
          newName = `${json.name} (복사본)`;
        }
        const newFlowChain = { ...json, id: newId, name: newName };
        setStore(state => ({
          flowChainMap: { ...state.flowChainMap, [newId]: newFlowChain },
          flowChainIds: [...state.flowChainIds, newId],
          focusedFlowChainId: newId
        }));
        onFlowChainSelect(newId);
        alert('Flow Chain이 성공적으로 import되었습니다.');
      } catch (err) {
        alert('Flow Chain import 중 오류 발생: ' + (err instanceof Error ? err.message : String(err)));
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
        <h2 className="text-lg font-medium text-gray-700">Flow 체인 목록</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleImportFlowChain}
            className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm font-medium flex items-center transition-colors duration-150"
          >
            <svg className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            Import
          </button>
          <input
            type="file"
            ref={fileInputRef}
            accept="application/json"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            onClick={handleExportFlowChain}
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
        <div className="mb-4 flex">
          <input
            type="text"
            value={newFlowChainName}
            onChange={(e) => setNewFlowChainName(e.target.value)}
            placeholder="새 체인 이름"
            className="flex-1 border border-gray-300 rounded-l px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          />
          <button
            onClick={handleAddFlowChain}
            className="bg-indigo-600 text-white rounded-r px-4 py-2 text-sm hover:bg-indigo-700"
          >
            체인 추가
          </button>
        </div>

        {flowChainIds.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>등록된 Flow 체인이 없습니다.</p>
            <p className="text-sm mt-2">위의 "체인 추가" 버튼을 클릭하여 새 체인을 만드세요.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
            {flowChainIds.map((flowChainId: string) => {
              const flowChain = flowChainMap[flowChainId];
              if (!flowChain) return null;

              return (
                <div
                  key={flowChainId}
                  className={`border rounded p-3 ${
                    focusedFlowChainId === flowChainId ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50'
                  } cursor-pointer transition-colors`}
                  onClick={() => handleFlowChainClick(flowChainId)}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{flowChain.name}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={async e => {
                          e.stopPropagation();
                          if (flowChain.status === 'running') return;
                          await executeChain({ flowChainId: flowChainId });
                        }}
                        className={`p-1 rounded-full hover:bg-green-100 hover:text-green-600 transition-colors ${flowChain.status === 'running' ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title="체인 실행"
                        disabled={flowChain.status === 'running'}
                      >
                        <PlayIcon size={18} />
                      </button>
                      <button
                        onClick={e => handleRemoveFlowChain(e, flowChainId)}
                        className="p-1 rounded-full hover:bg-red-100 hover:text-red-500"
                        title="체인 삭제"
                      >
                        <TrashIcon className="h-4 w-4 text-gray-600" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 flex text-xs text-gray-500">
                    <div className="mr-3">
                      <span className="font-medium">Flow 수:</span> {flowChain.flowIds.length}
                    </div>
                    {flowChain.selectedFlowId && (
                      <div>
                        <span className="font-medium">선택된 Flow:</span> {flowChain.flowMap[flowChain.selectedFlowId]?.name || '없음'}
                      </div>
                    )}
                    {flowChain.status === 'error' && flowChain.error && (
                      <div className="ml-auto text-red-500">
                        <span className="font-medium">오류:</span> {flowChain.error}
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