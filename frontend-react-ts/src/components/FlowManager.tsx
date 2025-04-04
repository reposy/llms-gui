import React, { useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { setNodes, setEdges } from '../store/flowSlice';
import { Node, Edge } from 'reactflow';
import { NodeData } from '../types/nodes';
import { cloneDeep } from 'lodash';

interface FlowData {
  name: string;
  createdAt: string;
  nodes: Node<NodeData>[];
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
  const nodesFromState = useSelector((state: RootState) => state.flow.nodes);
  const edgesFromState = useSelector((state: RootState) => state.flow.edges);
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
      nodes: nodesFromState,
      edges: edgesFromState,
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

        const importedNodes: Node<NodeData>[] = flowData.nodes.map(node => {
          const importedNode = cloneDeep(node);
          
          if (importedNode.type === 'group' && !importedNode.dragHandle) {
              console.warn(`[Import] Adding missing dragHandle to group node ${importedNode.id}`);
              importedNode.dragHandle = '.group-node-header';
          }
          
          return importedNode; 
        });

        const importedEdges: Edge[] = flowData.edges.map(edge => ({
          ...cloneDeep(edge)
        }));

        dispatch(setNodes(importedNodes));
        dispatch(setEdges(importedEdges));
        console.log('Imported nodes:', importedNodes);
        console.log('Imported edges:', importedEdges);

      } catch (error) {
        console.error('Error importing flow:', error);
        alert('플로우 파일을 불러오는 중 오류가 발생했습니다.');
      }
    };
    reader.readAsText(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="absolute top-2 right-2 z-10 flex space-x-2">
      <button 
        onClick={createNewFlow}
        className="px-3 py-1 bg-white border border-gray-300 rounded shadow-sm text-sm hover:bg-gray-50"
      >
        + 새 플로우
      </button>
      <button 
        onClick={exportFlow}
        className="px-3 py-1 bg-white border border-gray-300 rounded shadow-sm text-sm hover:bg-gray-50"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline-block mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        플로우 저장
      </button>
      <label 
        htmlFor="import-flow-input"
        className="cursor-pointer px-3 py-1 bg-white border border-gray-300 rounded shadow-sm text-sm hover:bg-gray-50"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline-block mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        플로우 불러오기
      </label>
      <input
        id="import-flow-input"
        type="file"
        accept=".json,application/json"
        onChange={importFlow}
        ref={fileInputRef}
        className="hidden"
      />
    </div>
  );
}; 