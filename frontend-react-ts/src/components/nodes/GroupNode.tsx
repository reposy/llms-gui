import React, { useMemo } from 'react';
import { Handle, Position, NodeProps, NodeResizer } from 'reactflow';
import clsx from 'clsx';
import { GroupNodeData } from '../../types/nodes';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { executeFlowForGroup, useNodeState } from '../../store/flowExecutionStore';
import { getRootNodesFromSubset } from '../../utils/executionUtils';

// Remove CSS import temporarily
// import './GroupNode.css';

const GroupNode: React.FC<NodeProps<GroupNodeData>> = ({ id, data, selected, xPos, yPos, isConnectable }) => {
  const allNodes = useSelector((state: RootState) => state.flow.nodes);
  const allEdges = useSelector((state: RootState) => state.flow.edges);
  const nodeState = useNodeState(id); // Get execution state for the group node
  const isRunning = nodeState?.status === 'running';

  // Memoize the calculation of nodes within the group and root nodes
  const { nodesInGroup, hasInternalRootNodes } = useMemo(() => {
    const nodesInGroup = allNodes.filter(node => node.parentNode === id);
    const nodeIdsInGroup = new Set(nodesInGroup.map(n => n.id));
    const edgesInGroup = allEdges.filter(edge => nodeIdsInGroup.has(edge.source) && nodeIdsInGroup.has(edge.target));
    const internalRoots = getRootNodesFromSubset(nodesInGroup, edgesInGroup);
    console.log(`[Group ${id}] Nodes in group: ${nodesInGroup.length}, Internal roots: ${internalRoots.length}`);
    return {
      nodesInGroup,
      hasInternalRootNodes: internalRoots.length > 0,
    };
  }, [allNodes, allEdges, id]);

  const handleRunGroup = () => {
    if (!isRunning) {
      executeFlowForGroup(id);
    }
  };

  return (
    <>
      <NodeResizer
        minWidth={150}
        minHeight={100} // Reverted minHeight
        isVisible={selected}
        lineClassName="border-blue-500"
        handleClassName="h-2 w-2 bg-white border border-blue-500"
      />
      
      {/* Main container with flex layout */}
      <div
        className={clsx(
          'w-full h-full',
          'border-2',
          selected ? 'border-orange-600' : 'border-orange-400',
          'rounded-md',
          'flex flex-col', // Back to flex column
          'bg-orange-100/50' // Apply base background here if needed, or rely on content div
        )}
      >
        {/* Header: Interactive */}
        <div
          className={clsx(
            'flex items-center justify-between p-1 text-xs text-orange-800 bg-orange-200/70 rounded-t-md',
            'group-node-header' // Drag handle class
            // pointer-events-auto is default
          )}
        >
          <span>{data.label || 'Group'}</span>
          {hasInternalRootNodes && (
            <button
              onClick={handleRunGroup}
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

        {/* Content Area: Visual background, non-interactive */}
        <div
          className={clsx(
            'flex-grow', // Takes remaining space
            'bg-orange-50/30', // Background color for content area
            'rounded-b-md',
            'relative', // For positioning the placeholder text
            'pointer-events-none' // Crucial: Make this area ignore clicks
          )}
        >
          {nodesInGroup.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-orange-300 text-xs">
              Drag nodes here
            </div>
          )}
          {/* Child nodes rendered by React Flow should receive clicks now */}
        </div>
      </div>

      {/* Handles */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className="!w-2.5 !h-2.5 !bg-orange-500 !border-2 !border-white !rounded-full !-ml-[5px]"
        isConnectable={isConnectable}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="output"
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