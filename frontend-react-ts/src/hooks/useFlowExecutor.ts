import { useState } from 'react';
import { useExecutorStateStore } from '../store/useExecutorStateStore';
import { useExecutorGraphStore } from '../store/useExecutorGraphStore';
import { executeChain, executeFlowExecutor } from '../services/flowExecutionService';

export type ExecutorStage = 'upload' | 'input' | 'executing' | 'result';

/**
 * Flow Executor 기능을 위한 커스텀 훅
 * 가져오기/내보내기 및 실행 기능을 제공합니다.
 */
export const useFlowExecutor = () => {
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // ExecutorStateStore에서 필요한 상태와 액션 가져오기
  const { 
    // 상태
    chainIds = [],
    chains = {},
    flows = {},
    activeChainId = null,
    stage = 'upload',
    
    // 액션
    addFlow, 
    setFlowInputData, 
    setFlowResult,
    resetResults,
    removeFlow,
    resetState,
    setStage,
    
    // 편의 함수
    getFlow,
    getFlowChain,
    getActiveFlowChain
  } = useExecutorStateStore();
  
  // 그래프 관련 스토어에서 필요한 함수 가져오기
  const {
    getFlowGraph,
    setFlowGraph,
    resetFlowGraphs
  } = useExecutorGraphStore();

  /**
   * 현재 Flow Chain을 구성하는 배열 반환 (가상 구조)
   * 정규화된 데이터 구조(chains, flows)를 기반으로 UI에 표시할 간소화된 형태로 변환
   */
  const getFlowChainList = () => {
    // 활성 체인이 없는 경우 빈 배열 반환
    if (!activeChainId || !chains[activeChainId]) {
      return [];
    }
    
    const activeChain = chains[activeChainId];
    
    // 체인의 flowIds 배열을 순회하며 각 Flow 정보 구성
    return activeChain.flowIds.map(flowId => {
      const flow = flows[flowId];
      if (!flow) return null;
      
      return {
        id: flow.id,
        name: flow.name,
        flowJson: flow.flowJson,
        inputData: flow.inputs || [], // 입력 데이터
        status: flow.status
      };
    }).filter(Boolean); // null 값 제거
  };

  /**
   * 현재 Flow Chain 배열 계산 (메모이제이션된 값으로 간주)
   */
  const flowChain = getFlowChainList();

  /**
   * 현재 활성화된 Flow 가져오기
   * 활성 체인의 선택된 Flow 또는 첫 번째 Flow 반환
   */
  const getActiveFlow = () => {
    if (!activeChainId || !chains[activeChainId]) return null;
    
    const activeChain = chains[activeChainId];
    
    // 선택된 Flow가 있으면 해당 Flow 반환
    if (activeChain.selectedFlowId && flows[activeChain.selectedFlowId]) {
      const flow = flows[activeChain.selectedFlowId];
      return {
        id: flow.id,
        name: flow.name,
        flowJson: flow.flowJson,
        inputData: flow.inputs || [],
        status: flow.status
      };
    }
    
    // 선택된 Flow가 없으면 첫 번째 Flow 반환 (있는 경우)
    if (activeChain.flowIds.length > 0) {
      const firstFlowId = activeChain.flowIds[0];
      const flow = flows[firstFlowId];
      if (flow) {
        return {
          id: flow.id,
          name: flow.name,
          flowJson: flow.flowJson,
          inputData: flow.inputs || [],
          status: flow.status
        };
      }
    }
    
    return null;
  };

  /**
   * 특정 Flow ID로 Flow 정보 가져오기
   */
  const getFlowById = (flowId) => {
    if (!flowId || !flows[flowId]) return null;
    
    const flow = flows[flowId];
    return {
      id: flow.id,
      name: flow.name,
      flowJson: flow.flowJson,
      inputData: flow.inputs || [],
      status: flow.status
    };
  };

  /**
   * 특정 Flow ID로 실행 결과 가져오기
   */
  const getFlowResultById = (flowId) => {
    if (!flowId || !flows[flowId]) return null;
    return flows[flowId].lastResults;
  };

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
              console.error(`[FlowExecutor] JSON 파싱 오류:`, parseError);
              alert('JSON 파일 형식이 올바르지 않습니다.');
              return;
            }
            
            // 기본 유효성 검사
            if (!importData || typeof importData !== 'object') {
              throw new Error('유효하지 않은 Flow 체인 파일 형식입니다.');
            }
            
            // 버전 확인
            if (!importData.version) {
              console.warn('[FlowExecutor] 버전 정보가 없는 파일입니다.');
              // 버전 없이 계속 진행
            }
            
            // flowChain 배열 존재 확인
            if (!Array.isArray(importData.flowChain)) {
              // flowChain이 없으면 단일 Flow JSON으로 가정하고 변환 시도
              console.log('[FlowExecutor] flowChain 배열이 없습니다. 단일 Flow JSON으로 처리합니다.');
              
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
                // flowJson 유효성 검사
                if (!flow.flowJson || typeof flow.flowJson !== 'object') {
                  console.warn(`[FlowExecutor] 유효하지 않은 flowJson 형식, flow:`, flow);
                  return; // 이 Flow는 건너뛰고 계속 진행
                }
                
                // 원본 ID 보존: flow.id가 있으면 해당 ID 사용, 없으면 파일명 기반 ID 생성
                const flowName = flow.name || flow.flowJson.name || '가져온-flow';
                const timestamp = Date.now();
                const random = Math.floor(Math.random() * 1000);
                
                // 파일명에서 특수문자 제거하고 소문자로 변환하여 ID 생성
                const namePart = flowName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase().substring(0, 20);
                const flowId = flow.id || `${namePart}-${timestamp}-${random}`;
                
                const flowToAdd = {
                  ...flow.flowJson,
                  id: flowId
                };
                
                // Flow 추가 (원본 ID 보존)
                addFlow(flowToAdd);
                
                // 입력 데이터 설정
                if (flow.inputData && flow.inputData.length > 0) {
                  setFlowInputData(flowId, flow.inputData);
                }
              } catch (flowError) {
                console.error(`[FlowExecutor] Flow 추가 중 오류:`, flowError);
                // 이 Flow는 건너뛰고 계속 진행
              }
            });
            
            console.log(`[FlowExecutor] Flow chain imported successfully`);
          } catch (error) {
            console.error(`[FlowExecutor] Error parsing imported flow chain:`, error);
            alert(`Flow 체인 파일을 파싱하는 도중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
          }
        };
        
        reader.readAsText(file);
      };
      
      // 파일 선택기 클릭
      input.click();
    } catch (error) {
      console.error(`[FlowExecutor] Error importing flow chain:`, error);
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
      
      console.log(`[FlowExecutor] Flow chain exported successfully with ${includeData ? '' : 'no '}data`);
    } catch (error) {
      console.error(`[FlowExecutor] Error exporting flow chain:`, error);
      alert('Flow 체인 내보내기 중 오류가 발생했습니다.');
    }
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
    setStage('executing');
    setError(null);

    try {
      const response = await executeFlowExecutor({
        flowId: flow.id,
        flowJson: flow.flowJson,
        inputs: flow.inputData || [],
        onComplete: (result) => {
          // 결과 저장 및 상태 업데이트
          setFlowResult(flow.id, result);
          setIsExecuting(false);
          setStage('result');
        }
      });

      if (response.status === 'error') {
        setError(response.error || '플로우 실행 중 알 수 없는 오류가 발생했습니다.');
        setIsExecuting(false);
      }
    } catch (err) {
      setError('플로우 실행에 실패했습니다. 입력 데이터를 확인하고 다시 시도해주세요.');
      console.error('실행 오류:', err);
      setIsExecuting(false);
      setStage('result');
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
    
    // 이전 결과 초기화
    resetResults();
    
    try {
      // 체인 실행을 위한 Flow 항목 준비
      const flowItems = flowChain.map(flow => ({
        id: flow.id,
        flowJson: flow.flowJson,
        inputData: flow.inputData || []
      }));
      
      // Flow 그래프 초기화 (필요한 경우)
      flowChain.forEach(flow => {
        if (!getFlowGraph(flow.id)) {
          setFlowGraph(flow.id, flow.flowJson);
        }
      });
      
      // 체인 실행
      await executeChain({
        flowItems,
        onFlowComplete: (flowId, result) => {
          console.log(`Flow ${flowId} completed with result:`, result);
          setFlowResult(flowId, result);
          
          // 마지막 Flow인 경우 실행 완료 처리
          const isLastFlow = flowId === flowItems[flowItems.length - 1].id;
          if (isLastFlow) {
            setIsExecuting(false);
            setStage('result');
          }
        },
        onError: (flowId, errorMsg) => {
          console.error(`Error executing flow ${flowId}:`, errorMsg);
          setError(`Flow "${getFlowById(flowId)?.name || flowId}" 실행 중 오류: ${errorMsg}`);
          setIsExecuting(false);
          setStage('result');
        }
      });
    } catch (err) {
      setError('Flow 체인 실행에 실패했습니다. 입력 데이터를 확인하고 다시 시도해주세요.');
      console.error('체인 실행 오류:', err);
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
      resetFlowGraphs();
      
      // 상태 초기화
      setStage('upload');
      setError(null);
      setIsExecuting(false);
    }
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
    setStage,
    getActiveFlow,
    getFlowById,
    getFlowResultById
  };
};

export default useFlowExecutor; 