import React, { useRef, useEffect } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { FlowCanvasApi } from './FlowCanvas';
import { resetAllContent } from '../store/useNodeContentStore';
import { useNodes, useEdges, setNodes, setEdges, useFlowStructureStore } from '../store/useFlowStructureStore';
import { importFlowFromJson, exportFlowAsJson, FlowData } from '../utils/data/importExportUtils';
import { useDirtyTracker, useMarkClean } from '../store/useDirtyTracker';
import { undo, redo, useCanUndo, useCanRedo } from '../store/useHistoryStore';
import { pushCurrentSnapshot } from '../utils/ui/historyUtils';
import { createIDBStorage } from '../utils/storage/idbStorage';

interface FlowManagerProps {
  flowApi: React.MutableRefObject<FlowCanvasApi | null>;
}

export const FlowManager: React.FC<FlowManagerProps> = ({ flowApi }) => {
  const nodesFromState = useNodes();
  const edgesFromState = useEdges();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Access dirty tracking
  const { isDirty } = useDirtyTracker();
  const markClean = useMarkClean();
  
  // Access undo/redo capability
  const canUndo = useCanUndo();
  const canRedo = useCanRedo();

  // Removed initial snapshot logic here, handled in FlowEditor now
  useEffect(() => {
    // No initial snapshot logic needed here
  }, []); 

  const createNewFlow = () => {
    const confirmMessage = isDirty 
      ? '현재 플로우가 저장되지 않았습니다. 정말로 새 플로우를 만드시겠습니까?' 
      : '현재 플로우를 지우고 새로 시작하시겠습니까?';
      
    if (window.confirm(confirmMessage)) {
      console.log('[FlowManager] Creating new flow - starting clear process');
      
      try {
        // 1. Enable force clearing flag FIRST
        if ((window as any).flowSyncUtils) {
          (window as any).flowSyncUtils.enableForceClear(true);
          console.log('[FlowManager] Step 1: Force clearing enabled');
        }
        
        // 2. Reset node contents
        resetAllContent();
        console.log('[FlowManager] Step 2: Reset all node contents');
        
        // 3. Clear Zustand store
        console.log('[FlowManager] Step 3: Clearing Zustand store (setNodes/setEdges)');
        const currentState = useFlowStructureStore.getState();
        setNodes([...currentState.nodes]);
        setEdges([...currentState.edges]);
        
        console.log('[FlowManager] Step 4: Manual IndexedDB clear removed. Relying on Zustand persist.');
        
        // 5. Directly clear React Flow's internal state using the new API function
        if (flowApi.current?.forceClearLocalState) {
          flowApi.current.forceClearLocalState();
          console.log('[FlowManager] Step 5: Directly cleared React Flow local state via API');
        } else {
          console.warn('[FlowManager] Warning: flowApi.current.forceClearLocalState is not available.');
          // forceSync 호출 제거
          // 대신 직접 상태 업데이트
          const currentState = useFlowStructureStore.getState();
          setNodes([...currentState.nodes]); // 이미 빈 배열일 것이므로 불필요할 수 있지만, 일관성을 위해 유지
          setEdges([...currentState.edges]);
        }
        
        // 6. Push empty state to history and mark clean
        pushCurrentSnapshot(); // Push the cleared state
        markClean();
        console.log('[FlowManager] Step 6: Pushed empty snapshot to history and marked clean');
        
        // 7. Disable force clearing AFTER all steps are done
        setTimeout(() => {
          if ((window as any).flowSyncUtils) {
            (window as any).flowSyncUtils.enableForceClear(false);
            console.log('[FlowManager] Step 7: Force clearing disabled. New flow creation complete.');
          }
        }, 0); 

      } catch (err) {
        console.error('[FlowManager] Error creating new flow:', err);
        if ((window as any).flowSyncUtils) {
          (window as any).flowSyncUtils.enableForceClear(false);
        }
      }
    }
  };

  // Generalized export function called by both buttons
  const handleExport = (includeData: boolean) => {
    const flowData = exportFlowAsJson(includeData);
    const blob = new Blob([JSON.stringify(flowData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const filename = includeData ? `flow-with-data-${Date.now()}.json` : `flow-${Date.now()}.json`;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    markClean();
  };

  const importFlow = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        if (isDirty && !window.confirm('현재 플로우가 저장되지 않았습니다. 계속 진행하시겠습니까?')) {
          return;
        }
        const flowData: FlowData = JSON.parse(e.target?.result as string);
        importFlowFromJson(flowData);
        
        setTimeout(() => {
          console.log('[FlowManager] Import complete, updating store state');
          // forceSync 호출 제거
          
          const currentState = useFlowStructureStore.getState(); // Get state *after* import
          const stateToSave = {
            state: {
              nodes: currentState.nodes,
              edges: currentState.edges,
              selectedNodeIds: currentState.selectedNodeIds // Persist selected IDs as well
            }
            // version field is managed internally by zustand persist, remove manual handling
          };
          const idbStorage = createIDBStorage();
          // Persist the state object by stringifying it for idbStorage
          idbStorage.setItem('flow-structure-storage', JSON.stringify(stateToSave)); 
          console.log(`[FlowManager] Saved imported flow to indexedDB`);
          
          pushCurrentSnapshot();
          markClean();
        }, 100);

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
  
  // Undo/Redo hotkeys
  useHotkeys('ctrl+z, cmd+z', (event: KeyboardEvent) => {
    event.preventDefault();
    if (canUndo) {
      console.log("[FlowManager] Undo triggered");
      undo();
      // forceSync 호출 제거
      // 대신 Zustand 상태 업데이트 시점에 내부적으로 처리됨
    }
  }, { enableOnFormTags: false }, [canUndo, flowApi]);
  
  useHotkeys('ctrl+shift+z, cmd+shift+z', (event: KeyboardEvent) => {
    event.preventDefault();
    if (canRedo) {
      console.log("[FlowManager] Redo triggered");
      redo();
      // forceSync 호출 제거
      // 대신 Zustand 상태 업데이트 시점에 내부적으로 처리됨
    }
  }, { enableOnFormTags: false }, [canRedo, flowApi]);

  // Original Force Sync hotkey
  useHotkeys('ctrl+shift+s, cmd+shift+s', (event: KeyboardEvent) => {
    event.preventDefault();
    console.log("[FlowManager] Force Sync hotkey triggered");
    // forceSync 호출 제거
    // 대신 필요한 경우 상태 업데이트
    const currentState = useFlowStructureStore.getState();
    setNodes([...currentState.nodes]);
    setEdges([...currentState.edges]);
  }, { enableOnFormTags: false }, [flowApi]);

  return (
    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 flex space-x-2 items-center">
      <button 
        onClick={createNewFlow}
        className="px-3 py-1 bg-white border border-gray-300 rounded shadow-sm text-sm hover:bg-gray-50 flex items-center"
      >
        <span className="mr-1">+</span> 새 플로우
      </button>
      <button 
        onClick={() => handleExport(false)}
        className={`px-3 py-1 bg-white border ${isDirty ? 'border-yellow-400' : 'border-gray-300'} rounded shadow-sm text-sm hover:bg-gray-50 flex items-center`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        {isDirty ? '플로우 저장*' : '플로우 저장'}
      </button>
      <button 
        onClick={() => handleExport(true)}
        className={`px-3 py-1 bg-white border ${isDirty ? 'border-yellow-400' : 'border-gray-300'} rounded shadow-sm text-sm hover:bg-gray-50 flex items-center`}
        title="플로우 구조, 설정 및 마지막 실행 결과를 함께 저장합니다."
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        {isDirty ? '결과 포함 저장*' : '결과 포함 저장'}
      </button>
      <label 
        htmlFor="import-flow-input"
        className="cursor-pointer px-3 py-1 bg-white border border-gray-300 rounded shadow-sm text-sm hover:bg-gray-50 flex items-center"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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