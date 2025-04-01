import React, { useCallback, useMemo } from 'react';
import { Handle, Position, NodeProps, useReactFlow, useNodes } from 'reactflow';
import { useDispatch, useSelector } from 'react-redux';
import { updateNodeData, setNodeViewMode, getNodeEffectiveViewMode, VIEW_MODES } from '../../store/flowSlice';
import { GroupNodeData, NodeData } from '../../types/nodes';
import { RootState } from '../../store/store';
import clsx from 'clsx';
import NodeErrorBoundary from './NodeErrorBoundary';
import { NodeHeader } from './shared/NodeHeader'; // Use shared header

// NodeProps provides id, data, selected etc.
const GroupNode: React.FC<NodeProps<GroupNodeData>> = ({ id, data, selected }) => {
  const dispatch = useDispatch();
  // Get all nodes using useNodes hook
  const allNodes = useNodes<NodeData>(); 
  // Find the current node from the list to get its dimensions
  const currentNode = useMemo(() => allNodes.find(n => n.id === id), [allNodes, id]);
  const width = currentNode?.width;
  const height = currentNode?.height;
  
  // Group nodes typically don't have their own execution state directly
  // But we might need label editing etc. later
  
  // Placeholder handlers for shared header props
  const handleLabelUpdate = useCallback((nodeId: string, newLabel: string) => {
    dispatch(updateNodeData({ nodeId, data: { ...data, label: newLabel } }));
  }, [dispatch, data]);

  const handleRun = useCallback(() => {
    console.warn('Run action not implemented for GroupNode');
    // Group execution is handled by the main flow logic based on iteration config
  }, []);

  const toggleNodeView = useCallback(() => {
    console.warn('Collapse/Expand not implemented yet for GroupNode');
    // TODO: Implement collapse/expand logic
    // This would likely involve updating node dimensions and potentially a custom class
    // dispatch(updateNodeData({ nodeId: id, data: { ...data, isCollapsed: !data.isCollapsed } }));
  }, [dispatch, id, data]);

  return (
    <NodeErrorBoundary nodeId={id}>
      {/* Group Node Container */}
      <div 
        // Apply calculated width/height, provide fallbacks just in case
        style={{ width: width ?? 500, height: height ?? 300 }} 
        className={clsx(
            'react-flow__node-group',
            'rounded-lg shadow-lg border-2 bg-white bg-opacity-70 backdrop-blur-sm',
            selected ? 'border-orange-500' : 'border-orange-300' 
        )}
       >
         {/* Header Area */}
         <div className="p-2 border-b border-orange-200">
            <NodeHeader
                nodeId={id}
                label={data.label || 'Group'}
                placeholderLabel="Group"
                isRootNode={false} 
                isRunning={false} 
                viewMode={VIEW_MODES.EXPANDED} 
                themeColor="orange" // This should be valid now
                onRun={handleRun}
                onLabelUpdate={handleLabelUpdate}
                onToggleView={toggleNodeView}
            />
         </div>
         
         {/* Child nodes will be rendered inside this by React Flow */}
         {/* We can add specific input/output handles later if needed for iteration */}
         {/* Example handle placeholder 
         <Handle 
            type="target" 
            position={Position.Left} 
            id={`${id}-iteration-input`} 
            style={{ top: '50px', background: '#ff9900' }} 
         /> 
         */}
       </div>
    </NodeErrorBoundary>
  );
};

export default GroupNode; 