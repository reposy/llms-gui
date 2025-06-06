import { useState } from 'react';
import { useFlowExecutorStore } from '../../store/useFlowExecutorStore';

/**
 * ExecutorPanel 컴포넌트를 위한 훅
 * 가져오기/내보내기/실행 관련 기능과 상태를 제공합니다.
 */
export const useExecutorPanelHooks = () => {
  const [exportModalOpen, setExportModalOpen] = useState(false);

  const store = useFlowExecutorStore();

  return {
    exportModalOpen,
    setExportModalOpen,
    handleImportFlowChain: () => {}, // TODO: 구현 필요시
    handleExportFlowChain: () => {}, // TODO: 구현 필요시
    handleExecuteChain: () => {}, // TODO: 구현 필요시
    handleClearAll: () => store.resetState(),
  };
};

export default useExecutorPanelHooks; 