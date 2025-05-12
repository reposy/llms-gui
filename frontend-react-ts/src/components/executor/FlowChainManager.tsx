import React from 'react';
import { useExecutorStateStore } from '../../store/useExecutorStateStore';
import { useExecutorGraphStore } from '../../store/useExecutorGraphStore';
import FileUploader from './FileUploader';
import { executeChain, executeFlowExecutor } from '../../services/flowExecutionService';
import { Node, Edge } from '@xyflow/react';
import { deepClone } from '../../utils/helpers';

interface FlowChainManagerProps {
  onSelectFlow?: (flowId: string) => void;
}

// Flow 노드 정보 분석 함수
const analyzeFlowNodes = (nodes: Node[], edges: Edge[]) => {
  // 1. 노드 연결 정보 초기화
  // 각 노드의 입력(좌측) 및 출력(우측) 연결 상태 추적
  const nodeConnections: Record<string, { hasInputs: boolean; hasOutputs: boolean }> = {};
  
  // 초기화: 모든 노드는, 기본적으로 입력과 출력이 없음으로 설정
  nodes.forEach(node => {
    nodeConnections[node.id] = { hasInputs: false, hasOutputs: false };
  });
  
  // 2. 그룹 노드 및 그 내부 노드 식별
  const groupNodes = nodes.filter(node => node.type === 'group');
  const nodesInGroups = new Set<string>();
  
  // 그룹 내부 노드 식별
  groupNodes.forEach(groupNode => {
    const groupData = groupNode.data;
    if (groupData && groupData.nodeIds) {
      groupData.nodeIds.forEach((nodeId: string) => {
        nodesInGroups.add(nodeId);
      });
    }
  });
  
  // 3. 엣지 분석 - 방향성 고려
  edges.forEach(edge => {
    if (edge.source && edge.target) {
      // 소스 노드는 출력(우측 핸들)이 있음
      if (nodeConnections[edge.source]) {
        nodeConnections[edge.source].hasOutputs = true;
      }
      
      // 타겟 노드는 입력(좌측 핸들)이 있음
      if (nodeConnections[edge.target]) {
        nodeConnections[edge.target].hasInputs = true;
      }
    }
  });
  
  // 4. 루트 및 리프 노드 식별
  // 루트 노드: 입력 연결이 없는 노드 (그룹에 속하지 않음)
  const rootNodes = nodes.filter(node => 
    !nodesInGroups.has(node.id) && // 그룹 내부 노드 제외
    node.id in nodeConnections && // 존재하는 노드인지 확인
    !nodeConnections[node.id].hasInputs // 입력 연결이 없음
  );
  
  // 리프 노드: 출력 연결이 없는 노드 (그룹에 속하지 않음)
  const leafNodes = nodes.filter(node => 
    !nodesInGroups.has(node.id) && // 그룹 내부 노드 제외
    node.id in nodeConnections && // 존재하는 노드인지 확인
    !nodeConnections[node.id].hasOutputs // 출력 연결이 없음
  );
  
  // 5. 타입이 'input'인 노드 수 계산 (입력 핸들 수 추정)
  const inputTypeNodes = nodes.filter(node => 
    node.type === 'input' && !nodesInGroups.has(node.id)
  );
  
  // 전체 노드 수에서 그룹 내부 노드 수 제외
  const visibleNodes = nodes.filter(node => !nodesInGroups.has(node.id));
  
  return {
    totalNodes: visibleNodes.length,
    totalEdges: edges.length,
    rootNodeCount: rootNodes.length,
    leafNodeCount: leafNodes.length,
    inputNodeCount: inputTypeNodes.length,
    // 선택적으로 ID 목록도 반환 (디버깅 및 확장성 목적)
    rootNodeIds: rootNodes.map(n => n.id),
    leafNodeIds: leafNodes.map(n => n.id)
  };
};

// Flow 체인 관리 속성 인터페이스
interface FlowChainManagerProps {
  onSelectFlow: (flowId: string) => void;
}

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

