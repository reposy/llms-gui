import { useState } from 'react';
import { useFlowExecutorStore } from '../store/useFlowExecutorStore';
import { executeChain, executeFlowExecutor } from '../services/flowExecutionService';

export type ExecutorStage = 'upload' | 'input' | 'executing' | 'result';

interface FlowChainItem {
  id: string;
  chainId: string;
  name: string;
  flowJson: any;
  inputs: any[];
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
  const { flowChainMap, flowChainIds, stage } = store;
  const flowChain = flowChainIds.map(id => flowChainMap[id]) || [];

  const getFocusedFlow = (): FlowChainItem | null => {
    if (!flowChainIds.length || !flowChainMap[flowChainIds[0]]) return null;
    const focusedChain = flowChainMap[flowChainIds[0]];
    if (focusedChain.selectedFlowId && focusedChain.flowMap[focusedChain.selectedFlowId]) {
      const flow = focusedChain.flowMap[focusedChain.selectedFlowId];
      return {
        id: flow.id,
        chainId: flow.chainId,
        name: flow.name,
        flowJson: flow.flowJson,
        inputs: flow.inputs || [],
        status: flow.status
      };
    }
    if (focusedChain.flowIds.length > 0) {
      const firstFlowId = focusedChain.flowIds[0];
      const flow = focusedChain.flowMap[firstFlowId];
      if (flow) {
        return {
          id: flow.id,
          chainId: flow.chainId,
          name: flow.name,
          flowJson: flow.flowJson,
          inputs: flow.inputs || [],
          status: flow.status
        };
      }
    }
    return null;
  };

  const getFlowById = (flowId: string): FlowChainItem | null => {
    if (!flowChainIds.length || !flowId) return null;
    for (const chainId of flowChainIds) {
      const chain = flowChainMap[chainId];
      if (chain && chain.flowMap[flowId]) {
        const flow = chain.flowMap[flowId];
        return {
          id: flow.id,
          chainId: flow.chainId,
          name: flow.name,
          flowJson: flow.flowJson,
          inputs: flow.inputs || [],
          status: flow.status
        };
      }
    }
    return null;
  };

  const getFlowResultById = (flowId: string): FlowResult | null => {
    if (!flowChainIds.length || !flowId) return null;
    for (const chainId of flowChainIds) {
      const chain = flowChainMap[chainId];
      if (chain && chain.flowMap[flowId]) {
        const flow = chain.flowMap[flowId];
        if (!flow.lastResults) return null;
        return {
          status: flow.status,
          outputs: flow.lastResults,
          error: flow.error,
          flowId: flowId
        };
      }
    }
    return null;
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
        inputs: flow.inputs || [],
        chainId: flow.chainId,
        onComplete: (result: any) => {
          if (flowChainIds.length > 0) {
            store.setFlowResult(flowChainIds[0], flow.id, result || []);
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
                  inputs: []
                }]
              };
            }
            if (!flowChainIds.length) {
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
                store.addFlowToChain(flowChainIds[0], flowToAdd);
                if (flow.inputs && flow.inputs.length > 0) {
                  store.setFlowInputData(flowChainIds[0], flowId, flow.inputs);
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
      // Export all flows from all chains
      const exportFlows = flowChainIds.flatMap(chainId => {
        const chain = flowChainMap[chainId];
        if (!chain) return [];
        return chain.flowIds.map(flowId => {
          const flow = chain.flowMap[flowId];
          const result = includeData ? getFlowResultById(flow.id) : null;
          return {
            id: flow.id,
            name: flow.name,
            flowJson: flow.flowJson,
            inputs: flow.inputs || [],
            result: result
          };
        });
      });
      const exportData = {
        version: '1.0',
        flowChain: exportFlows
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
    store.resetResults();
    try {
      // 첫 Flow의 inputs만 inputs로 전달
      const firstFlowInput = (flowChain[0] && Array.isArray(flowChain[0].inputs)) ? flowChain[0].inputs : [];
      await executeChain({
        flowChainId: flowChainIds[0],
        inputs: firstFlowInput,
        onFlowComplete: (flowId, result) => {
          if (flowChainIds.length > 0) {
            store.setFlowResult(flowChainIds[0], flowId, (Array.isArray(result) ? result : []));
          }
          // 마지막 Flow인 경우 실행 완료 처리
          if (flowId === flowChain[flowChain.length - 1].id) {
            setIsExecuting(false);
            store.setStage('result');
          }
        },
        onError: (flowId, errorMsg) => {
          setError(errorMsg);
          setIsExecuting(false);
          store.setStage('input');
        },
      });
    } catch (err: any) {
      setError(err?.message || '실행 중 오류가 발생했습니다.');
      setIsExecuting(false);
      store.setStage('input');
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
    store.resetState();
    store.resetFlowGraphs();
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
    getFocusedFlow,
    getFlowById,
    getFlowResultById
  };
};

export default useFlowExecutor; 