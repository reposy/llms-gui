import { useState } from 'react';
import { useFlowExecutorStore, getFlow, getChain, getActiveChain, addFlowToChain, resetResults, resetFlowGraphs, resetState } from '../store/useFlowExecutorStore';
import { executeChain, executeFlowExecutor } from '../services/flowExecutionService';

export type ExecutorStage = 'upload' | 'input' | 'executing' | 'result';

interface FlowChainItem {
  id: string;
  chainId: string;
  name: string;
  flowJson: any;
  inputData: any[];
  status: string;
}

interface FlowResult {
  status: string;
  outputs: any[];
  error?: string;
  flowId: string;
}

/**
 * Flow Executor 기능을 위한 커스텀 훅
 * 가져오기/내보내기 및 실행 기능을 제공합니다.
 */
export const useFlowExecutor = () => {
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const store = useFlowExecutorStore();
  const { activeChainId, chains, flows, stage } = store;

  // 현재 Flow Chain을 구성하는 배열 반환
  const getFlowChainList = (): FlowChainItem[] => {
    if (!activeChainId || !chains[activeChainId]) {
      return [];
    }
    const activeChain = chains[activeChainId];
    return activeChain.flowIds.map((flowId: string) => {
      const flow = flows[flowId];
      if (!flow) return null;
      return {
        id: flow.id,
        chainId: flow.chainId,
        name: flow.name,
        flowJson: flow.flowJson,
        inputData: flow.inputs || [],
        status: flow.status
      };
    }).filter(Boolean) as FlowChainItem[];
  };

  const flowChain = getFlowChainList();

  const getActiveFlow = (): FlowChainItem | null => {
    if (!activeChainId || !chains[activeChainId]) return null;
    const activeChain = chains[activeChainId];
    if (activeChain.selectedFlowId && flows[activeChain.selectedFlowId]) {
      const flow = flows[activeChain.selectedFlowId];
      return {
        id: flow.id,
        chainId: flow.chainId,
        name: flow.name,
        flowJson: flow.flowJson,
        inputData: flow.inputs || [],
        status: flow.status
      };
    }
    if (activeChain.flowIds.length > 0) {
      const firstFlowId = activeChain.flowIds[0];
      const flow = flows[firstFlowId];
      if (flow) {
        return {
          id: flow.id,
          chainId: flow.chainId,
          name: flow.name,
          flowJson: flow.flowJson,
          inputData: flow.inputs || [],
          status: flow.status
        };
      }
    }
    return null;
  };

  const getFlowById = (flowId: string): FlowChainItem | null => {
    if (!activeChainId || !flowId || !flows[flowId]) return null;
    const flow = flows[flowId];
    return {
      id: flow.id,
      chainId: flow.chainId,
      name: flow.name,
      flowJson: flow.flowJson,
      inputData: flow.inputs || [],
      status: flow.status
    };
  };

  const getFlowResultById = (flowId: string): FlowResult | null => {
    if (!activeChainId || !flowId || !flows[flowId]) return null;
    const flow = flows[flowId];
    if (!flow.lastResults) return null;
    return {
      status: flow.status,
      outputs: flow.lastResults,
      error: flow.error,
      flowId: flowId
    };
  };

  /**
   * 단일 Flow 실행
   */
  const handleExecuteSingleFlow = async (flowId: string) => {
    if (!flowId) {
      setError('실행할 Flow를 선택해주세요.');
      return;
    }
    const flow = getFlowById(flowId);
    if (!flow) {
      setError('선택한 Flow를 찾을 수 없습니다.');
      return;
    }
    setIsExecuting(true);
    store.setStage('executing');
    setError(null);
    try {
      const response = await executeFlowExecutor({
        flowId: flow.id,
        flowJson: flow.flowJson,
        inputs: flow.inputData || [],
        chainId: flow.chainId,
        onComplete: (result: any) => {
          if (activeChainId) {
            store.setFlowResult(activeChainId, flow.id, result || []);
          }
          setIsExecuting(false);
          store.setStage('result');
        }
      });
      if (response.status === 'error') {
        setError(response.error || '플로우 실행 중 알 수 없는 오류가 발생했습니다.');
        setIsExecuting(false);
      }
    } catch (err) {
      setError('플로우 실행에 실패했습니다. 입력 데이터를 확인하고 다시 시도해주세요.');
      setIsExecuting(false);
      store.setStage('result');
    }
  };

  /**
   * Flow Chain 가져오기
   */
  const handleImportFlowChain = () => {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json';
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const json = event.target?.result as string;
            let importData;
            try {
              importData = JSON.parse(json);
            } catch (parseError) {
              alert('JSON 파일 형식이 올바르지 않습니다.');
              return;
            }
            if (!importData || typeof importData !== 'object') {
              throw new Error('유효하지 않은 Flow 체인 파일 형식입니다.');
            }
            if (!importData.version) {
              // 버전 없이 계속 진행
            }
            if (!Array.isArray(importData.flowChain)) {
              importData = {
                version: '1.0',
                flowChain: [{
                  id: `flow-${Date.now()}`,
                  name: file.name.replace(/\.json$/, '') || '가져온 Flow',
                  flowJson: importData,
                  inputData: []
                }]
              };
            }
            if (!activeChainId) {
              alert('Flow Chain이 없습니다. 먼저 체인을 생성하세요.');
              return;
            }
            importData.flowChain.forEach((flow: any) => {
              try {
                if (!flow.flowJson || typeof flow.flowJson !== 'object') {
                  return;
                }
                const flowName = flow.name || flow.flowJson.name || '가져온-flow';
                const timestamp = Date.now();
                const random = Math.floor(Math.random() * 1000);
                const namePart = flowName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase().substring(0, 20);
                const flowId = flow.id || `${namePart}-${timestamp}-${random}`;
                const flowToAdd = {
                  ...flow.flowJson,
                  id: flowId
                };
                addFlowToChain(activeChainId, flowToAdd);
                if (flow.inputData && flow.inputData.length > 0) {
                  store.setFlowInputData(activeChainId, flowId, flow.inputData);
                }
              } catch (flowError) {
                // 이 Flow는 건너뛰고 계속 진행
              }
            });
          } catch (error) {
            alert(`Flow 체인 파일을 파싱하는 도중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
          }
        };
        reader.readAsText(file);
      };
      input.click();
    } catch (error) {
      alert('Flow 체인 가져오기 중 오류가 발생했습니다.');
    }
  };

  /**
   * Flow Chain 내보내기
   */
  const handleExportFlowChain = (filename: string, includeData: boolean) => {
    try {
      const exportData = {
        version: '1.0',
        flowChain: flowChain.map(flow => {
          const result = includeData ? getFlowResultById(flow.id) : null;
          return {
            id: flow.id,
            name: flow.name,
            flowJson: flow.flowJson,
            inputData: flow.inputData || [],
            result: result
          };
        })
      };
      const json = JSON.stringify(exportData, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      alert('Flow 체인 내보내기 중 오류가 발생했습니다.');
    }
  };

  /**
   * Flow Chain 실행
   */
  const handleExecuteChain = async () => {
    if (flowChain.length === 0) {
      setError('실행할 Flow가 없습니다. 먼저 Flow를 추가해주세요.');
      return;
    }
    setIsExecuting(true);
    store.setStage('executing');
    setError(null);
    resetResults();
    try {
      // 첫 Flow의 inputData만 inputs로 전달
      const firstFlowInput = flowChain[0]?.inputData as any[] || [];
      await executeChain({
        flowChainId: activeChainId!,
        inputs: firstFlowInput,
        onFlowComplete: (flowChainId, flowId, result) => {
          if (activeChainId) {
            store.setFlowResult(activeChainId, flowId, result || []);
          }
          // 마지막 Flow인 경우 실행 완료 처리
          const isLastFlow = flowId === flowChain[flowChain.length - 1].id;
          if (isLastFlow) {
            setIsExecuting(false);
            store.setStage('result');
          }
        },
        onError: (flowChainId, flowId, errorMsg) => {
          setError(`Flow \"${getFlowById(flowId)?.name || flowId}\" 실행 중 오류: ${errorMsg}`);
          setIsExecuting(false);
          store.setStage('result');
        }
      });
    } catch (err) {
      setError('Flow 체인 실행에 실패했습니다. 입력 데이터를 확인하고 다시 시도해주세요.');
      setIsExecuting(false);
      store.setStage('result');
    }
  };

  /**
   * 모든 Flow 초기화
   */
  const handleClearAll = () => {
    store.setStage('upload');
    setError(null);
    setIsExecuting(false);
    localStorage.removeItem('executor-state-store');
    localStorage.removeItem('executor-graph-storage');
    resetState();
    resetFlowGraphs();
    alert('모든 Flow 내용이 초기화되었습니다. 페이지가 새로고침됩니다.');
    window.location.reload();
  };

  return {
    isExecuting,
    error,
    setError,
    handleImportFlowChain,
    handleExportFlowChain,
    handleExecuteSingleFlow,
    handleExecuteChain,
    handleClearAll,
    flowChain,
    stage,
    setStage: store.setStage,
    getActiveFlow,
    getFlowById,
    getFlowResultById
  };
};

export default useFlowExecutor; 