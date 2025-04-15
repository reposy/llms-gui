import React, { useMemo, useCallback } from 'react';
import { Handle, Position, NodeProps, NodeResizer, useReactFlow } from 'reactflow';
import clsx from 'clsx';

// Add CSS import for styling
import './GroupNode.css';

// 인라인 타입 정의
interface GroupNodeData {
  label?: string;
}

// 상태 인터페이스
interface NodeState {
  status?: 'idle' | 'running' | 'success' | 'error';
}

const GroupNode: React.FC<NodeProps<GroupNodeData>> = ({ id, data, selected, xPos, yPos, isConnectable }) => {
  // 단순화된 데이터 및 상태
  const allNodes: any[] = [];
  const allEdges: any[] = [];
  const nodes: any[] = [];
  const edges: any[] = [];
  const nodeState: NodeState = { status: 'idle' };
  const isRunning = nodeState?.status === 'running';
  const { setNodes } = useReactFlow();
  
  // 단순화된 그룹 노드 데이터
  const label = data.label || 'Group';
  const isCollapsed = false;
  const toggleCollapse = () => {};
  const handleLabelChange = () => {};

  // 그룹 내부 노드 계산을 단순화
  const { nodesInGroup, hasInternalRootNodes } = useMemo(() => {
    const nodesInGroup = allNodes.filter((node: any) => node.parentNode === id);
    const nodeIdsInGroup = new Set(nodesInGroup.map((n: any) => n.id));
    const edgesInGroup = allEdges.filter((edge: any) => 
      nodeIdsInGroup.has(edge.source) && nodeIdsInGroup.has(edge.target)
    );
    
    return {
      nodesInGroup,
      hasInternalRootNodes: true,
    };
  }, [allNodes, allEdges, id]);

  // 실행 핸들러 단순화
  const handleRunGroup = useCallback(() => {
    if (!isRunning) {
      console.log(`[GroupNode] Starting execution for node ${id}`);
      
      try {
        console.log(`[GroupNode] Executing node ${id}`);
      } catch (error: unknown) {
        console.error(`[GroupNode] Error executing node ${id}:`, error);
      }
    }
  }, [id, isRunning]);
  
  // 그룹 노드 선택 핸들러
  const handleSelectGroup = useCallback((e: React.MouseEvent) => {
    // Only handle events when they target exactly the current element
    if (e.target === e.currentTarget) {
      e.stopPropagation();
      
      // Select this node in ReactFlow
      setNodes((nodes: any[]) => 
        nodes.map((node: any) => ({
          ...node,
          selected: node.id === id
        }))
      );
      
      console.log(`[GroupNode] Selected group ${id}`);
    }
  }, [id, setNodes]);

  return (
    <>
      <NodeResizer
        minWidth={150}
        minHeight={100}
        isVisible={selected}
        lineClassName="border-blue-500"
        handleClassName="h-2 w-2 bg-white border border-blue-500"
      />
      
      {/* Main container with flex layout - make entire group draggable */}
      <div
        className={clsx(
          'w-full h-full',
          'border-2',
          selected ? 'border-orange-600' : 'border-orange-400',
          'rounded-md',
          'flex flex-col',
          'bg-orange-100/50',
          'group-node-container', // Add class for dragging the entire group
          'cursor-move' // Indicate the entire group is draggable
        )}
        onClick={handleSelectGroup}
        data-testid={`group-node-${id}`}
      >
        {/* Header */}
        <div
          className={clsx(
            'flex items-center justify-between p-1 text-xs text-orange-800 bg-orange-200/70 rounded-t-md',
            'group-node-header' // Keep this class for compatibility
          )}
        >
          <span>{label}</span>
          {hasInternalRootNodes && (
            <button
              onClick={(e) => {
                e.stopPropagation(); // Prevent parent node selection
                handleRunGroup();
              }}
              disabled={isRunning}
              className={clsx(
                'ml-2 px-1.5 py-0.5 text-xs font-medium rounded transition-colors',
                'bg-orange-100 text-orange-700 hover:bg-orange-200 disabled:opacity-50 disabled:cursor-not-allowed'
              )}
              title="Execute group nodes"
            >
              {isRunning ? '⏳' : '▶'} Run
            </button>
          )}
        </div>

        {/* Content Area - use pointer-events-none to allow interaction with child elements */}
        <div
          className={clsx(
            'flex-grow',
            'bg-orange-50/30',
            'rounded-b-md',
            'relative',
            'group-node-content', // Add class for potential CSS targeting
            isCollapsed && 'collapsed' // Add class for collapsed state styling
          )}
          onClick={handleSelectGroup} // Also make content area selectable
        >
          {nodesInGroup.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-orange-300 text-xs placeholder">
              Drag nodes here
            </div>
          )}
        </div>
      </div>

      {/* Handles */}
      <Handle
        type="target"
        position={Position.Left}
        id="target"
        className="!w-2.5 !h-2.5 !bg-orange-500 !border-2 !border-white !rounded-full !-ml-[5px]"
        isConnectable={isConnectable}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="source"
        className="!w-2.5 !h-2.5 !bg-orange-500 !border-2 !border-white !rounded-full !-mr-[5px]"
        isConnectable={isConnectable}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="group-results"
        className="!w-3 !h-3 !bg-purple-500 !border-2 !border-white !rounded-full !-mr-[6px]"
        style={{ top: '75%' }}
        isConnectable={isConnectable}
      />
    </>
  );
};

export default GroupNode;