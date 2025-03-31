import React, { useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { setNodes, setEdges } from '../store/flowSlice';
import { Node, Edge } from 'reactflow';

interface FlowData {
  name: string;
  createdAt: string;
  nodes: Node[];
  edges: Edge[];
  meta?: {
    llmDefaults?: {
      provider: string;
      url: string;
    };
  };
}

export const FlowManager: React.FC = () => {
  const dispatch = useDispatch();
  const nodes = useSelector((state: RootState) => state.flow.nodes);
  const edges = useSelector((state: RootState) => state.flow.edges);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createNewFlow = () => {
    if (window.confirm('현재 플로우를 지우고 새로 시작하시겠습니까?')) {
      dispatch(setNodes([]));
      dispatch(setEdges([]));
    }
  };

  const exportFlow = () => {
    const flowData: FlowData = {
      name: `Flow ${new Date().toLocaleString()}`,
      createdAt: new Date().toISOString(),
      nodes,
      edges,
      meta: {
        llmDefaults: {
          provider: 'ollama',
          url: 'http://localhost:11434'
        }
      }
    };

    const blob = new Blob([JSON.stringify(flowData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flow-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importFlow = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const flowData: FlowData = JSON.parse(e.target?.result as string);
        dispatch(setNodes(flowData.nodes));
        dispatch(setEdges(flowData.edges));
      } catch (error) {
        console.error('Error importing flow:', error);
        alert('플로우 파일을 불러오는 중 오류가 발생했습니다.');
      }
    };
    reader.readAsText(file);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="absolute top-4 right-4 z-50">
      <div className="bg-white rounded-lg shadow-lg p-2 space-y-2">
        <button
          onClick={createNewFlow}
          className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
        >
          <span>➕</span>
          <span>새 플로우</span>
        </button>
        
        <button
          onClick={exportFlow}
          className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
        >
          <span>💾</span>
          <span>플로우 저장</span>
        </button>
        
        <label className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md cursor-pointer">
          <span>📂</span>
          <span>플로우 불러오기</span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={importFlow}
            className="hidden"
          />
        </label>
      </div>
    </div>
  );
}; 