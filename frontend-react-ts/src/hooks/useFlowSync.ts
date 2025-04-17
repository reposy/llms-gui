import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { Node, Edge, useNodesState, useEdgesState, NodeChange, EdgeChange, applyNodeChanges, applyEdgeChanges } from 'reactflow';
import { NodeData } from '../types/nodes';
import { 
  useNodes, 
  useEdges, 
  setNodes as setZustandNodes, 
  setEdges as setZustandEdges,
  useFlowStructureStore
} from '../store/useFlowStructureStore';
import { isEqual } from 'lodash';

interface UseFlowSyncOptions {
  isRestoringHistory: React.MutableRefObject<boolean>;
}

interface UseFlowSyncReturn {
  localNodes: Node<NodeData>[];
  localEdges: Edge[];
  setLocalNodes: React.Dispatch<React.SetStateAction<Node<NodeData>[]>>;
  setLocalEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  onLocalNodesChange: (changes: NodeChange[]) => void;
  onLocalEdgesChange: (changes: EdgeChange[]) => void;
  forceSyncFromStore: () => void;
  commitStructureToStore: () => void;
  forceClearLocalState: () => void;
  flowResetKey: number;
}

// 전역 선언 추가
declare global {
  interface Window {
    flowSyncUtils: {
      enableForceClear: (enable: boolean) => void;
      isForceClearing: boolean;
    };
  }
}

// 글로벌 플래그 추가 (파일 상단)
// 노드를 완전히 초기화하는 중임을 나타내는 플래그
let isForceClearing = false;

// 전역 객체 초기화
if (typeof window !== 'undefined') {
  window.flowSyncUtils = {
    enableForceClear: (enable: boolean) => {
      isForceClearing = enable;
      window.flowSyncUtils.isForceClearing = enable;
      console.log(`[FlowSync] Force clearing ${enable ? 'enabled' : 'disabled'}`);
    },
    isForceClearing: false
  };
}

/**
 * 상태 동기화 방향을 명확히 정의
 * 1. Local to Store: 사용자 상호작용으로 React Flow 내부 상태가 변경될 때
 * 2. Store to Local: 외부 소스(히스토리, 붙여넣기 등)로 Zustand 스토어가 변경될 때
 */
