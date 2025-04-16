import React, { useEffect, useState, useMemo } from 'react';
import { shallow } from 'zustand/shallow';
import { ConfigFactory } from '../config/ConfigFactory';
import { useNodes } from '../../store/useFlowStructureStore';

// 디버깅 모드 설정
const DEBUG_LOGS = false;

interface NodeConfigSidebarProps {
  selectedNodeId: string | null;
}

export const NodeConfigSidebar: React.FC<NodeConfigSidebarProps> = React.memo(({ selectedNodeId }) => {
  // shallow 비교로 최적화
  const nodes = useNodes();
  const [isOpen, setIsOpen] = useState(false);
  
  // useMemo로 선택된 노드 계산을 최적화
  const selectedNode = useMemo(() => {
    return nodes.find(node => node.id === selectedNodeId);
  }, [nodes, selectedNodeId]);
  
  // 사이드바 열림 상태만 업데이트
  useEffect(() => {
    setIsOpen(!!selectedNode);
    
    // 디버깅 로그는 개발 모드에서만 출력
    if (DEBUG_LOGS && selectedNode) {
      console.log('[NodeConfigSidebar] Selected node:', selectedNode);
      console.log('[NodeConfigSidebar] Node type:', selectedNode.type);
      console.log('[NodeConfigSidebar] Node data:', selectedNode.data);
    }
  }, [selectedNode]);

  if (!isOpen) {
    return null;
  }

  // 디버깅 로그는 개발 모드에서만 출력
  if (DEBUG_LOGS) {
    console.log('[NodeConfigSidebar] Rendering sidebar for node type:', selectedNode?.type);
  }

  return (
    <div className="w-80 bg-white shadow-lg h-full overflow-y-auto p-4 border-l">
      {selectedNode && (
        <>
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            {selectedNode.data.label || (selectedNode.type ? selectedNode.type.charAt(0).toUpperCase() + selectedNode.type.slice(1) : 'Node')}
          </h2>
          
          <ConfigFactory selectedNode={selectedNode} />
        </>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // 이전 props와 현재 props의 selectedNodeId가 같으면 리렌더링 방지
  return prevProps.selectedNodeId === nextProps.selectedNodeId;
}); 