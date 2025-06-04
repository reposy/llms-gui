import React, { useRef, useState } from 'react';
import { useFlowExecutorStore, type FlowChain } from '../../store/useFlowExecutorStore';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { TrashIcon } from '@heroicons/react/20/solid';
import { PlayIcon, PenLineIcon } from '../Icons';
import { executeChain } from '../../services/flowExecutionService';
import InlineEditInput from '../ui/InlineEditInput';

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
  const [editingChainId, setEditingChainId] = useState<string | null>(null);

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
    
    // 새로운 export 형식으로 데이터 구성
    const exportData = {
      version: '1.2',
      timestamp: new Date().toISOString(),
      flowChains: [{
        id: flowChain.id,
        name: flowChain.name,
        status: flowChain.status,
        flowIds: flowChain.flowIds,
        selectedFlowIds: flowChain.selectedFlowIds || [],
        flowMap: flowChain.flowMap, // lastResults 포함된 전체 flow 데이터
        ...(flowChain.inputs && { inputs: flowChain.inputs }),
        ...(flowChain.error && { error: flowChain.error })
      }]
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
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
        
        // 새로운 형식 (v1.2) 처리
        if (json.version === '1.2' && Array.isArray(json.flowChains)) {
          console.log(`[FlowChainListView] 새로운 형식 (v${json.version}) 파일 가져오기`);
          
          json.flowChains.forEach((chainData: any) => {
            try {
              // ID 중복 확인 및 처리
              let newId = chainData.id || `flowChain-${Date.now()}`;
              if (flowChainMap[newId]) {
                newId = `${chainData.id}-copy-${Date.now()}`;
              }
              
              // 이름 중복 확인 및 처리
              let newName = chainData.name || '가져온 체인';
              if (Object.values(flowChainMap).some(c => c.name === newName)) {
                newName = `${chainData.name} (복사본)`;
              }
              
              // FlowChain 생성
              const newFlowChain: FlowChain = {
                id: newId,
                name: newName,
                status: 'idle', // 가져온 후엔 idle 상태로 초기화
                selectedFlowIds: chainData.selectedFlowIds || [],
                flowIds: chainData.flowIds || [],
                flowMap: {},
                inputs: chainData.inputs || []
              };
              
              // Flow 데이터 처리
              if (chainData.flowMap && typeof chainData.flowMap === 'object') {
                Object.keys(chainData.flowMap).forEach(flowId => {
                  const flowData = chainData.flowMap[flowId];
                  if (flowData && flowData.flowJson) {
                    newFlowChain.flowMap[flowId] = {
                      id: flowData.id || flowId,
                      flowChainId: newId,
                      name: flowData.name || '가져온 Flow',
                      flowJson: flowData.flowJson,
                      inputs: flowData.inputs || [],
                      lastResults: flowData.lastResults || null, // 실행 결과 포함
                      status: 'idle', // 가져온 후엔 idle 상태로 초기화
                      error: flowData.error,
                      nodeMap: {},
                      graphMap: {},
                      nodeInstances: {},
                      rootIds: [],
                      leafIds: [],
                      nodeStates: {}
                    };
                  }
                });
              }
              
              // Store에 추가
              setStore(state => ({
                flowChainMap: { ...state.flowChainMap, [newId]: newFlowChain },
                flowChainIds: [...state.flowChainIds, newId],
                focusedFlowChainId: newId
              }));
              
              // 새로 추가된 체인 선택
              onFlowChainSelect(newId);
              
            } catch (chainError) {
              console.error(`[FlowChainListView] FlowChain 가져오기 실패:`, chainError);
            }
          });
          
          alert('Flow Chain이 성공적으로 가져왔습니다.');
          return;
        }
        
        // 기존 형식 처리 (단일 FlowChain 객체)
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

  function validateChainName(newName: string, currentId: string) {
    if (!newName.trim()) return '이름을 입력하세요.';
    if (Object.values(flowChainMap).some(c => c.id !== currentId && c.name === newName.trim())) return '이미 존재하는 이름입니다.';
    return null;
  }

  function handleSaveChainName(chainId: string, newName: string) {
    store.setFlowChainName(chainId, newName);
    setEditingChainId(null);
  }

  function handleCancelEdit() {
    setEditingChainId(null);
  }

  // 상태 표시기 렌더링 함수
  const renderStatusIndicator = (status: string) => {
    switch (status) {
      case 'idle':
        return (
          <div className="flex items-center gap-1 text-gray-500">
            <div className="w-2 h-2 rounded-full bg-gray-400"></div>
            <span className="text-xs">대기</span>
          </div>
        );
      case 'running':
        return (
          <div className="flex items-center gap-1 text-blue-600">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
            <span className="text-xs">실행중</span>
          </div>
        );
      case 'success':
        return (
          <div className="flex items-center gap-1 text-green-600">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span className="text-xs">완료</span>
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center gap-1 text-red-600">
            <div className="w-2 h-2 rounded-full bg-red-500"></div>
            <span className="text-xs">오류</span>
          </div>
        );
      default:
        return null;
    }
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
                    <div className="flex items-center gap-2">
                      {renderStatusIndicator(flowChain.status)}
                      <span className="flex items-center gap-1">
                        {editingChainId === flowChainId ? (
                          <InlineEditInput
                            value={flowChain.name}
                            onSave={newName => handleSaveChainName(flowChainId, newName)}
                            onCancel={handleCancelEdit}
                            validate={v => validateChainName(v, flowChainId)}
                          />
                        ) : (
                          <>
                            <span
                              className="font-medium cursor-pointer"
                              onClick={e => { e.stopPropagation(); setEditingChainId(flowChainId); }}
                              tabIndex={0}
                              aria-label="체인 이름 편집"
                            >
                              {flowChain.name}
                            </span>
                            <button
                              className="ml-1 p-1 rounded hover:bg-gray-100"
                              onClick={e => { e.stopPropagation(); setEditingChainId(flowChainId); }}
                              title="이름 편집"
                              tabIndex={0}
                            >
                              <PenLineIcon size={16} />
                            </button>
                          </>
                        )}
                      </span>
                    </div>
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
                    {flowChain.selectedFlowIds.length > 0 && (
                      <div>
                        <span className="font-medium">선택된 Flow:</span> {flowChain.flowMap[flowChain.selectedFlowIds[0]]?.name || '없음'}
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