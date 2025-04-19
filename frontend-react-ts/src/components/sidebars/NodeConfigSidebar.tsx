import React, { useEffect, useState, useMemo } from 'react';
import { ConfigFactory } from '../config/ConfigFactory';
import { useNodes } from '../../store/useFlowStructureStore';

// Enable debugging logs
const DEBUG_LOGS = true;

interface NodeConfigSidebarProps {
  selectedNodeIds: string[];
}

export const NodeConfigSidebar: React.FC<NodeConfigSidebarProps> = ({ selectedNodeIds }) => {
  const nodes = useNodes();
  const [isOpen, setIsOpen] = useState(false);

  // 단일 선택 노드
  const selectedNode = useMemo(() => {
    if (selectedNodeIds.length === 1) {
      const foundNode = nodes.find(node => node.id === selectedNodeIds[0]);
      if (DEBUG_LOGS) {
        console.log(`[NodeConfigSidebar] Found node:`, foundNode);
      }
      return foundNode;
    }
    return null;
  }, [nodes, selectedNodeIds]);

  // 사이드바 열림 상태 업데이트
  useEffect(() => {
    setIsOpen(selectedNodeIds.length === 1 && !!selectedNode);
    if (DEBUG_LOGS) {
      console.log('[NodeConfigSidebar] Selection changed:', {
        selectedNodeIds,
        hasNode: !!selectedNode,
        nodeType: selectedNode?.type
      });
    }
  }, [selectedNode, selectedNodeIds]);

  // 무선택 또는 다중 선택 시 사이드바 비움/안내
  if (selectedNodeIds.length === 0) return null;
  if (selectedNodeIds.length > 1) {
    return (
      <div className="w-80 bg-white shadow-lg h-full overflow-y-auto p-4 border-l flex flex-col items-center justify-center">
        <div className="text-lg font-semibold text-gray-700 mb-2">여러 노드가 선택되었습니다.</div>
        <div className="text-gray-500 text-sm">그룹화, 삭제 등 다중 선택 액션을 사용할 수 있습니다.</div>
      </div>
    );
  }

  // 단일 노드 선택 시 상세
  if (!isOpen) return null;
  if (DEBUG_LOGS) {
    console.log('[NodeConfigSidebar] Rendering sidebar for node:', {
      id: selectedNode?.id,
      type: selectedNode?.type,
      label: selectedNode?.data?.label
    });
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
}; 