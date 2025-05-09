import React, { useEffect, useState } from 'react';

interface FlowTreeVisualizationProps {
  flowJson: any;
}

const FlowTreeVisualization: React.FC<FlowTreeVisualizationProps> = ({ flowJson }) => {
  const [rootNodes, setRootNodes] = useState<any[]>([]);
  
  // Sample flow data for testing when no flow is provided
  const sampleFlowData = {
    nodes: [
      { id: "node1", name: "입력 정보 추출", type: "group" },
      { id: "node2", name: "Root Node 2", type: "llm" },
      { id: "node3", name: "Child Node 1", type: "input" },
      { id: "node4", name: "Child Node 2", type: "output" }
    ],
    edges: [
      { source: "node1", target: "node3" },
      { source: "node2", target: "node4" }
    ]
  };
  
  useEffect(() => {
    // Use provided flow or sample data for testing
    const flow = flowJson || sampleFlowData;
    
    // Find root nodes
    const roots = findRootNodes(flow);
    setRootNodes(roots);
  }, [flowJson]);
  
  // Find root nodes based on the proper criteria:
  // 1. Not in a group
  // 2. Has no input handles (or no incoming edges if handle info not available)
  const findRootNodes = (flow: any) => {
    if (!flow || !flow.nodes || !flow.edges) {
      return [];
    }
    
    // 그룹 노드에 속한 노드 ID들의 집합
    const nodesInGroups = new Set<string>();
    
    // 노드가 그룹 속에 있는지 확인 (parentNode 속성이 있는 노드는 그룹에 속함)
    flow.nodes.forEach((node: any) => {
      if (node.parentNode || (node.data && node.data.parentNode)) {
        nodesInGroups.add(node.id);
      }
    });
    
    // 입력 엣지(들어오는 엣지)가 있는 노드 ID들의 집합
    const nodesWithInputs = new Set<string>();
    flow.edges.forEach((edge: any) => {
      nodesWithInputs.add(edge.target);
    });
    
    // 루트 노드 찾기: 그룹에 속하지 않고, 입력 엣지가 없는 노드
    const rootNodes = flow.nodes.filter((node: any) => {
      // 노드가 그룹에 속하지 않아야 함
      const notInGroup = !nodesInGroups.has(node.id);
      
      // 노드에 입력 엣지가 없어야 함
      const hasNoInputs = !nodesWithInputs.has(node.id);
      
      // 노드가 '그룹' 타입인지 확인 - 그룹 노드일 경우 우선적으로 고려
      const isGroupNode = node.type === 'group';
      
      return (isGroupNode && notInGroup) || (notInGroup && hasNoInputs);
    });
    
    // '입력 정보 추출' 유형의 그룹 노드가 있는지 확인
    const inputExtractionGroup = rootNodes.find((node: any) => 
      node.type === 'group' && 
      (node.name?.includes('입력 정보') || node.name?.includes('정보 추출'))
    );
    
    // 있다면 해당 노드만 반환, 없으면 모든 루트 노드 반환
    return inputExtractionGroup ? [inputExtractionGroup] : rootNodes;
  };
  
  // Get a human-readable description for a node type
  const getNodeDescription = (nodeType: string, nodeName: string) => {
    const descriptions: {[key: string]: string} = {
      'input': '입력 데이터',
      'llm': 'LLM 프롬프트',
      'group': '그룹 노드',
      'web-crawler': '웹 정보 수집',
      'html-parser': 'HTML 파싱',
      'output': '출력 노드',
      'merger': '데이터 병합',
      'api': 'API 호출',
      'json-extractor': 'JSON 처리',
      'conditional': '조건부 처리'
    };
    
    // 노드 이름에서 더 구체적인 설명을 추출할 수 있는 경우
    if (nodeName && nodeName.length > 0) {
      const lowerName = nodeName.toLowerCase();
      
      if (lowerName.includes('이미지') || lowerName.includes('image')) {
        if (nodeType === 'input') return '이미지 입력';
      }
      
      if (lowerName.includes('프롬프트') || lowerName.includes('prompt')) {
        if (nodeType === 'llm') return '공통 프롬프트 생성';
      }
      
      if (lowerName.includes('입력 정보') || lowerName.includes('정보 추출')) {
        if (nodeType === 'group') return '입력 정보 추출';
      }
    }
    
    return descriptions[nodeType] || nodeType;
  };
  
  return (
    <div className="mt-4 p-4 border border-gray-300 rounded-lg bg-white">
      <h3 className="text-lg font-medium mb-3">루트 노드</h3>
      <div className="bg-gray-50 p-4 border border-gray-200 rounded">
        {rootNodes.length === 0 ? (
          <p className="text-gray-500 text-center py-3">루트 노드를 찾을 수 없습니다</p>
        ) : (
          <ul className="space-y-2">
            {rootNodes.map((node) => (
              <li key={node.id} className="flex">
                <div className="font-medium min-w-[100px]">{node.type || '알 수 없음'}</div>
                <div className="text-gray-700">- {getNodeDescription(node.type, node.name)}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default FlowTreeVisualization; 