import React from 'react';
import { useExecutorStateStore } from '../../store/useExecutorStateStore';
import FileUploader from './FileUploader';
import { Node, Edge } from '@xyflow/react';

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

const FlowChainManager: React.FC<FlowChainManagerProps> = ({ onSelectFlow }) => {
  const {
    flowChain,
    activeFlowIndex,
    removeFlow,
    moveFlowUp,
    moveFlowDown,
    setActiveFlowIndex,
    getFlowResultById
  } = useExecutorStateStore();

  // Flow 선택 처리
  const handleSelectFlow = (index: number) => {
    setActiveFlowIndex(index);
    const flow = flowChain[index];
    if (flow && onSelectFlow) {
      onSelectFlow(flow.id);
    }
  };

  return (
    <div className="border border-gray-300 rounded-lg bg-white overflow-hidden">
      <div className="p-4 bg-gray-50 border-b border-gray-300">
        <h2 className="font-medium text-lg">Flow 체인 ({flowChain.length})</h2>
        <p className="text-sm text-gray-600">Flow들은 위에서 아래 순서로 실행됩니다.</p>
      </div>
      
      {flowChain.length === 0 ? (
        <div className="p-6 flex flex-col items-center justify-center text-gray-500">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="mb-1">아직 등록된 Flow가 없습니다</p>
          <p className="text-sm">아래에서 Flow를 추가하세요</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-200">
          {flowChain.map((flow, index) => {
            const hasResult = getFlowResultById(flow.id) !== null;
            
            // Flow 노드 분석
            const nodes = flow.flowJson.nodes || [];
            const edges = flow.flowJson.edges || [];
            const nodeInfo = analyzeFlowNodes(nodes, edges);
            
            return (
              <li 
                key={flow.id} 
                className={`p-3 relative ${index === activeFlowIndex ? 'bg-blue-50' : ''}`}
              >
                <div className="flex items-center">
                  <div 
                    className={`w-8 h-8 flex items-center justify-center rounded-full text-white mr-3 shrink-0 
                      ${hasResult ? 'bg-green-500' : 'bg-gray-400'}`}
                  >
                    {index + 1}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <button
                      className="text-left block w-full"
                      onClick={() => handleSelectFlow(index)}
                    >
                      <p className="font-medium truncate">{flow.name}</p>
                      <div className="flex flex-wrap gap-x-3 text-xs text-gray-500">
                        <span>{nodeInfo.totalNodes} 노드</span>
                        <span>{nodeInfo.totalEdges} 연결</span>
                        <span className="text-blue-500">{nodeInfo.rootNodeCount} 루트</span>
                        <span className="text-green-500">{nodeInfo.leafNodeCount} 리프</span>
                      </div>
                    </button>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <button
                      className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-30"
                      onClick={() => moveFlowUp(flow.id)}
                      disabled={index === 0}
                      title="위로 이동"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    
                    <button
                      className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-30"
                      onClick={() => moveFlowDown(flow.id)}
                      disabled={index === flowChain.length - 1}
                      title="아래로 이동"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    
                    <button
                      className="p-1 text-gray-500 hover:text-red-500"
                      onClick={() => removeFlow(flow.id)}
                      title="제거"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                {/* 선택 표시자 */}
                {index === activeFlowIndex && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500"></div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      
      <div className="p-4 border-t border-gray-300">
        <FileUploader className="mb-0 p-0 border-0" />
      </div>
    </div>
  );
};

export default FlowChainManager; 