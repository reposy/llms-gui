import React, { useEffect, useRef } from 'react';
import { useFlowStructureStore } from '../store/useFlowStructureStore';

/**
 * StoreInitializer 컴포넌트
 * 
 * 앱 초기 로드 시 Zustand 스토어의 초기화를 담당하는 컴포넌트입니다.
 * 이 컴포넌트는 마운트될 때 한 번만 실행되며, 이후 호출에서는 아무 작업도 수행하지 않습니다.
 */
const StoreInitializer: React.FC = () => {
  // 전역 정적 변수로 초기화 여부 추적 (컴포넌트 재렌더링에도 유지)
  const hasInitializedRef = useRef<boolean>(false);
  const { nodes } = useFlowStructureStore();

  // 마운트 시 한 번만 실행되는 초기화 로직
  useEffect(() => {
    // 이미 초기화되었으면 아무것도 하지 않음
    if (hasInitializedRef.current) {
      console.log('[StoreInitializer] Already initialized, skipping');
      return;
    }

    console.log(`[StoreInitializer] Initializing store with ${nodes.length} nodes`);

    // 여기서 필요한 초기화 로직 수행
    // nodes가 존재하면 초기 상태 로깅
    if (nodes.length > 0) {
      console.log(`[StoreInitializer] Found ${nodes.length} nodes in initial state`);
    }

    // 초기화 완료 표시
    hasInitializedRef.current = true;

    // 컴포넌트 언마운트 시 로깅
    return () => {
      console.log('[StoreInitializer] Component unmounted, initialization status:', 
        hasInitializedRef.current ? 'completed' : 'not completed');
    };
  }, []); // 의존성 배열 비움 - 마운트 시 한 번만 실행

  // 이 컴포넌트는 UI를 렌더링하지 않음
  return null;
};

export default StoreInitializer; 