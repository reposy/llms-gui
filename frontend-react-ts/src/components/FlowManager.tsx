import React, { useRef, useEffect } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { FlowCanvasApi } from './FlowCanvas';
import { resetAllContent, getAllNodeContents } from '../store/useNodeContentStore';
import { useNodes, useEdges, setNodes, setEdges } from '../store/useFlowStructureStore';
import { importFlowFromJson, exportFlowAsJson, FlowData } from '../utils/importExportUtils';
import { useDirtyTracker, useMarkClean } from '../store/useDirtyTracker';
import { undo, redo, useCanUndo, useCanRedo } from '../store/useHistoryStore';
import { pushCurrentSnapshot } from '../utils/historyUtils';
import { createIDBStorage } from '../utils/idbStorage';
import { useFlowStructureStore } from '../store/useFlowStructureStore';

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
        if (window.flowSyncUtils) {
          window.flowSyncUtils.enableForceClear(true);
          console.log('[FlowManager] Step 1: Force clearing enabled');
        }
        
        // 2. Reset node contents
        resetAllContent();
        console.log('[FlowManager] Step 2: Reset all node contents');
        
        // 3. Clear Zustand store
        console.log('[FlowManager] Step 3: Clearing Zustand store (setNodes/setEdges)');
        setNodes([]);
        setEdges([]);
        
        // Step 4 Removed: Manual IndexedDB clear. Zustand persist middleware will handle saving the empty state triggered by setNodes/setEdges.
        // const idbStorage = createIDBStorage();
        // const emptyState = {
        //   state: { nodes: [], edges: [], selectedNodeId: null }, // Include selectedNodeId
        //   version: 0
        // };
        // idbStorage.setItem('flow-structure-storage', JSON.stringify(emptyState));
        // console.log('[FlowManager] Step 4: Cleared indexedDB storage with stringified empty state');
        console.log('[FlowManager] Step 4: Manual IndexedDB clear removed. Relying on Zustand persist.');
        
        // 5. Directly clear React Flow's internal state using the new API function
        if (flowApi.current?.forceClearLocalState) {
          flowApi.current.forceClearLocalState();
          console.log('[FlowManager] Step 5: Directly cleared React Flow local state via API');
        } else {
           console.warn('[FlowManager] Warning: flowApi.current.forceClearLocalState is not available.');
           // Fallback: Try to trigger sync (less reliable)
           flowApi.current?.forceSync?.();
        }
        
        // 6. Push empty state to history and mark clean
        pushCurrentSnapshot(); // Push the cleared state
        markClean();
        console.log('[FlowManager] Step 6: Pushed empty snapshot to history and marked clean');
        
        // 7. Disable force clearing AFTER all steps are done
        // Use setTimeout to ensure it runs after the current execution context
        setTimeout(() => {
          if (window.flowSyncUtils) {
            window.flowSyncUtils.enableForceClear(false);
            console.log('[FlowManager] Step 7: Force clearing disabled. New flow creation complete.');
          }
        }, 0); 

      } catch (err) {
        console.error('[FlowManager] Error creating new flow:', err);
        // Ensure flag is disabled even on error
        if (window.flowSyncUtils) {
          window.flowSyncUtils.enableForceClear(false);
        }
      }
    }
  };

  const exportFlow = () => {
    // Use the utility function to get the flow data
    const flowData = exportFlowAsJson();

    const blob = new Blob([JSON.stringify(flowData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flow-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Mark as clean after saving
    markClean();
  };

  const importFlow = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        // Check if current flow is dirty and confirm before proceeding
        if (isDirty && !window.confirm('현재 플로우가 저장되지 않았습니다. 계속 진행하시겠습니까?')) {
          return;
        }
        
        // Parse the JSON data from the file
        const flowData: FlowData = JSON.parse(e.target?.result as string);
        
        // Use the utility function to import the flow data into Zustand
        importFlowFromJson(flowData);
        
        // Force UI sync after import with a small delay to ensure React Flow has updated
        setTimeout(() => {
          console.log('[FlowManager] Forcing sync after import');
          if (flowApi.current) {
            flowApi.current.forceSync();
          }
          
          // Save the newly imported state (read from Zustand) to IndexedDB - Stringify the value
          const currentState = useFlowStructureStore.getState();
          const stateToSave = {
            state: {
              nodes: currentState.nodes,
              edges: currentState.edges,
              selectedNodeId: currentState.selectedNodeId
            },
            version: 0 // Or use a proper versioning mechanism if implemented
          };
          const idbStorage = createIDBStorage();
          idbStorage.setItem('flow-structure-storage', JSON.stringify(stateToSave));
          console.log(`[FlowManager] Saved imported flow to indexedDB (nodes: ${currentState.nodes.length}, edges: ${currentState.edges.length})`);
          
          // Take a snapshot of the imported flow
          pushCurrentSnapshot();
          
          // Mark as clean
          markClean();
        }, 100);

      } catch (error) {
        console.error('Error importing flow:', error);
        alert('플로우 파일을 불러오는 중 오류가 발생했습니다.');
      }
    };
    reader.readAsText(file);

    // Reset the file input so the same file can be imported again if needed
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
      flowApi.current?.forceSync();
    }
  }, { enableOnFormTags: false }, [canUndo, flowApi]);
  
  useHotkeys('ctrl+shift+z, cmd+shift+z', (event: KeyboardEvent) => {
    event.preventDefault();
    if (canRedo) {
      console.log("[FlowManager] Redo triggered");
      redo();
      flowApi.current?.forceSync();
    }
  }, { enableOnFormTags: false }, [canRedo, flowApi]);

  // Original Force Sync hotkey
  useHotkeys('ctrl+shift+s, cmd+shift+s', (event: KeyboardEvent) => {
    event.preventDefault();
    console.log("[FlowManager] Force Sync hotkey triggered");
    flowApi.current?.forceSync(); 
  }, { enableOnFormTags: false }, [flowApi]);

  return (
    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 flex space-x-2">
      <button 
        onClick={createNewFlow}
        className="px-3 py-1 bg-white border border-gray-300 rounded shadow-sm text-sm hover:bg-gray-50 flex items-center"
      >
        <span className="mr-1">+</span> 새 플로우
      </button>
      <button 
        onClick={exportFlow}
        className={`px-3 py-1 bg-white border ${isDirty ? 'border-yellow-400' : 'border-gray-300'} rounded shadow-sm text-sm hover:bg-gray-50 flex items-center`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        {isDirty ? '플로우 저장*' : '플로우 저장'}
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
      <button 
        onClick={() => {
          undo();
          flowApi.current?.forceSync();
        }}
        disabled={!canUndo}
        className="px-3 py-1 bg-white border border-gray-300 rounded shadow-sm text-sm hover:bg-gray-50 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
        </svg>
      </button>
      <button 
        onClick={() => {
          redo();
          flowApi.current?.forceSync();
        }}
        disabled={!canRedo}
        className="px-3 py-1 bg-white border border-gray-300 rounded shadow-sm text-sm hover:bg-gray-50 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14 10l6 6m0 0l-6 6m6-6H3" />
        </svg>
      </button>
    </div>
  );
}; 