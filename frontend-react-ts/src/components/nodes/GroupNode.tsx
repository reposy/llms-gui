// src/components/nodes/GroupNode.tsx
import React, { useCallback, memo } from 'react';
import { Handle, Position, NodeProps, NodeResizer, useReactFlow } from '@xyflow/react';
import clsx from 'clsx';
import { NodeProperty } from '../../types/nodes';
import { useNodeState } from '../../store/useNodeStateStore';
import { useGroupNodeData } from '../../hooks/useGroupNodeData';
import { useNodes, useFlowStructureStore } from '../../store/useFlowStructureStore';
import { EditableNodeLabel } from './shared/EditableNodeLabel';

// Add CSS import back to handle z-index
import './GroupNode.css';

const GroupNode: React.FC<NodeProps> = ({ id, selected, isConnectable }) => {
  const allNodes = useNodes() as any[];
  const nodeState = useNodeState(id);
  const isRunning = nodeState?.status === 'running';
  const { setNodes } = useReactFlow();
  
  const { label, isCollapsed, items } = useGroupNodeData({ nodeId: id });

  const setNodesLocal = useFlowStructureStore(state => state.setNodes);

  const handleRunGroup = useCallback(() => {
    if (isRunning) return;
    // TODO: 그룹 실행 로직 구현 필요
  }, [id, isRunning]);
  
  const handleSelectGroup = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      e.stopPropagation();
      
      setNodes(nodes => 
        nodes.map(node => ({
          ...node,
          selected: node.id === id
        }))
      );
    }
  }, [id, setNodes]);

  // --- Define LOCAL label update handler --- 
  const handleLabelUpdate = useCallback((updatedNodeId: string, newLabel: string) => {
    // 1. Update FlowStructureStore (React Flow rendering state)
    const updatedNodes = allNodes.map(node => 
      node.id === updatedNodeId
        ? { 
            ...node, 
            data: { 
              ...node.data, 
              label: newLabel 
            } 
          } 
        : node
    );
    setNodesLocal(updatedNodes); // Use the function obtained from the store hook
  }, [allNodes, setNodesLocal]); // Add dependencies
  // --- End LOCAL handler ---

  return (
    <>
      <NodeResizer
        minWidth={150}
        minHeight={100}
        isVisible={selected}
        lineClassName="border-blue-500"
        handleClassName="h-2 w-2 bg-white border border-blue-500"
      />
      
      <div
        className={clsx(
          'w-full h-full',
          'border-2',
          selected ? 'border-orange-600 group-node-selected' : 'border-orange-400',
          'rounded-md',
          'flex flex-col',
          'bg-orange-100/50',
          'group-node-container',
          'cursor-move'
        )}
        onClick={handleSelectGroup}
        data-testid={`group-node-${id}`}
      >
        <div
          className={clsx(
            'flex items-center justify-between p-1 text-xs text-orange-800 bg-orange-200/70 rounded-t-md',
            'group-node-header'
          )}
        >
          <EditableNodeLabel
            nodeId={id}
            initialLabel={label}
            placeholderLabel="Group"
            onLabelUpdate={handleLabelUpdate}
            labelClassName="text-xs text-orange-800 font-medium mr-2"
          />
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleRunGroup();
            }}
            disabled={isRunning}
            className={clsx(
              'ml-2 px-1.5 py-0.5 text-xs font-medium rounded transition-colors',
              'bg-orange-100 text-orange-700 hover:bg-orange-200 disabled:opacity-50 disabled:cursor-not-allowed',
              'group-controls'
            )}
            title="Execute group nodes"
          >
            {isRunning ? '⏳' : '▶'} Run
          </button>
        </div>

        <div
          className={clsx(
            'flex-grow',
            'bg-orange-50/30',
            'rounded-b-md',
            'relative',
            'group-node-content',
            isCollapsed && 'collapsed'
          )}
          onClick={handleSelectGroup}
        >
          <div className="group-node-overlay"></div>
          
          {items && items.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-orange-300 text-xs placeholder">
              Drag nodes here
            </div>
          )}
          
          <div className="absolute top-2 right-2 p-2 bg-orange-50/70 rounded-md text-xs max-w-[80%] max-h-[75%] overflow-auto group-controls">
            <div className="font-medium mb-1">Nodes in Group ({items ? items.length : 0})</div>
            {items && items.length > 0 ? (
              <ul className="list-disc pl-4 text-xs text-gray-600">
                {items.map((node: any) => (
                  <li key={node.id} className="truncate">
                    {node.data?.label || node.type || node.id}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-orange-300 italic">No nodes defined in this group.</div>
            )}
          </div>
        </div>
      </div>

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
    </>
  );
};

export default memo(GroupNode);