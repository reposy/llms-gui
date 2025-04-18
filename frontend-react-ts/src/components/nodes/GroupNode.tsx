import React, { useMemo, useCallback } from 'react';
import { Handle, Position, NodeProps, NodeResizer, useReactFlow } from '@xyflow/react';
import clsx from 'clsx';
import { GroupNodeData } from '../../types/nodes';
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

const GroupNode: React.FC<NodeProps<GroupNodeData>> = ({ id, data, selected, xPos, yPos, isConnectable }) => {
  const allNodes = useNodes();
  const allEdges = useEdges();
  const { nodes, edges } = useFlowStructureStore();
  const nodeState = useNodeState(id); // Get execution state for the group node
  const isRunning = nodeState?.status === 'running';
  const { setNodes } = useReactFlow();
  
  // Use the Zustand state hook
  const { 
    label, 
    isCollapsed, 
    toggleCollapse,
    handleLabelChange 
  } = useGroupNodeData({ nodeId: id });

  // Memoize the calculation of nodes within the group and root nodes
  const { nodesInGroup, hasInternalRootNodes } = useMemo(() => {
    const nodesInGroup = allNodes.filter(node => node.parentNode === id);
    const nodeIdsInGroup = new Set(nodesInGroup.map(n => n.id));
    const edgesInGroup = allEdges.filter(edge => nodeIdsInGroup.has(edge.source) && nodeIdsInGroup.has(edge.target));
    const internalRoots = getRootNodesFromSubset(nodesInGroup, edgesInGroup);
    // Remove noisy logging
    return {
      nodesInGroup,
      hasInternalRootNodes: internalRoots.length > 0,
    };
  }, [allNodes, allEdges, id]);

  const handleRunGroup = useCallback(() => {
    if (!isRunning) {
      // Create execution context
      const executionId = `exec-${uuidv4()}`;
      const executionContext = new FlowExecutionContext(executionId);
      
      // Set trigger node
      executionContext.setTriggerNode(id);
      
      console.log(`[GroupNode] Starting execution for node ${id}`);
      
      // Build execution graph
      buildExecutionGraphFromFlow(nodes, edges);
      const executionGraph = getExecutionGraph();
      
      // Create node factory
      const nodeFactory = new NodeFactory();
      registerAllNodeTypes();
      
      // Find the node data
      const node = nodes.find(n => n.id === id);
      if (!node) {
        console.error(`[GroupNode] Node ${id} not found.`);
        return;
      }
      
      // Create the node instance
      const nodeInstance = nodeFactory.create(
        id,
        node.type as string,
        node.data,
        executionContext
      );
      
      // Attach graph structure reference to the node property
      nodeInstance.property = {
        ...nodeInstance.property,
        nodes,
        edges,
        nodeFactory,
        executionGraph
      };
      
      // Execute the node
      nodeInstance.process({}).catch((error: Error) => {
        console.error(`[GroupNode] Error executing node ${id}:`, error);
      });
    }
  }, [id, isRunning, nodes, edges]);
  
  // Handle selecting the group node manually
  const handleSelectGroup = useCallback((e: React.MouseEvent) => {
    // Only handle events when they target exactly the current element
    // This prevents capturing events from child nodes
    if (e.target === e.currentTarget) {
      e.stopPropagation();
      
      // Select this node in ReactFlow
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