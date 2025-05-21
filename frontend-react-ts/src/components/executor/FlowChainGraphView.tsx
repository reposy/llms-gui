import React, { useState, useMemo } from 'react';
import { useFlowExecutorStore } from '../../store/useFlowExecutorStore';

interface FlowChainGraphViewProps {
  flowId: string;
  chainId?: string;
  className?: string;
}

const FlowChainGraphView: React.FC<FlowChainGraphViewProps> = ({ flowId, chainId, className = '' }) => {
  const [tab, setTab] = useState<'graph' | 'roots' | 'leafs'>('graph');
  
  // 활성화된 체인 가져오기
  const focusedFlowChainId = useFlowExecutorStore(state => state.focusedFlowChainId);
  // 실제 사용할 체인 ID 결정 (props의 chainId 또는 활성 체인 ID)
  const effectiveChainId = chainId || focusedFlowChainId;
  
  // Flow 구조 가져오기
  const flowStructure = useFlowExecutorStore(state => 
    effectiveChainId ? state.getFlow(effectiveChainId, flowId) : null
  );
  
  const nodeCount = useMemo(() => {
    return flowStructure && flowStructure.nodeMap ? Object.keys(flowStructure.nodeMap).length : 0;
  }, [flowStructure]);
  
  const edgeCount = useMemo(() => {
    if (!flowStructure || !flowStructure.graphMap) return 0;
    let totalEdges = 0;
    Object.values(flowStructure.graphMap).forEach((node: any) => {
      if (node && Array.isArray(node.childs)) {
        totalEdges += node.childs.length;
      }
    });
    return totalEdges;
  }, [flowStructure]);
  
  if (!flowStructure) {
    return (
      <div className={`bg-white rounded-lg shadow p-4 ${className}`}>
        <p className="text-gray-500">Flow를 찾을 수 없습니다: {flowId}</p>
        {!effectiveChainId && <p className="text-red-500 text-xs mt-1">체인 ID가 지정되지 않았습니다</p>}
      </div>
    );
  }
  
  return (
    <div className={`bg-white rounded-lg shadow ${className}`}>
      <div className="border-b border-gray-200">
        <div className="flex">
          <button
            className={`px-4 py-2 font-medium text-sm ${tab === 'graph' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setTab('graph')}
          >
            그래프 구조
          </button>
          <button
            className={`px-4 py-2 font-medium text-sm ${tab === 'roots' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setTab('roots')}
          >
            루트 노드 ({flowStructure.roots.length})
          </button>
          <button
            className={`px-4 py-2 font-medium text-sm ${tab === 'leafs' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setTab('leafs')}
          >
            리프 노드 ({flowStructure.leafs.length})
          </button>
        </div>
      </div>
      
      <div className="p-4">
        <div className="flex justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">{flowStructure.name}</h3>
          <div className="text-sm text-gray-500">
            노드: {nodeCount} | 연결: {edgeCount}
          </div>
        </div>
        
        {tab === 'graph' && (
          <div className="space-y-4">
            <div className="bg-gray-50 p-3 rounded border border-gray-200">
              <h4 className="font-medium mb-2">노드 관계</h4>
              <div className="overflow-auto max-h-96">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">노드 ID</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">타입</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">부모 노드</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">자식 노드</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {Object.keys(flowStructure.nodeMap).map(nodeId => {
                      const node = flowStructure.nodeMap[nodeId];
                      const nodeGraph = flowStructure.graphMap[nodeId];
                      
                      return (
                        <tr key={nodeId} className="hover:bg-gray-50">
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{nodeId.slice(-6)}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{node.type}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                            {nodeGraph && Array.isArray(nodeGraph.parents) && nodeGraph.parents.length > 0 
                              ? nodeGraph.parents.map((id: string) => id.slice(-6)).join(', ')
                              : <span className="text-gray-400">없음</span>
                            }
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                            {nodeGraph && Array.isArray(nodeGraph.childs) && nodeGraph.childs.length > 0 
                              ? nodeGraph.childs.map((id: string) => id.slice(-6)).join(', ')
                              : <span className="text-gray-400">없음</span>
                            }
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        
        {tab === 'roots' && (
          <div className="bg-gray-50 p-3 rounded border border-gray-200">
            <h4 className="font-medium mb-2">루트 노드 목록 (시작점)</h4>
            {flowStructure.roots.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {flowStructure.roots.map((nodeId: string) => {
                  const node = flowStructure.nodeMap[nodeId];
                  return (
                    <div key={nodeId} className="flex items-center p-2 border rounded border-gray-200 bg-white">
                      <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                      <div className="flex-1">
                        <div className="text-sm font-medium">{node.data?.label || node.type}</div>
                        <div className="text-xs text-gray-500">{nodeId.slice(-8)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-500 italic">루트 노드가 없습니다.</p>
            )}
          </div>
        )}
        
        {tab === 'leafs' && (
          <div className="bg-gray-50 p-3 rounded border border-gray-200">
            <h4 className="font-medium mb-2">리프 노드 목록 (종료점)</h4>
            {flowStructure.leafs.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {flowStructure.leafs.map((nodeId: string) => {
                  const node = flowStructure.nodeMap[nodeId];
                  return (
                    <div key={nodeId} className="flex items-center p-2 border rounded border-gray-200 bg-white">
                      <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                      <div className="flex-1">
                        <div className="text-sm font-medium">{node.data?.label || node.type}</div>
                        <div className="text-xs text-gray-500">{nodeId.slice(-8)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-500 italic">리프 노드가 없습니다.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FlowChainGraphView; 