import React, { useState, useEffect } from 'react';
import { useExecutorStateStore } from '../../store/useExecutorStateStore';
import { useExecutorGraphStore } from '../../store/useExecutorGraphStore';
import FileUploader from './FileUploader';
import { executeChain, executeFlowExecutor } from '../../services/flowExecutionService';
import { Node, Edge } from '@xyflow/react';
import { deepClone } from '../../utils/helpers';
import { findLeafNodes, findRootNodes } from '../../core/outputCollector';
import ExportModal from './ExportModal';

interface FlowChainManagerProps {
  onSelectFlow?: (flowId: string) => void;
  handleImportFlowChain?: () => void; // 전체 Flow Chain을 가져오는 기능
}

// Flow 구조 분석 정보
interface FlowAnalysis {
  totalNodes: number;
  totalEdges: number;
  rootNodeCount: number;
  leafNodeCount: number;
}

// Flow 노드 정보 분석 함수
const analyzeFlowNodes = (flowId: string): FlowAnalysis => {
  // executorGraphStore에서 노드와 엣지 정보 가져오기
  const graphStore = useExecutorGraphStore.getState();
  const graph = graphStore.getFlowGraph(flowId);
  
  if (!graph) {
    return {
      totalNodes: 0,
      totalEdges: 0,
      rootNodeCount: 0,
      leafNodeCount: 0
    };
  }
  
  // 루트 노드와 리프 노드 찾기
  const rootNodeIds = findRootNodes();
  const leafNodeIds = findLeafNodes();
  
  return {
    totalNodes: Object.keys(graph.nodes || {}).length,
    totalEdges: Object.keys(graph.edges || {}).length,
    rootNodeCount: rootNodeIds.length,
    leafNodeCount: leafNodeIds.length
  };
};

// Flow 체인 저장/내보내기 포맷 인터페이스
interface FlowChainExport {
  version: string;
  flowChain: {
    id: string;
    name: string;
    flowJson: any;
    inputData: any[];
  }[];
}

