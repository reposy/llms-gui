import { useState } from 'react';
import { useFlowExecutorStore } from '../../store/useFlowExecutorStore';
import { executeChain, executeFlowExecutor } from '../../services/flowExecutionService';

/**
 * ExecutorPanel 컴포넌트를 위한 훅
 * 가져오기/내보내기/실행 관련 기능과 상태를 제공합니다.
 */
export const useExecutorPanelHooks = () => {
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const store = useFlowExecutorStore();
  const { flowChain, getFlowById, getFlowResultById, resetResults, resetState, setStage, stage } = store;
  const focusedFlowChainId = store.focusedFlowChainId;

  /**
   * Flow Chain 가져오기
   */
  const handleImportFlowChain = () => {
    try {
      // 파일 선택기 생성
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json';
      
      // 파일 선택 처리
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
              console.error(`[ExecutorPanel] JSON 파싱 오류:`, parseError);
              alert('JSON 파일 형식이 올바르지 않습니다.');
              return;
            }
            
            // 기본 유효성 검사
            if (!importData || typeof importData !== 'object') {
              throw new Error('유효하지 않은 Flow 체인 파일 형식입니다.');
            }
            
            // 버전 확인
            if (!importData.version) {
              console.warn('[ExecutorPanel] 버전 정보가 없는 파일입니다.');
              // 버전 없이 계속 진행
            }
            
            // flowChain 배열 존재 확인
            if (!Array.isArray(importData.flowChain)) {
              // flowChain이 없으면 단일 Flow JSON으로 가정하고 변환 시도
              console.log('[ExecutorPanel] flowChain 배열이 없습니다. 단일 Flow JSON으로 처리합니다.');
              
              // 단일 Flow 객체 생성
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
            
            // 각 Flow 추가
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
                if (focusedFlowChainId) {
                  store.addFlowToChain(focusedFlowChainId, flowToAdd);
                  if (flow.inputData && flow.inputData.length > 0) {
                    store.setFlowInputData(focusedFlowChainId, flowId, flow.inputData);
                  }
                }
              } catch (flowError) {
                // 이 Flow는 건너뛰고 계속 진행
              }
            });
            
            console.log(`[ExecutorPanel] Flow chain imported successfully`);
          } catch (error) {
            console.error(`[ExecutorPanel] Error parsing imported flow chain:`, error);
            alert(`Flow 체인 파일을 파싱하는 도중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
          }
        };
        
        reader.readAsText(file);
      };
      
      // 파일 선택기 클릭
      input.click();
    } catch (error) {
      console.error(`[ExecutorPanel] Error importing flow chain:`, error);
      alert('Flow 체인 가져오기 중 오류가 발생했습니다.');
    }
  };

  /**
   * Flow Chain 내보내기
   */
  const handleExportFlowChain = (filename: string, includeData: boolean) => {
    try {
      // 현재 체인 데이터 추출
      const exportData = {
        version: '1.0',
        flowChain: flowChain.map(flow => {
          const result = includeData ? getFlowResultById(flow.id) : null;
          return {
            id: flow.id,
            name: flow.name,
            flowJson: flow.flowJson,
            inputData: flow.inputData || [],
            result: result // 옵션에 따라 결과 데이터 포함
          };
        })
      };
      
      // JSON 변환 및 파일 다운로드
      const json = JSON.stringify(exportData, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      
      // 정리
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      console.log(`[ExecutorPanel] Flow chain exported successfully with ${includeData ? '' : 'no '}data`);
    } catch (error) {
      console.error(`[ExecutorPanel] Error exporting flow chain:`, error);
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
    setStage('executing');
    setError(null);
    resetResults();
    try {
      const firstFlowInput = flowChain[0]?.inputData as any[] || [];
      await executeChain({
        flowChainId: focusedFlowChainId!,
        inputs: firstFlowInput,
        onFlowComplete: (flowChainId, flowId, result) => {
          if (focusedFlowChainId) {
            store.setFlowResult(focusedFlowChainId, flowId, result || []);
          }
          const isLastFlow = flowId === flowChain[flowChain.length - 1].id;
          if (isLastFlow) {
            setIsExecuting(false);
            setStage('result');
          }
        },
        onError: (flowChainId, flowId, errorMsg) => {
          setError(`Flow \"${getFlowById(flowId)?.name || flowId}\" 실행 중 오류: ${errorMsg}`);
          setIsExecuting(false);
          setStage('result');
        }
      });
    } catch (err) {
      setError('Flow 체인 실행에 실패했습니다. 입력 데이터를 확인하고 다시 시도해주세요.');
      setIsExecuting(false);
      setStage('result');
    }
  };

  /**
   * 모든 Flow 초기화
   */
  const handleClearAll = () => {
    if (window.confirm('모든 내용을 초기화하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      // 스토어 초기화
      resetState();
      
      // 상태 초기화
      setStage('upload');
      setError(null);
      setIsExecuting(false);
    }
  };

  return {
    exportModalOpen,
    setExportModalOpen,
    isExecuting,
    flowChain,
    handleImportFlowChain,
    handleExportFlowChain,
    handleExecuteChain,
    handleClearAll
  };
};

export default useExecutorPanelHooks; 