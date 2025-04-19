// src/components/nodes/GroupNode.tsx
import React, { useMemo, useCallback, memo } from 'react';
import { Handle, Position, NodeProps, NodeResizer, useReactFlow, Node } from '@xyflow/react';
import clsx from 'clsx';
import { GroupNodeData, NodeData } from '../../types/nodes';
import { useNodeState } from '../../store/useNodeStateStore';
import { getRootNodesFromSubset } from '../../utils/flow/executionUtils';
import { useGroupNodeData } from '../../hooks/useGroupNodeData';
import { useNodes, useEdges, useFlowStructureStore } from '../../store/useFlowStructureStore';
import { FlowExecutionContext } from '../../core/FlowExecutionContext';
import { NodeFactory } from '../../core/NodeFactory';
import { registerAllNodeTypes } from '../../core/NodeRegistry';
import { v4 as uuidv4 } from 'uuid';
import { buildExecutionGraphFromFlow, getExecutionGraph } from '../../store/useExecutionGraphStore';

// Add CSS import back to handle z-index
import './GroupNode.css';

const GroupNode: React.FC<NodeProps> = ({ id, data, selected, isConnectable }) => {
  const groupData = data as GroupNodeData;
  
  const allNodes = useNodes();
  const allEdges = useEdges();
  const { nodes, edges } = useFlowStructureStore();
  const nodeState = useNodeState(id);
  const isRunning = nodeState?.status === 'running';
  const { setNodes } = useReactFlow();
  
  const { 
    label, 
    isCollapsed, 
    toggleCollapse,
    handleLabelChange 
  } = useGroupNodeData({ nodeId: id });

  const { nodesInGroup, hasInternalRootNodes } = useMemo(() => {
    const nodesInGroup = allNodes.filter((node: Node<NodeData>) => node.parentId === id);
    const nodeIdsInGroup = new Set(nodesInGroup.map(n => n.id));
    const edgesInGroup = allEdges.filter(edge => nodeIdsInGroup.has(edge.source) && nodeIdsInGroup.has(edge.target));
    const internalRoots = getRootNodesFromSubset(nodesInGroup, edgesInGroup);
    return {
      nodesInGroup,
      hasInternalRootNodes: internalRoots.length > 0,
    };
  }, [allNodes, allEdges, id]);

  const handleRunGroup = useCallback(() => {
    if (!isRunning) {
      const executionId = `exec-${uuidv4()}`;
      const executionContext = new FlowExecutionContext(executionId);
      
      executionContext.setTriggerNode(id);
      
      console.log(`[GroupNode] Starting execution for node ${id}`);
      
      buildExecutionGraphFromFlow(nodes, edges);
      const executionGraph = getExecutionGraph();
      
      const nodeFactory = new NodeFactory();
      registerAllNodeTypes();
      
      const node = nodes.find(n => n.id === id);
      if (!node) {
        console.error(`[GroupNode] Node ${id} not found.`);
        return;
      }
      
      const nodeInstance = nodeFactory.create(
        id,
        node.type as string,
        node.data,
        executionContext
      );
      
      nodeInstance.property = {
        ...nodeInstance.property,
        nodes,
        edges,
        nodeFactory,
        executionGraph
      };
      
      nodeInstance.process({}).catch((error: Error) => {
        console.error(`[GroupNode] Error executing node ${id}:`, error);
      });
    }
  }, [id, isRunning, nodes, edges]);
  
  const handleSelectGroup = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      e.stopPropagation();
      
      setNodes(nodes => 
        nodes.map(node => ({
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
      
      <div
        className={clsx(
          'w-full h-full',
          'border-2',
          selected ? 'border-orange-600' : 'border-orange-400',
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
          <span>{label}</span>
          {hasInternalRootNodes && (
            <button
              onClick={(e) => {
                e.stopPropagation();
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
          {nodesInGroup.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-orange-300 text-xs placeholder">
              Drag nodes here
            </div>
          )}
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

export default memo(GroupNode);