export const useFlowSync = ({ 
  isRestoringHistory 
}: UseFlowSyncOptions): UseFlowSyncReturn => {
  // Zustand store state
  const zustandNodes = useNodes();
  const zustandEdges = useEdges();
  
  // React Flow internal state
  const [localNodes, setLocalNodes, onLocalNodesChangeInternal] = useNodesState([]);
  const [localEdges, setLocalEdges, onLocalEdgesChangeInternal] = useEdgesState([]);
  
  // Track sync status and prevent infinite loops
  const isFirstRender = useRef(true);
  const isStoreToLocalSyncInProgress = useRef(false);
  const flowResetKeyRef = useRef<number>(Date.now());
  const lastEmptyFlowTimestamp = useRef<number>(0);
  
  // For debugging only
  const syncLogCount = useRef(0);
  
  // localNodes가 비워졌을 때 store-to-local sync가 무한 반복되지 않도록 보호 플래그
  const hasJustSyncedFromStore = useRef(false);
  
  // New function to directly clear local state
  const forceClearLocalState = useCallback(() => {
    console.log('[FlowSync] Directly clearing local React Flow state');
    setLocalNodes([]);
    setLocalEdges([]);
    flowResetKeyRef.current = Date.now(); // Force re-render if needed
  }, [setLocalNodes, setLocalEdges]);
  
  // Force sync from Zustand store to React Flow
  const forceSyncFromStore = useCallback(() => {
    // Strict check for force clearing
    if (isForceClearing) {
        console.log('[FlowSync] Skipping forceSyncFromStore during force clear');
        return;
    }
    isStoreToLocalSyncInProgress.current = true;
    try {
      // Log positions being applied from store
      const positionsFromStore = zustandNodes.map(n => ({ id: n.id, position: n.position }));
      console.log(`[FlowSync][SyncFromStore] Syncing ${zustandNodes.length} nodes from Zustand. Positions:`, positionsFromStore);
      setLocalNodes(zustandNodes);
      setLocalEdges(zustandEdges);
    } finally {
      isStoreToLocalSyncInProgress.current = false;
    }
  }, [setLocalNodes, setLocalEdges, zustandNodes, zustandEdges]);
  
  // Clear React Flow canvas (for empty flows) - This might be less needed now
  const forceVisualClear = useCallback(() => {
    // Strict check for force clearing
    if (isForceClearing) {
        console.log('[FlowSync] Skipping forceVisualClear during force clear');
        return;
    }
    const now = Date.now();
    // store에도 데이터가 없을 때만 localNodes/Edges를 비움
    if (zustandNodes.length === 0 && zustandEdges.length === 0) {
      setLocalNodes([]);
      setLocalEdges([]);
      lastEmptyFlowTimestamp.current = now;
      flowResetKeyRef.current = now;
      console.log('[FlowSync] Cleared React Flow canvas (store and local both empty)');
    } else {
      // store에 데이터가 있으면 무조건 store-to-local sync만 함
      console.log('[FlowSync] Store has data, skipping clear and syncing from store');
      forceSyncFromStore();
    }
  }, [setLocalNodes, setLocalEdges, zustandNodes, zustandEdges, forceSyncFromStore]);
  
  // Handler for React Flow node changes
  const onLocalNodesChange = useCallback((changes: NodeChange[]) => {
    // Strict check for force clearing
    if (isForceClearing || isStoreToLocalSyncInProgress.current || isRestoringHistory.current) return;

    // Apply changes to local React Flow state
    const updatedNodes = applyNodeChanges(changes, localNodes);
    setLocalNodes(updatedNodes);

    // 디버그 로그 유지
    changes.forEach(change => {
      if (change.type === 'position' && change.position) {
        console.log(`[onLocalNodesChange] Node ${change.id} position changed to`, change.position);
      }
    });

    // Immediately update Zustand store for non-selection changes
    if (!changes.every(change => change.type === 'select')) {
      console.log(`[FlowSync][onLocalNodesChange] Committing node changes to store (nodes: ${updatedNodes.length})`);
      setZustandNodes([...updatedNodes]); // Use spread to ensure a new reference
    }
  }, [localNodes, setLocalNodes, isRestoringHistory, setZustandNodes]);
  
  // Handler for React Flow edge changes
  const onLocalEdgesChange = useCallback((changes: EdgeChange[]) => {
    // Strict check for force clearing
    if (isForceClearing || isStoreToLocalSyncInProgress.current || isRestoringHistory.current) return;

    // Apply changes to local React Flow state and get updated edges
    const updatedEdges = applyEdgeChanges(changes, localEdges);
    setLocalEdges(updatedEdges);

    // Immediately update Zustand store
    console.log(`[FlowSync][onLocalEdgesChange] Committing edge changes to store (edges: ${updatedEdges.length})`);
    setZustandEdges([...updatedEdges]); // Use spread to ensure a new reference
  }, [localEdges, setLocalEdges, isRestoringHistory, setZustandEdges]);
  
  // Explicit function to commit changes to store (for external calls)
  // This function might now be less necessary for auto-sync, but useful for manual triggers like paste
  const commitStructureToStore = useCallback(() => {
    // Strict check for force clearing - Allow commit *during* force clear only if it's the empty state
    if (isForceClearing && (localNodes.length > 0 || localEdges.length > 0)) {
        console.log('[FlowSync] Skipping commitStructureToStore during force clear because local state is not empty');
        return;
    }
    if (isRestoringHistory.current) return;
    
    if (!isEqual(localNodes, zustandNodes) || !isEqual(localEdges, zustandEdges)) {
        const positionsToCommit = localNodes.map(n => ({ id: n.id, position: n.position }));
        console.log(`[FlowSync][CommitImmediate] Committing local changes to store (nodes: ${localNodes.length}). Positions:`, positionsToCommit);
        // Directly set the current local state to Zustand
        setZustandNodes([...localNodes]);
        setZustandEdges([...localEdges]);
    }
  }, [localNodes, localEdges, zustandNodes, zustandEdges, setZustandNodes, setZustandEdges, isRestoringHistory]);
  
  // Hydration 완료 여부
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    // Check if Zustand has finished hydrating
    const unsub = useFlowStructureStore.persist.onFinishHydration(() => {
      console.log('[FlowSync] Zustand hydration finished.');
      setHydrated(true);
    });
    // Also set hydrated if it's already done
    if (useFlowStructureStore.persist.hasHydrated()) {
      console.log('[FlowSync] Zustand already hydrated.');
      setHydrated(true);
    }
    return unsub;
  }, []);
  
  // Initial sync on first render (hydration 완료 후에만 동작)
  useEffect(() => {
    // Strict check for force clearing
    if (isForceClearing || !hydrated) return;
    if (isFirstRender.current) {
      console.log(`[FlowSync] Initial sync from store to React Flow (${zustandNodes.length} nodes, ${zustandEdges.length} edges)`);
      zustandNodes.forEach((node, idx) => {
        console.log(`[FlowSync] Node[${idx}] id=${node.id} position=`, node.position);
      });
      if (zustandNodes.length === 0 && zustandEdges.length === 0) {
        console.log(`[FlowSync] Initial state is empty, ensuring clean canvas`);
        // Use direct clear here too for consistency
        forceClearLocalState(); 
      } else {
        setLocalNodes([...zustandNodes]);
        setLocalEdges([...zustandEdges]);
      }
      isFirstRender.current = false;
    }
  // Hydration is the key dependency here
  }, [hydrated, zustandNodes, zustandEdges, setLocalNodes, setLocalEdges, forceClearLocalState]); 
  
  // Detect and respond to Zustand store changes
  useEffect(() => {
    // Strict check for force clearing
    if (isForceClearing || isFirstRender.current || isRestoringHistory.current) return;
    
    if (isStoreToLocalSyncInProgress.current) {
      console.log(`[FlowSync] Skipping store-to-local sync due to ongoing sync`);
      return;
    }
    
    // Check if the store state *actually* differs from the local state
    // This prevents unnecessary syncs if Zustand updates but local state already matches
    if (!isEqual(zustandNodes, localNodes) || !isEqual(zustandEdges, localEdges)) {
        console.log(`[FlowSync] Store changed and differs from local, syncing to React Flow`);
        forceSyncFromStore();
    } else {
        console.log(`[FlowSync] Store changed but matches local state, skipping sync.`);
    }
    
  // Depend on the Zustand state itself for triggering
  }, [zustandNodes, zustandEdges, localNodes, localEdges, forceSyncFromStore, isRestoringHistory]);
  
  // Effect to handle local becoming empty while store has data (anti-entropy)
  useEffect(() => {
    // Strict check for force clearing
    if (isForceClearing || isFirstRender.current || isRestoringHistory.current) return;
    
    const localEmpty = localNodes.length === 0 && localEdges.length === 0;
    const storeHasData = zustandNodes.length > 0 || zustandEdges.length > 0;
    
    // If local is empty but store has data, and we didn't just sync from store
    if (localEmpty && storeHasData && !isStoreToLocalSyncInProgress.current && !hasJustSyncedFromStore.current) {
      console.log('[FlowSync] Anti-entropy: Local empty but store has data. Forcing store-to-local sync.');
      hasJustSyncedFromStore.current = true; // Prevent immediate loop
      forceSyncFromStore();
      setTimeout(() => { hasJustSyncedFromStore.current = false; }, 100); // Reset flag after a delay
    }
    
  }, [localNodes.length, localEdges.length, zustandNodes.length, zustandEdges.length, forceSyncFromStore, isRestoringHistory]);
  
  return {
    localNodes,
    localEdges,
    setLocalNodes,
    setLocalEdges,
    onLocalNodesChange,
    onLocalEdgesChange,
    commitStructureToStore,
    forceSyncFromStore,
    forceClearLocalState,
    flowResetKey: flowResetKeyRef.current
  };
};