const FlowChainManager: React.FC<FlowChainManagerProps> = ({ onSelectFlow }) => {
  const {
    flowChain,
    activeFlowIndex,
    removeFlow,
    moveFlowUp,
    moveFlowDown,
    setActiveFlowIndex,
    getFlowResultById,
    setFlowResult
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
      
      // Flow 실행
      const result = await executeFlowExecutor({
        flowId: flow.id,
        flowJson: flow.flowJson,
        inputs: flow.inputData || [],
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
  
  // Flow 체인 내보내기
  const handleExportFlowChain = () => {
    try {
      // 현재 체인 데이터 추출
      const exportData: FlowChainExport = {
        version: '1.0',
        flowChain: flowChain.map(flow => ({
          id: flow.id,
          name: flow.name,
          flowJson: flow.flowJson,
          inputData: flow.inputData || [],
        }))
      };
      
      // JSON 변환 및 파일 다운로드
      const json = JSON.stringify(exportData, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `flow-chain-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      
      // 정리
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      console.log(`[FlowChainManager] Flow chain exported successfully`);
    } catch (error) {
      console.error(`[FlowChainManager] Error exporting flow chain:`, error);
      alert('Flow 체인 내보내기 중 오류가 발생했습니다.');
    }
  };
  
  // Flow 체인 가져오기
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
            const importData = JSON.parse(json) as FlowChainExport;
            
            // 버전 확인
            if (!importData.version) {
              throw new Error('유효하지 않은 Flow 체인 파일 형식입니다.');
            }
            
            // 스토어 초기화 및 가져오기
            const { resetState } = useExecutorStateStore.getState();
            resetState();
            
            // 각 Flow 추가
            const { addFlow, setFlowInputData } = useExecutorStateStore.getState();
            importData.flowChain.forEach(flow => {
              addFlow(flow.flowJson);
              
              // 방금 추가된 Flow의 ID 가져오기 (새로 생성된 ID)
              const { flowChain } = useExecutorStateStore.getState();
              const newFlowId = flowChain[flowChain.length - 1].id;
              
              // 입력 데이터 설정
              if (flow.inputData && flow.inputData.length > 0) {
                setFlowInputData(newFlowId, flow.inputData);
              }
            });
            
            console.log(`[FlowChainManager] Flow chain imported successfully`);
          } catch (error) {
            console.error(`[FlowChainManager] Error parsing imported flow chain:`, error);
            alert('Flow 체인 파일을 파싱하는 도중 오류가 발생했습니다.');
          }
        };
        
        reader.readAsText(file);
      };
      
      // 파일 선택기 클릭
      input.click();
    } catch (error) {
      console.error(`[FlowChainManager] Error importing flow chain:`, error);
      alert('Flow 체인 가져오기 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden">
      <div className="p-4 bg-white border-b border-gray-300 flex justify-between items-center">
        <h2 className="font-medium text-lg">Flow 체인 ({flowChain.length})</h2>
        
        <div className="flex space-x-2">
          <button
            onClick={handleImportFlowChain}
            className="px-3 py-1 text-blue-600 border border-blue-600 rounded hover:bg-blue-50 transition-colors flex items-center text-sm"
            title="Flow 체인 가져오기"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            가져오기
          </button>
          
          <button
            onClick={handleExportFlowChain}
            className={`px-3 py-1 text-blue-600 border border-blue-600 rounded hover:bg-blue-50 transition-colors flex items-center text-sm ${flowChain.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={flowChain.length === 0}
            title="Flow 체인 내보내기"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            내보내기
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
              const hasResult = getFlowResultById(flow.id) !== null;
              
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
                      <span className="w-6 h-6 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center text-sm font-medium mr-2">
                        {index + 1}
                      </span>
                      <div>
                        <h3 className="font-medium text-gray-900">{flow.name}</h3>
                        <p className="text-xs text-gray-500">
                          {flow.inputData && flow.inputData.length ? `${flow.inputData.length} 개의 입력` : '입력 없음'} 
                          {hasResult && ' · 결과 있음'}
                        </p>
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