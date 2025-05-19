import React, { useState } from 'react';
import { useFlowExecutorStore } from '../../store/useFlowExecutorStore';
import { Button } from '../ui/button';
import { PlusIcon, TrashIcon, PenLineIcon } from '../Icons';

export const FlowChainList: React.FC = () => {
  // 상태
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [newChainName, setNewChainName] = useState('');
  const [editingChainId, setEditingChainId] = useState<string | null>(null);
  const [editChainName, setEditChainName] = useState('');

  // 스토어에서 필요한 상태 및 액션 가져오기
  const {
    chains,
    activeChainId,
    addChain,
    removeChain,
    setChainName,
    setActiveChain
  } = useFlowExecutorStore(state => ({
    chains: state.chains,
    activeChainId: state.activeChainId,
    addChain: state.addChain,
    removeChain: state.removeChain,
    setChainName: state.setChainName,
    setActiveChain: state.setActiveChain
  }));

  // 체인 생성 처리
  const handleCreateChain = () => {
    if (newChainName.trim()) {
      const chainId = addChain(newChainName.trim());
      setActiveChain(chainId);
      setNewChainName('');
      setCreateDialogOpen(false);
    }
  };

  // 체인 수정 처리
  const handleEditChain = () => {
    if (editingChainId && editChainName.trim()) {
      setChainName(editingChainId, editChainName.trim());
      setEditingChainId(null);
      setEditChainName('');
      setEditDialogOpen(false);
    }
  };

  // 체인 삭제 처리
  const handleDeleteChain = (chainId: string) => {
    if (window.confirm('정말 이 체인을 삭제하시겠습니까?')) {
      removeChain(chainId);
    }
  };

  // 체인 선택 처리
  const handleSelectChain = (chainId: string) => {
    setActiveChain(chainId);
  };

  // 체인 편집 모달 열기
  const openEditDialog = (chainId: string, name: string) => {
    setEditingChainId(chainId);
    setEditChainName(name);
    setEditDialogOpen(true);
  };

  // 체인 목록 정렬
  const chainList = Object.values(chains).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="h-full flex flex-col">
      {/* 헤더 */}
      <div className="flex justify-between items-center p-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold">Flow Chains</h2>
        <Button 
          variant="primary" 
          className="flex items-center"
          onClick={() => setCreateDialogOpen(true)}
        >
          <PlusIcon size={18} className="mr-2" />
          New Chain
        </Button>
      </div>

      {/* 체인 목록 */}
      <div className="flex-grow overflow-auto">
        {chainList.length === 0 ? (
          <div className="p-4">
            <p className="font-medium">체인이 없습니다</p>
            <p className="text-sm text-gray-500">새 체인을 생성하여 시작하세요</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {chainList.map(chain => (
              <li
                key={chain.id}
                className={`p-4 hover:bg-gray-50 cursor-pointer ${chain.id === activeChainId ? 'bg-blue-50' : ''}`}
                onClick={() => handleSelectChain(chain.id)}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium">{chain.name}</div>
                    <div className="text-sm text-gray-500">
                      {`${chain.flowIds.length} flows | Status: ${chain.status}`}
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      className="p-1 rounded hover:bg-gray-200"
                      onClick={e => {
                        e.stopPropagation();
                        openEditDialog(chain.id, chain.name);
                      }}
                    >
                      <PenLineIcon size={20} className="text-gray-600" />
                    </button>
                    <button
                      className="p-1 rounded hover:bg-gray-200"
                      onClick={e => {
                        e.stopPropagation();
                        handleDeleteChain(chain.id);
                      }}
                    >
                      <TrashIcon size={20} className="text-gray-600" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 체인 생성 다이얼로그 */}
      {createDialogOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-medium">새 Flow Chain 생성</h3>
            </div>
            <div className="p-4">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">체인 이름</label>
                <input
                  type="text"
                  className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={newChainName}
                  onChange={e => setNewChainName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleCreateChain();
                  }}
                  autoFocus
                />
              </div>
            </div>
            <div className="p-4 bg-gray-50 flex justify-end space-x-2">
              <Button 
                variant="outline" 
                onClick={() => setCreateDialogOpen(false)}
              >
                취소
              </Button>
              <Button 
                variant="primary" 
                onClick={handleCreateChain}
              >
                생성
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 체인 편집 다이얼로그 */}
      {editDialogOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-medium">Flow Chain 편집</h3>
            </div>
            <div className="p-4">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">체인 이름</label>
                <input
                  type="text"
                  className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={editChainName}
                  onChange={e => setEditChainName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleEditChain();
                  }}
                  autoFocus
                />
              </div>
            </div>
            <div className="p-4 bg-gray-50 flex justify-end space-x-2">
              <Button 
                variant="outline" 
                onClick={() => setEditDialogOpen(false)}
              >
                취소
              </Button>
              <Button 
                variant="primary" 
                onClick={handleEditChain}
              >
                저장
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};