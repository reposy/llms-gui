import { useEffect, useRef, useCallback, useMemo } from 'react';
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
import { debounce } from '../utils/throttleUtils';

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
  flowResetKey: number;
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
  const hasPendingLocalChanges = useRef(false);
  const isFirstRender = useRef(true);
  const isStoreToLocalSyncInProgress = useRef(false);
  const flowResetKeyRef = useRef<number>(Date.now());
  const lastEmptyFlowTimestamp = useRef<number>(0);
  
  // For debugging only
  const syncLogCount = useRef(0);
  
  // Debounced store sync to prevent rapid consecutive updates
  const debouncedCommitToStore = useRef(debounce(() => {
    if (!hasPendingLocalChanges.current || isRestoringHistory.current) return;
    
    // 로컬 상태가 비어있고 스토어에 노드가 있는 경우, 업데이트를 건너뛰어 실수로 노드를 삭제하지 않도록 함
    if (localNodes.length === 0 && zustandNodes.length > 0) {
      console.log(`[FlowSync] Local nodes array is empty but store has ${zustandNodes.length} nodes. This might be a synchronization error. Skipping commit.`);
      hasPendingLocalChanges.current = false;
      return;
    }
    
    // Only update if there are actual changes
    if (!isEqual(localNodes, zustandNodes) || !isEqual(localEdges, zustandEdges)) {
      console.log(`[FlowSync] Committing local changes to store (nodes: ${localNodes.length}, edges: ${localEdges.length})`);
      setZustandNodes([...localNodes]);
      setZustandEdges([...localEdges]);
    }
    
    hasPendingLocalChanges.current = false;
  }, 100)).current;
  
  // Clear React Flow canvas (for empty flows)
  const forceVisualClear = useCallback(() => {
    const now = Date.now();
    
    // 로컬 상태와 스토어 상태 모두 비어있으면 초기화 불필요
    if (localNodes.length === 0 && localEdges.length === 0 && 
        zustandNodes.length === 0 && zustandEdges.length === 0) {
      console.log(`[FlowSync] Both local and store states are empty, skipping clear`);
      return;
    }
    
    // 스토어에 데이터가 있는데 로컬 상태가 비어있는 경우 초기화 불필요 
    if (localNodes.length === 0 && localEdges.length === 0 && 
        (zustandNodes.length > 0 || zustandEdges.length > 0)) {
      console.log(`[FlowSync] Local state is already empty but store has data, skipping clear. Should sync from store instead.`);
      return;
    }
    
    // Prevent multiple clears within short time period
    if (now - lastEmptyFlowTimestamp.current < 500) {
      console.log(`[FlowSync] Skipping redundant clear - already cleared ${now - lastEmptyFlowTimestamp.current}ms ago`);
      return;
    }
    
    console.log('[FlowSync] Clearing React Flow canvas');
    setLocalNodes([]);
    setLocalEdges([]);
    
    // Update timestamp
    lastEmptyFlowTimestamp.current = now;
    // Update ReactFlow component key to force complete re-render
    flowResetKeyRef.current = now;
    
    // Reset sync flags
    hasPendingLocalChanges.current = false;
  }, [setLocalNodes, setLocalEdges, localNodes, localEdges, zustandNodes, zustandEdges]);
  
  // Force sync from Zustand store to React Flow
  const forceSyncFromStore = useCallback(() => {
    // 이미 동기화 중이면 조기 종료
    if (isStoreToLocalSyncInProgress.current) {
      console.log(`[FlowSync] Already syncing, skipping recursive call`);
      return;
    }
    
    // Set flag to prevent store-to-local-to-store cycle
    isStoreToLocalSyncInProgress.current = true;
    
    try {
      // Get current store state
      const storeNodes = zustandNodes;
      const storeEdges = zustandEdges;
      
      syncLogCount.current++;
      const logId = syncLogCount.current;
      console.log(`[FlowSync:${logId}] Syncing from store to React Flow (nodes: ${storeNodes.length}, edges: ${storeEdges.length})`);
      
      // Handle empty flow case
      if (storeNodes.length === 0 && storeEdges.length === 0) {
        if (localNodes.length === 0 && localEdges.length === 0) {
          console.log(`[FlowSync:${logId}] Both store and local are empty, no changes needed`);
        } else {
          // 로컬 변경사항이 커밋되기 전인 경우 (노드 추가 중일 수 있음)
          if (hasPendingLocalChanges.current) {
            console.log(`[FlowSync:${logId}] Store is empty but local has content with pending changes. This might be a node that's being added. Skipping canvas clear.`);
            return;
          }
          
          // 최근에 노드를 추가했다가 제거한 경우 (노드가 추가 후 사라지는 상황 방지)
          const now = Date.now();
          if (now - lastEmptyFlowTimestamp.current < 1000) {
            console.log(`[FlowSync:${logId}] Detected possible node creation/deletion race condition, skipping canvas clear`);
            return;
          }
          
          console.log(`[FlowSync:${logId}] Store is empty but local has content, clearing canvas`);
          forceVisualClear();
        }
        return;
      }
      
      // 현재 로컬 상태와 스토어 상태가 동일한지 확인
      const isNodesEqual = isEqual(localNodes.map(node => ({...node, selected: false})), 
                                  storeNodes.map(node => ({...node, selected: false})));
      const isEdgesEqual = isEqual(localEdges, storeEdges);
      
      // 모든 상태가 동일하면 업데이트 건너뛰기
      if (isNodesEqual && isEdgesEqual) {
        console.log(`[FlowSync:${logId}] Store and local states are already in sync, skipping update`);
        return;
      }
      
      // 실제 변경된 부분 체크 - 단순히 참조만 다른 경우에는 업데이트 건너뛰기
      let nodesChanged = false;
      let edgesChanged = false;
      
      // 노드 배열 길이 다르면 변경 있음
      if (storeNodes.length !== localNodes.length) {
        nodesChanged = true;
      } else {
        // 각 노드를 비교하여 실제 차이가 있는지 확인
        nodesChanged = storeNodes.some((node, index) => {
          const localNode = localNodes[index];
          // 다른 ID가 있거나 선택 상태가 다르면 변경됨
          return node.id !== localNode.id || node.selected !== localNode.selected;
        });
      }
      
      // 엣지 배열 길이 다르면 변경 있음
      if (storeEdges.length !== localEdges.length) {
        edgesChanged = true;
      } else {
        // 각 엣지를 비교하여 실제 차이가 있는지 확인
        edgesChanged = storeEdges.some((edge, index) => {
          const localEdge = localEdges[index];
          // 다른 ID나 소스/타겟이 있으면 변경됨
          return edge.id !== localEdge.id || 
                 edge.source !== localEdge.source || 
                 edge.target !== localEdge.target;
        });
      }
      
      // 변경된 부분이 있을 때만 업데이트
      if (nodesChanged) {
        console.log(`[FlowSync:${logId}] Nodes changed, updating local state`);
        setLocalNodes([...storeNodes]);
      }
      
      if (edgesChanged) {
        console.log(`[FlowSync:${logId}] Edges changed, updating local state`);
        setLocalEdges([...storeEdges]);
      }
      
      if (!nodesChanged && !edgesChanged) {
        console.log(`[FlowSync:${logId}] No actual changes detected, skipping update`);
      } else {
        console.log(`[FlowSync:${logId}] Successfully synced ${storeNodes.length} nodes and ${storeEdges.length} edges from store`);
      }
    } finally {
      // Clear flag after sync completes
      isStoreToLocalSyncInProgress.current = false;
    }
  }, [zustandNodes, zustandEdges, localNodes, localEdges, setLocalNodes, setLocalEdges, forceVisualClear]);
  
  // Handler for React Flow node changes
  const onLocalNodesChange = useCallback((changes: NodeChange[]) => {
    // Skip if store-to-local sync is in progress to prevent cycles
    if (isStoreToLocalSyncInProgress.current || isRestoringHistory.current) return;
    
    // Apply changes to local React Flow state
    const updatedNodes = applyNodeChanges(changes, localNodes);
    setLocalNodes(updatedNodes);
    
    // Mark as having pending changes that need to be committed to store
    // But only for non-selection-only changes
    if (!changes.every(change => change.type === 'select')) {
      hasPendingLocalChanges.current = true;
      debouncedCommitToStore();
    }
  }, [localNodes, setLocalNodes, debouncedCommitToStore, isRestoringHistory]);
  
  // Handler for React Flow edge changes
  const onLocalEdgesChange = useCallback((changes: EdgeChange[]) => {
    // Skip if store-to-local sync is in progress
    if (isStoreToLocalSyncInProgress.current || isRestoringHistory.current) return;
    
    // Apply changes to local React Flow state
    setLocalEdges(eds => applyEdgeChanges(changes, eds));
    
    // Mark as having pending changes
    hasPendingLocalChanges.current = true;
    debouncedCommitToStore();
  }, [setLocalEdges, debouncedCommitToStore, isRestoringHistory]);
  
  // Explicit function to commit changes to store (for external calls)
  const commitStructureToStore = useCallback(() => {
    // Skip if we're currently restoring history
    if (isRestoringHistory.current) return;
    
    // Cancel any pending debounced commits and commit now
    debouncedCommitToStore.cancel();
    
    // 로컬 상태가 비어있고 스토어에 노드가 있는 경우, 잠재적인 데이터 손실을 방지
    if (localNodes.length === 0 && zustandNodes.length > 0) {
      console.log(`[FlowSync] Warning: Local nodes are empty but store has ${zustandNodes.length} nodes. This might cause data loss. Skipping commit.`);
      return;
    }
    
    if (hasPendingLocalChanges.current) {
      setZustandNodes([...localNodes]);
      setZustandEdges([...localEdges]);
    }
    
    hasPendingLocalChanges.current = false;
  }, [localNodes, localEdges, zustandNodes, zustandEdges, debouncedCommitToStore]);
  
  // Initial sync on first render
  useEffect(() => {
    if (isFirstRender.current) {
      // We only need zustandNodes check here because this only runs once
      console.log(`[FlowSync] Initial sync from store to React Flow (${zustandNodes.length} nodes, ${zustandEdges.length} edges)`);
      
      if (zustandNodes.length === 0 && zustandEdges.length === 0) {
        console.log(`[FlowSync] Initial state is empty, ensuring clean canvas`);
        forceVisualClear();
      } else {
        // Set local state
        setLocalNodes([...zustandNodes]);
        setLocalEdges([...zustandEdges]);
      }
      
      isFirstRender.current = false;
    }
  }, []); // Empty dependency array - this only runs once on mount
  
  // Detect and respond to Zustand store changes
  useEffect(() => {
    // Skip on first render and during history restoration
    if (isFirstRender.current || isRestoringHistory.current) return;
    
    // Skip if changes are pending from local (React Flow) to store
    if (hasPendingLocalChanges.current || isStoreToLocalSyncInProgress.current) {
      console.log(`[FlowSync] Skipping store-to-local sync due to pending changes`);
      return;
    }
    
    // 메모리 누수와 중복 처리 방지를 위한 메모이제이션
    const memoizedZustandNodes = zustandNodes;
    const memoizedZustandEdges = zustandEdges;
    
    // 구조적 변경이 있는지 확인 - 선택 상태 제외 (비교 단순화)
    const structureChanged = 
      memoizedZustandNodes.length !== localNodes.length ||
      memoizedZustandEdges.length !== localEdges.length;
      
    // 구조나 선택이 변경된 경우에만 동기화
    if (structureChanged) {
      console.log(`[FlowSync] Store changed, syncing to React Flow (structure: ${structureChanged})`);
      forceSyncFromStore();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    zustandNodes.length,
    zustandEdges.length,
    localNodes.length,
    localEdges.length,
    // localNodes 자체는 제거 - 매번 재렌더링 방지
    forceSyncFromStore,
    isRestoringHistory,
  ]);
  
  return {
    localNodes,
    localEdges,
    setLocalNodes,
    setLocalEdges,
    onLocalNodesChange,
    onLocalEdgesChange,
    commitStructureToStore,
    forceSyncFromStore,
    flowResetKey: flowResetKeyRef.current,
  };
};