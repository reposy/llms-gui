import React, { useState, useEffect } from 'react';
import { useFlowExecutorStore } from '../../store/useFlowExecutorStore';
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
const analyzeFlowNodes = (flow: any): FlowAnalysis => {
  if (!flow || !flow.flowJson) {
    return {
      totalNodes: 0,
      totalEdges: 0,
      rootNodeCount: 0,
      leafNodeCount: 0
    };
  }
  const nodesArray = Array.isArray(flow.flowJson.nodes) ? flow.flowJson.nodes : [];
  const edgesArray = Array.isArray(flow.flowJson.edges) ? flow.flowJson.edges : [];
  // root/leaf 계산은 생략 또는 필요시 store에서 제공
  return {
    totalNodes: nodesArray.length,
    totalEdges: edgesArray.length,
    rootNodeCount: 0,
    leafNodeCount: 0
  };
};

// Flow 체인 저장/내보내기 포맷 인터페이스
interface FlowChainExport {
  version: string;
  flowChain: {
    id: string;
    name: string;
    flowJson: any;
    inputs: any[];
  }[];
}

const FlowChainManager: React.FC<FlowChainManagerProps> = ({ onSelectFlow, handleImportFlowChain }) => {
  const store = useFlowExecutorStore();
  const flowChainMap = store.flowChainMap;
  const flowChainIds = store.flowChainIds;
  const focusedFlowChainId = store.focusedFlowChainId;
  const [flowAnalysisCache, setFlowAnalysisCache] = useState<Record<string, FlowAnalysis>>({});
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportWithData, setExportWithData] = useState(false);
  
  // 이름 편집 상태 관련 변수 추가
  const [editingFlowId, setEditingFlowId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  
  // 현재 활성 체인
  const chain = focusedFlowChainId ? flowChainMap[focusedFlowChainId] : undefined;
  const flowIds = chain ? chain.flowIds : [];
  const flowMap = chain ? chain.flowMap : {};
  const activeFlowIndex = chain ? chain.selectedFlowId ? flowIds.indexOf(chain.selectedFlowId) : 0 : 0;

  // Flow 선택 처리
  const handleSelectFlow = (index: number) => {
    if (!chain) return;
    const flowId = flowIds[index];
    if (flowId && onSelectFlow) {
      onSelectFlow(flowId);
    }
    store.setSelectedFlow(focusedFlowChainId!, flowId);
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
          store.addFlowToFlowChain(focusedFlowChainId!, flowToAdd);
          console.log(`[FlowChainManager] Flow 추가 완료:`, flowToAdd);
          
          // 선택 처리
          const newIndex = flowIds.length; // 방금 추가된 Flow의 인덱스
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
        flowChain: flowIds.map(flowId => {
          const flow = flowMap[flowId];
          const result = includeData ? flow.lastResults : null;
          return {
            id: flowId,
            name: flow.name,
            flowJson: flow.flowJson,
            inputs: flow.inputs || [],
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
    if (!chain) return;
    const newCache: Record<string, FlowAnalysis> = {};
    flowIds.forEach(flowId => {
      newCache[flowId] = analyzeFlowNodes(flowMap[flowId]);
    });
    setFlowAnalysisCache(newCache);
  }, [chain, flowIds, flowMap]);
  
  // Flow 체인 실행 처리
  const handleExecuteChain = async () => {
    if (flowIds.length === 0) {
      console.warn('No flows to execute');
      return;
    }

    const flowItems = flowIds.map(flowId => {
      const flow = flowMap[flowId];
      return {
        id: flowId,
        flowJson: flow.flowJson,
        inputs: flow.inputs
      };
    });

    try {
      await executeChain({
        flowChainId: focusedFlowChainId!,
        onFlowStart: (flowChainId, flowId) => {
          store.setFlowResult(flowChainId, flowId, []); // set to empty array to indicate running
          store.setFlowStatus(flowChainId, flowId, 'running');
        },
        onFlowComplete: (flowChainId, flowId, results) => {
          console.log(`[FlowChainManager] Flow ${flowId} completed with result:`, results);
          store.setFlowResult(flowChainId, flowId, results);
        },
        onError: (flowChainId, flowId, error) => {
          console.error(`[FlowChainManager] Error executing flow ${flowId}:`, error);
          const errorMessage = typeof error === 'string' ? error : error.message;
          store.setFlowStatus(flowChainId, flowId, 'error', errorMessage);
        }
      });

      console.log('[FlowChainManager] All flows in chain executed successfully');
    } catch (error: any) {
      console.error('[FlowChainManager] Error executing flow chain:', error);
      // 전체 체인 실행 실패 시, 각 Flow의 상태를 어떻게 처리할지 결정 필요
      // 예를 들어, 마지막 실행 시도한 Flow만 에러로 표시하거나, 모든 running 상태를 error로 변경할 수 있음
      // 여기서는 개별 Flow의 에러는 onError 콜백에서 처리되므로 추가적인 전역 에러 처리는 하지 않음
    }
  };

  // Flow 실행 처리
  const handleExecuteFlow = async (flowId: string) => {
    const flow = flowMap[flowId];
    if (!flow) return;

    // 실행 시작 시 'running' 상태로 설정
    store.setFlowResult(focusedFlowChainId!, flowId, []);
    store.setFlowStatus(focusedFlowChainId!, flowId, 'running');

    const flowElement = document.getElementById(`flow-item-${flowId}`);
    if (flowElement) {
      // animate-pulse는 상태 아이콘으로 대체 가능하므로 제거하거나 유지할 수 있습니다.
      // 여기서는 유지하되, 상태 아이콘이 명확하므로 제거를 고려할 수 있습니다.
      flowElement.classList.add('animate-pulse');
    }

    try {
      console.log(`[FlowChainManager] Executing flow: ${flowId}`);
      
      const flowIndex = flowIds.indexOf(flowId);
      let inputs = [...(flow.inputs || [])];

      if (inputs.length > 0 && typeof inputs[0] === 'string' && inputs[0].includes('${result-flow-')) {
        console.log(`[FlowChainManager] 이전 Flow 결과 참조 발견:`, inputs[0]);
        if (flowIndex > 0) {
          const prevFlowId = flowIds[flowIndex - 1];
          const prevFlow = flowMap[prevFlowId];
          const prevResult = prevFlow?.lastResults;
          console.log(`[FlowChainManager] 이전 Flow(${prevFlowId})의 결과:`, prevResult);
          if (prevResult && Array.isArray(prevResult) && prevResult.length > 0) {
            if (typeof prevResult[0] === 'object' && prevResult[0] !== null && 'result' in prevResult[0]) {
              inputs = [prevResult[0].result];
              console.log(`[FlowChainManager] 사용할 입력 데이터 (노드 결과):`, inputs[0]);
            } else {
              inputs = [prevResult[0]];
              console.log(`[FlowChainManager] 사용할 입력 데이터 (배열 요소):`, inputs[0]);
            }
          } else if (prevResult) {
            inputs = [prevResult];
            console.log(`[FlowChainManager] 사용할 입력 데이터 (단일 값):`, inputs[0]);
          }
        }
      }
      
      console.log(`[FlowChainManager] 최종 입력 데이터:`, inputs);
      
      const resultResponse = await executeFlowExecutor({
        flowId: flowId,
        flowJson: flow.flowJson,
        inputs: inputs,
        flowChainId: focusedFlowChainId!
      });
      
      console.log(`[FlowChainManager] Flow execution completed:`, resultResponse);
      store.setFlowResult(focusedFlowChainId!, flowId, resultResponse.outputs);
      store.setFlowStatus(focusedFlowChainId!, flowId, resultResponse.status === 'success' ? 'success' : 'error', resultResponse.error);

      if (onSelectFlow) {
        onSelectFlow(flowId);
      }
      if (resultResponse.status === 'error') {
        alert(`Flow 실행 중 오류가 발생했습니다: ${resultResponse.error || '알 수 없는 오류'}`);
      }

    } catch (error: any) {
      console.error(`[FlowChainManager] Error executing flow:`, error);
      const errorMessage = error.message || '알 수 없는 오류가 발생했습니다.';
      store.setFlowStatus(focusedFlowChainId!, flowId, 'error', errorMessage);
      alert(`Flow 실행 중 예외가 발생했습니다: ${errorMessage}`);
    } finally {
      if (flowElement) {
        flowElement.classList.remove('animate-pulse');
      }
    }
  };

  // 편집 버튼 클릭 시 처리 함수 추가 (맨 아래쪽, 마지막 컴포넌트 렌더링 부분 위에 추가)
  const handleEditNameClick = (e: React.MouseEvent, flowId: string, currentName: string) => {
    e.stopPropagation();
    setEditingFlowId(flowId);
    setEditingName(currentName);
  };

  const handleNameInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditingName(e.target.value);
  };

  const handleNameInputBlur = () => {
    if (editingFlowId && editingName.trim()) {
      if (store.setFlowChainName) {
        store.setFlowChainName(focusedFlowChainId!, editingName.trim());
      }
    }
    setEditingFlowId(null);
  };

  const handleNameInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleNameInputBlur();
    } else if (e.key === 'Escape') {
      setEditingFlowId(null);
    }
  };

  // Flow 추가 (예시, 실제 구현 필요시 store.addFlowToFlowChain 사용)
  const handleAddFlow = (flowData: any) => {
    if (!focusedFlowChainId) return;
    store.addFlowToFlowChain(focusedFlowChainId, flowData);
  };

  // Flow 삭제
  const handleRemoveFlow = (flowId: string) => {
    if (!focusedFlowChainId) return;
    store.removeFlowFromFlowChain(focusedFlowChainId, flowId);
  };

  // Flow 이동
  const handleMoveFlow = (flowId: string, direction: 'up' | 'down') => {
    if (!focusedFlowChainId) return;
    store.moveFlow(focusedFlowChainId, flowId, direction);
  };

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden">
      <div className="p-4 bg-white border-b border-gray-300 flex justify-between items-center">
        <h2 className="font-medium text-lg">Flow 체인 ({flowIds.length})</h2>
        
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
        {flowIds.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-700 mb-1">Flow가 없습니다</h3>
            <p className="mb-4">파일 업로드를 통해 Flow를 추가하세요.</p>
          </div>
        ) : (
          <ul>
            {flowIds.map((flowId, index) => {
              const flow = flowMap[flowId];
              const isActive = index === activeFlowIndex;
              let statusIcon = null;
              let statusColor = '';
              if (flow.status === 'running') {
                statusIcon = (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v.01M12 8v.01M12 12v.01M12 16v.01M12 20v.01M4 12h.01M8 12h.01M16 12h.01M20 12h.01" />
                  </svg>
                );
                statusColor = 'text-blue-500';
              } else if (flow.status === 'success') {
                statusIcon = (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                );
                statusColor = 'text-green-500';
              } else if (flow.status === 'error') {
                statusIcon = (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                );
                statusColor = 'text-red-500';
              }
              const analysis = flowAnalysisCache[flowId] || {
                totalNodes: 0,
                totalEdges: 0,
                rootNodeCount: 0,
                leafNodeCount: 0
              };
              const isEditing = editingFlowId === flowId;
              return (
                <li
                  key={flowId}
                  className={`border-b border-gray-200 last:border-b-0 p-3 cursor-pointer ${isEditing ? 'bg-blue-50 outline outline-2 outline-blue-400' : isActive ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                  onClick={() => {
                    if (!isEditing) handleSelectFlow(index);
                  }}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center">
                      {statusIcon && <span className={`mr-2 ${statusColor}`}>{statusIcon}</span>}
                      <span className="w-6 h-6 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center text-sm font-medium mr-2">
                        {index + 1}
                      </span>
                      <div>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editingName}
                            onChange={handleNameInputChange}
                            onBlur={handleNameInputBlur}
                            onKeyDown={handleNameInputKeyDown}
                            className="border border-blue-500 rounded px-2 py-1 text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            onClick={e => e.stopPropagation()}
                            autoFocus
                          />
                        ) : (
                          <h3
                            className="font-medium text-gray-900 hover:bg-gray-100 px-2 py-1 rounded cursor-pointer"
                            onClick={e => {
                              e.stopPropagation();
                              handleEditNameClick(e, flowId, flow.name);
                            }}
                            title="클릭하여 Flow 이름 편집"
                          >
                            {flow.name}
                          </h3>
                        )}
                        <div className="text-xs text-gray-500 flex flex-wrap gap-2 mt-1">
                          <span>{flow.inputs && flow.inputs.length ? `${flow.inputs.length}개의 입력` : '입력 없음'}</span>
                          {flow.status && (
                            <span className={`${statusColor} font-medium`}>
                              • {flow.status.charAt(0).toUpperCase() + flow.status.slice(1)}
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
                        onClick={e => {
                          e.stopPropagation();
                          handleExecuteFlow(flowId);
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
                        onClick={e => {
                          e.stopPropagation();
                          handleMoveFlow(flowId, 'up');
                        }}
                        className={`p-1.5 text-gray-600 hover:bg-gray-100 rounded-full transition-colors ${index === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                        disabled={index === 0}
                        title="위로 이동"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                        </svg>
                      </button>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          handleMoveFlow(flowId, 'down');
                        }}
                        className={`p-1.5 text-gray-600 hover:bg-gray-100 rounded-full transition-colors ${index === flowIds.length - 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
                        disabled={index === flowIds.length - 1}
                        title="아래로 이동"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                        </svg>
                      </button>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          if (window.confirm(`"${flow.name}" Flow를 제거하시겠습니까?`)) {
                            handleRemoveFlow(flowId);
                          }
                        }}
                        className="p-1.5 text-red-600 hover:bg-red-100 rounded-full transition-colors"
                        title="Flow 제거"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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