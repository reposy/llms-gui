import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { Node, Edge, useNodesState, useEdgesState, NodeChange, EdgeChange, applyNodeChanges, applyEdgeChanges } from '@xyflow/react';
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

// 선택 상태 변경만 처리하는 플래그 추가
let isSelectionSyncInProgress = false;

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
  const [localNodes, setLocalNodes, onLocalNodesChangeInternal] = useNodesState<Node<NodeData>>([]);
  const [localEdges, setLocalEdges, onLocalEdgesChangeInternal] = useEdgesState<Edge>([]);
  
  // Track sync status and prevent infinite loops
  const isFirstRender = useRef(true);
  const isStoreToLocalSyncInProgress = useRef(false);
  const flowResetKeyRef = useRef<number>(Date.now());
  const lastEmptyFlowTimestamp = useRef<number>(0);
  
  // For debugging only
  const syncLogCount = useRef(0);
  
  // 마지막으로 처리한 선택 상태 추적
  const lastProcessedSelection = useRef<string[]>([]);
  
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
      // 로그 간소화
      console.log(`[FlowSync][SyncFromStore] Syncing ${zustandNodes.length} nodes from Zustand`);
      
      // Get current selection state from Zustand
      const { selectedNodeIds } = useFlowStructureStore.getState();
      
      // 선택 상태 처리 최적화: 마지막 처리한 선택과 동일하면 불필요한 업데이트 방지
      lastProcessedSelection.current = [...selectedNodeIds].sort();
      
      // Apply selection state to nodes being synced
      const nodesWithSelection = zustandNodes.map(node => ({
        ...node,
        selected: selectedNodeIds.includes(node.id)
      }));
      
      // Set local nodes with proper selection state
      setLocalNodes(nodesWithSelection);
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
    
    // Filter out selection changes, as they are handled by onSelectionChange in FlowCanvas
    const nonSelectionChanges = changes.filter(change => change.type !== 'select');

    // If only selection changes occurred, do nothing here
    if (nonSelectionChanges.length === 0) {
      // Apply selection changes locally *only* to keep React Flow happy
      // This does NOT commit to Zustand selection state.
      setLocalNodes(applyNodeChanges(changes, localNodes) as Node<NodeData>[]);
      return; 
    }

    // Apply non-selection changes to local React Flow state
    const updatedNodes = applyNodeChanges(nonSelectionChanges, localNodes) as Node<NodeData>[];
    setLocalNodes(updatedNodes);

    // Debug logs for position changes - 최소화
    if (nonSelectionChanges.some(change => change.type === 'position')) {
      console.log(`[FlowSync] Position changes detected for ${nonSelectionChanges.length} nodes`);
    }

    // Immediately update Zustand store for non-selection changes
    // 불필요한 업데이트 방지를 위한 isEqual 체크 추가
    const hasStructuralChanges = !isEqual(
      updatedNodes.map(n => ({ id: n.id, type: n.type, position: n.position, data: n.data })),
      zustandNodes.map(n => ({ id: n.id, type: n.type, position: n.position, data: n.data }))
    );

    if (hasStructuralChanges) {
      console.log(`[FlowSync] Committing node structural changes to store`);
      setZustandNodes([...updatedNodes]);
    }
  }, [localNodes, setLocalNodes, isRestoringHistory, setZustandNodes, zustandNodes]);
  
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
  
  // 선택 상태만 동기화하는 함수 - 불필요한 리렌더링 최소화
  const syncSelectionOnly = useCallback(() => {
    if (isSelectionSyncInProgress) return;
    
    isSelectionSyncInProgress = true;
    try {
      const zustandSelectedIds = useFlowStructureStore.getState().selectedNodeIds;
      const sortedZustandSelectedIds = [...zustandSelectedIds].sort();
      
      // 이미 처리한 동일한 선택 상태면 건너뜀
      if (isEqual(sortedZustandSelectedIds, lastProcessedSelection.current)) {
        return;
      }
      
      console.log('[FlowSync] Syncing selection only:', sortedZustandSelectedIds);
      lastProcessedSelection.current = sortedZustandSelectedIds;
      
      // 선택 상태만 효율적으로 업데이트
      const updatedLocalNodes = localNodes.map(node => {
        const shouldBeSelected = zustandSelectedIds.includes(node.id);
        if (node.selected === shouldBeSelected) return node;
        return { ...node, selected: shouldBeSelected };
      });
      
      setLocalNodes(updatedLocalNodes);
    } finally {
      isSelectionSyncInProgress = false;
    }
  }, [localNodes, setLocalNodes]);
  
  // 선택 상태 변경 구독 효과 - 별도 효과로 분리하여 렌더링 최적화
  useEffect(() => {
    // 간소화된 구독 로직: useFlowStructureStore가 표준 Zustand 스토어임
    const unsubscribe = useFlowStructureStore.subscribe(
      state => {
        if (!isForceClearing && !isFirstRender.current && !isRestoringHistory.current && !isStoreToLocalSyncInProgress.current) {
          syncSelectionOnly();
        }
      }
    );
    return () => unsubscribe();
  }, [syncSelectionOnly, isRestoringHistory]);
  
  // Detect and respond to Zustand store node/edge changes (selection 제외)
  useEffect(() => {
    // Strict check for force clearing
    if (isForceClearing || isFirstRender.current || isRestoringHistory.current) return;
    
    if (isStoreToLocalSyncInProgress.current) {
      // console.log(`[FlowSync] Skipping store-to-local sync due to ongoing sync`);
      return;
    }
    
    // nodes와 edges 구조 변경만 체크 (selection 제외)
    // Deep comparison 방식으로 변경하여 position, data 등만 비교
    const nodesChanged = !isEqual(
      zustandNodes.map(n => ({ 
        id: n.id, 
        type: n.type, 
        position: n.position,
        data: n.data 
      })), 
      localNodes.map(n => ({ 
        id: n.id, 
        type: n.type, 
        position: n.position,
        data: n.data
      }))
    );
    
    const edgesChanged = !isEqual(zustandEdges, localEdges);

    if (nodesChanged || edgesChanged) {
      // nodes/edges가 바뀐 경우: 전체 동기화 (로그 간략화)
      console.log(`[FlowSync] Store changed meaningfully, syncing to React Flow.`);
      forceSyncFromStore();
    }
    
  // Depend only on the structure, not selection state
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
    forceSyncFromStore,
    forceClearLocalState,
    flowResetKey: flowResetKeyRef.current
  };
};