import React, { useEffect, useRef } from 'react';
import { useFlowStructureStore } from '../store/useFlowStructureStore';
import { createIDBStorage } from '../utils/idbStorage';

/**
 * StoreInitializer 컴포넌트
 * 
 * 앱 초기 로드 시 Zustand 스토어의 초기화를 담당하는 컴포넌트입니다.
 * 이 컴포넌트는 마운트될 때 한 번만 실행되며, 이후 호출에서는 아무 작업도 수행하지 않습니다.
 */
const StoreInitializer: React.FC = () => {
  // 전역 정적 변수로 초기화 여부 추적 (컴포넌트 재렌더링에도 유지)
  const hasInitializedRef = useRef<boolean>(false);
  const setNodes = useFlowStructureStore((s) => s.setNodes);
  const setEdges = useFlowStructureStore((s) => s.setEdges);
  const getItem = createIDBStorage<any>().getItem;

  // 마운트 시 한 번만 실행되는 초기화 로직
  useEffect(() => {
    // 이미 초기화되었으면 아무것도 하지 않음
    if (hasInitializedRef.current) {
      console.log('[StoreInitializer] Already initialized, skipping');
      return;
    }

    // idbStorage에서 flow-structure-storage를 읽어 zustand store에 세팅
    (getItem('flow-structure-storage') as Promise<any>).then((data) => {
      if (data && data.state) {
        setNodes(data.state.nodes || []);
        setEdges(data.state.edges || []);
        console.log(`[StoreInitializer] Loaded ${data.state.nodes?.length || 0} nodes from idbStorage`);
      } else if (data) {
        setNodes(data.nodes || []);
        setEdges(data.edges || []);
        console.log(`[StoreInitializer] Loaded (legacy) ${data.nodes?.length || 0} nodes from idbStorage`);
      } else {
        setNodes([]);
        setEdges([]);
        console.log('[StoreInitializer] No flow data found in idbStorage, initialized with empty flow');
      }
      hasInitializedRef.current = true;
    });
  }, [setNodes, setEdges, getItem]);

  // 이 컴포넌트는 UI를 렌더링하지 않음
  return null;
};

export default StoreInitializer; 