const FlowChainManager: React.FC<FlowChainManagerProps> = ({ onSelectFlow, handleImportFlowChain }) => {
  // Flow 분석 결과 캐시
  const [flowAnalysisCache, setFlowAnalysisCache] = useState<Record<string, FlowAnalysis>>({});
  // 내보내기 모달 상태
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportWithData, setExportWithData] = useState(false);
  
  const {
    flowChain,
    activeFlowIndex,
    removeFlow,
    moveFlowUp,
    moveFlowDown,
    setActiveFlowIndex,
    getFlowResultById,
    setFlowResult,
    addFlow,
    setFlowInputData
  } = useExecutorStateStore();
  
  const graphStore = useExecutorGraphStore();

  // Flow 선택 처리
  const handleSelectFlow = (index: number) => {
    setActiveFlowIndex(index);
    const flow = flowChain[index];
    if (flow && onSelectFlow) {
      onSelectFlow(flow.id);
    }
  };
  
  // 단일 Flow 가져오기 (Flow Editor에서 내보낸 Flow)
  const handleImportFlow = (file?: File): Promise<string | null> => {
    return new Promise((resolve, reject) => {
      try {
        if (!file) {
          // 파일이 제공되지 않은 경우 파일 선택기를 통해 파일 선택
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'application/json';
          
          // 파일 선택 처리
          input.onchange = (e) => {
            const selectedFile = (e.target as HTMLInputElement).files?.[0];
            if (!selectedFile) {
              resolve(null);
              return;
            }
            
            processFlowFile(selectedFile)
              .then(flowId => resolve(flowId))
              .catch(error => {
                console.error(`[FlowChainManager] Flow 파일 처리 중 오류:`, error);
                alert(`Flow 파일을 처리하는 도중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
                reject(error);
              });
          };
          
          // 파일 선택기 클릭
          input.click();
        } else {
          // 파일이 제공된 경우 직접 처리
          processFlowFile(file)
            .then(flowId => resolve(flowId))
            .catch(error => {
              console.error(`[FlowChainManager] Flow 파일 처리 중 오류:`, error);
              alert(`Flow 파일을 처리하는 도중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
              reject(error);
            });
        }
      } catch (error) {
        console.error(`[FlowChainManager] Flow 가져오기 중 오류:`, error);
        alert('Flow 가져오기 중 오류가 발생했습니다.');
        reject(error);
      }
    });
  };
  
  // 여러 Flow 가져오기
  const handleImportFlows = () => {
    try {
      // 파일 선택기 생성
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json';
      input.multiple = true; // 여러 파일 선택 가능
      
      // 파일 선택 처리
      input.onchange = async (e) => {
        const files = (e.target as HTMLInputElement).files;
        if (!files || files.length === 0) return;
        
        let successCount = 0;
        let failCount = 0;
        
        // 각 파일마다 순차적으로 처리
        for (let i = 0; i < files.length; i++) {
          try {
            const flowId = await handleImportFlow(files[i]);
            if (flowId) {
              successCount++;
            } else {
              failCount++;
            }
          } catch (error) {
            console.error(`[FlowChainManager] ${files[i].name} 파일 처리 중 오류:`, error);
            failCount++;
          }
        }
        
        // 결과 메시지 출력
        if (successCount > 0) {
          alert(`${successCount}개의 Flow를 성공적으로 가져왔습니다.${failCount > 0 ? ` ${failCount}개의 Flow 가져오기 실패.` : ''}`);
        } else if (failCount > 0) {
          alert(`모든 Flow 가져오기에 실패했습니다. (${failCount}개)`);
        }
      };
      
      // 파일 선택기 클릭
      input.click();
    } catch (error) {
      console.error(`[FlowChainManager] 여러 Flow 가져오기 중 오류:`, error);
      alert('Flow 가져오기 중 오류가 발생했습니다.');
    }
  };
  
  // Flow 파일 처리 함수 (재사용 가능)
  const processFlowFile = (file: File): Promise<string | null> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const json = event.target?.result as string;
          let flowData;
          
          try {
            flowData = JSON.parse(json);
          } catch (parseError) {
            console.error(`[FlowChainManager] JSON 파싱 오류:`, parseError);
            alert('JSON 파일 형식이 올바르지 않습니다.');
            reject(parseError);
            return;
          }
          
          // 기본 유효성 검사
          if (!flowData || typeof flowData !== 'object') {
            throw new Error('유효하지 않은 Flow 파일 형식입니다.');
          }
          
          // Flow 추가 (ID 고유성 보장)
          const flowName = flowData.name || file.name.replace(/\.json$/, '') || '가져온-flow';
          const timestamp = Date.now();
          const random = Math.floor(Math.random() * 1000);
          
          // 파일명에서 특수문자 제거하고 소문자로 변환하여 ID 생성
          const namePart = flowName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase().substring(0, 20);
          const flowId = `${namePart}-${timestamp}-${random}`;
          
          const flowToAdd = {
            ...flowData,
            id: flowId
          };
          
          // Flow 추가
          addFlow(flowToAdd);
          console.log(`[FlowChainManager] Flow 추가 완료:`, flowToAdd);
          
          // 그래프 초기화
          graphStore.setFlowGraph(flowId, flowToAdd);
          
          // 선택 처리
          const newIndex = flowChain.length; // 방금 추가된 Flow의 인덱스
          handleSelectFlow(newIndex);
          
          resolve(flowId);
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = (error) => {
        reject(error);
      };
      
      reader.readAsText(file);
    });
  };
  
  // 내보내기 처리
  const handleExportWithFilename = (filename: string, includeData: boolean) => {
    try {
      // 현재 체인 데이터 추출
      const exportData: FlowChainExport = {
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
      
      console.log(`[FlowChainManager] Flow chain exported successfully with ${includeData ? '' : 'no '}data`);
    } catch (error) {
      console.error(`[FlowChainManager] Error exporting flow chain:`, error);
      alert('Flow 체인 내보내기 중 오류가 발생했습니다.');
    }
  };
  
  // Flow 분석 수행 및 캐시 갱신
  useEffect(() => {
    const newCache: Record<string, FlowAnalysis> = {};
    
    // 각 Flow에 대해 분석 실행
    flowChain.forEach(flow => {
      newCache[flow.id] = analyzeFlowNodes(flow.id);
    });
    
    setFlowAnalysisCache(newCache);
  }, [flowChain]);
  
  // Flow 체인 실행 처리
  const handleExecuteChain = async () => {
    if (flowChain.length === 0) {
      console.warn('No flows to execute');
      return;
    }
    
    // 실행을 위한 Flow 아이템 구성
    const flowItems = flowChain.map(flow => ({
      id: flow.id,
      flowJson: flow.flowJson, // Already cloned during addition to executorStateStore
      inputData: flow.inputData
    }));
    
    try {
      // Flow 그래프 초기화 (필요한 경우) - 항상 깊은 복사본 사용
      flowChain.forEach(flow => {
        if (!graphStore.getFlowGraph(flow.id)) {
          // 깊은 복사를 통해 원본 Flow 데이터와 실행 데이터 완전히 분리
          graphStore.setFlowGraph(flow.id, flow.flowJson);
        }
      });
      
      // 체인 실행
      await executeChain({
        flowItems,
        onFlowComplete: (flowId, result) => {
          console.log(`[FlowChainManager] Flow ${flowId} completed with result:`, result);
          setFlowResult(flowId, result);
        },
        onError: (flowId, error) => {
          console.error(`[FlowChainManager] Error executing flow ${flowId}:`, error);
        }
      });
      
      console.log('[FlowChainManager] All flows in chain executed successfully');
    } catch (error) {
      console.error('[FlowChainManager] Error executing flow chain:', error);
    }
  };

  // Flow 실행 처리
  const handleExecuteFlow = async (flowId: string) => {
    const flow = flowChain.find(f => f.id === flowId);
    if (!flow) return;
    
    try {
      console.log(`[FlowChainManager] Executing flow: ${flowId}`);
      
      // 실행 로딩 상태 표시
      const flowElement = document.getElementById(`flow-item-${flowId}`);
      if (flowElement) {
        flowElement.classList.add('animate-pulse');
      }
      
      // 현재 Flow의 인덱스 찾기
      const flowIndex = flowChain.findIndex(f => f.id === flowId);
      
      // 실행할 입력 데이터 준비
      let inputs = [...(flow.inputData || [])];
      
      // 이전 Flow의 결과 참조하는 문자열 확인
      if (inputs.length > 0 && typeof inputs[0] === 'string' && inputs[0].includes('${result-flow-')) {
        console.log(`[FlowChainManager] 이전 Flow 결과 참조 발견:`, inputs[0]);
        
        // 이전 Flow의 결과를 직접 가져와서 치환
        if (flowIndex > 0) {
          const prevFlowId = flowChain[flowIndex - 1].id;
          
          // flowMap[flow.id].lastResults 사용
          const prevFlow = useExecutorStateStore.getState().getFlowById(prevFlowId);
          const prevResult = prevFlow?.result;
          
          console.log(`[FlowChainManager] 이전 Flow(${prevFlowId})의 결과:`, prevResult);
          
          if (prevResult && Array.isArray(prevResult) && prevResult.length > 0) {
            // NodeResult[] 형식인지 확인 (nodeId, nodeName, nodeType, result 필드가 있는지)
            if (typeof prevResult[0] === 'object' && prevResult[0] !== null && 'result' in prevResult[0]) {
              // 첫 번째 노드 결과의 result 필드 직접 사용
              inputs = [prevResult[0].result];
              console.log(`[FlowChainManager] 사용할 입력 데이터 (노드 결과):`, inputs[0]);
            } else {
              // 일반 배열인 경우 첫 번째 요소 사용
              inputs = [prevResult[0]];
              console.log(`[FlowChainManager] 사용할 입력 데이터 (배열 요소):`, inputs[0]);
            }
          }
        }
      }
      
      console.log(`[FlowChainManager] 최종 입력 데이터:`, inputs);
      
      // Flow 실행
      const result = await executeFlowExecutor({
        flowId: flow.id,
        flowJson: flow.flowJson,
        inputs: inputs,
      });
      
      console.log(`[FlowChainManager] Flow execution completed:`, result);
      
      // 로딩 상태 제거
      if (flowElement) {
        flowElement.classList.remove('animate-pulse');
      }
      
      // 결과 확인
      if (result.status === 'error') {
        console.error(`[FlowChainManager] Error executing flow:`, result.error);
        alert(`Flow 실행 중 오류가 발생했습니다: ${result.error}`);
      } else {
        // 성공적인 실행 후 선택된 Flow 갱신 (실행 결과 표시를 위해)
        if (onSelectFlow) {
          onSelectFlow(flowId);
        }
      }
    } catch (error) {
      console.error(`[FlowChainManager] Error executing flow:`, error);
      alert('Flow 실행 중 오류가 발생했습니다.');
      
      // 로딩 상태 제거
      const flowElement = document.getElementById(`flow-item-${flowId}`);
      if (flowElement) {
        flowElement.classList.remove('animate-pulse');
      }
    }
  };

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden">
      <div className="p-4 bg-white border-b border-gray-300 flex justify-between items-center">
        <h2 className="font-medium text-lg">Flow 체인 ({flowChain.length})</h2>
        
        <div className="flex space-x-2">
          <button
            onClick={() => handleImportFlow()}
            className="px-3 py-1 text-blue-600 border border-blue-600 rounded hover:bg-blue-50 transition-colors flex items-center text-sm"
            title="단일 Flow를 가져와 체인에 추가합니다"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Flow 가져오기
          </button>
          
          <button
            onClick={handleImportFlows}
            className="px-3 py-1 text-blue-600 border border-blue-600 rounded hover:bg-blue-50 transition-colors flex items-center text-sm"
            title="여러 Flow 파일을 선택하여 체인에 추가합니다"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Flow 여러개 가져오기
          </button>
        </div>
      </div>
      
      <div className="bg-white max-h-[60vh] overflow-y-auto">
        {flowChain.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-700 mb-1">Flow가 없습니다</h3>
            <p className="mb-4">파일 업로드를 통해 Flow를 추가하세요.</p>
          </div>
        ) : (
          <ul>
            {flowChain.map((flow, index) => {
              const isActive = index === activeFlowIndex;
              const flowExecutionResult = getFlowResultById(flow.id);
              let statusIcon = null;
              let statusColor = '';

              if (flowExecutionResult) {
                if (flowExecutionResult.status === 'running') {
                  statusIcon = (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v.01M12 8v.01M12 12v.01M12 16v.01M12 20v.01M4 12h.01M8 12h.01M16 12h.01M20 12h.01" />
                    </svg>
                  );
                  statusColor = 'text-blue-500';
                } else if (flowExecutionResult.status === 'success') {
                  statusIcon = (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  );
                  statusColor = 'text-green-500';
                } else if (flowExecutionResult.status === 'error') {
                  statusIcon = (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  );
                  statusColor = 'text-red-500';
                }
              }
              
              const analysis = flowAnalysisCache[flow.id] || {
                totalNodes: 0,
                totalEdges: 0,
                rootNodeCount: 0,
                leafNodeCount: 0
              };
              
              return (
                <li 
                  key={flow.id}
                  id={`flow-item-${flow.id}`}
                  className={`border-b border-gray-200 last:border-b-0 p-3 cursor-pointer ${
                    isActive ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => {
                    handleSelectFlow(index);
                  }}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center">
                      {statusIcon && <span className={`mr-2 ${statusColor}`}>{statusIcon}</span>}
                      <span className="w-6 h-6 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center text-sm font-medium mr-2">
                        {index + 1}
                      </span>
                      <div>
                        <h3 className="font-medium text-gray-900">{flow.name}</h3>
                        <div className="text-xs text-gray-500 flex flex-wrap gap-2 mt-1">
                          <span>{flow.inputData && flow.inputData.length ? `${flow.inputData.length}개의 입력` : '입력 없음'}</span>
                          {flowExecutionResult && flowExecutionResult.status && (
                            <span className={`${statusColor} font-medium`}>
                              • {flowExecutionResult.status.charAt(0).toUpperCase() + flowExecutionResult.status.slice(1)}
                            </span>
                          )}
                          
                          <div className="flex gap-2 text-gray-400 ml-1">
                            <span title="노드 수">{analysis.totalNodes} 노드</span>
                            <span title="엣지 수">{analysis.totalEdges} 엣지</span>
                            <span title="루트 노드 수" className="text-blue-500">{analysis.rootNodeCount} 루트</span>
                            <span title="리프 노드 수" className="text-green-500">{analysis.leafNodeCount} 리프</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex space-x-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExecuteFlow(flow.id);
                        }}
                        className="p-1.5 text-blue-700 hover:bg-blue-100 rounded-full transition-colors"
                        title="이 Flow 실행"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          moveFlowUp(flow.id);
                        }}
                        className={`p-1.5 text-gray-600 hover:bg-gray-100 rounded-full transition-colors ${
                          index === 0 ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                        disabled={index === 0}
                        title="위로 이동"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                        </svg>
                      </button>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          moveFlowDown(flow.id);
                        }}
                        className={`p-1.5 text-gray-600 hover:bg-gray-100 rounded-full transition-colors ${
                          index === flowChain.length - 1 ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                        disabled={index === flowChain.length - 1}
                        title="아래로 이동"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                        </svg>
                      </button>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`"${flow.name}" Flow를 제거하시겠습니까?`)) {
                            removeFlow(flow.id);
                          }
                        }}
                        className="p-1.5 text-red-600 hover:bg-red-100 rounded-full transition-colors"
                        title="Flow 제거"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          console.log("Edit button clicked for", flow.id);
                        }}
                        className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                        title="입력 수정"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default FlowChainManager; 