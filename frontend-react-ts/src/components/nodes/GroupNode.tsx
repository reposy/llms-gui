import React from 'react';
import { Handle, Position, NodeProps, NodeResizer } from 'reactflow';
import clsx from 'clsx';
import { GroupNodeData } from '../../types/nodes';

// Remove CSS import temporarily
// import './GroupNode.css';

const GroupNode: React.FC<NodeProps<GroupNodeData>> = ({ id, data, selected, xPos, yPos, isConnectable }) => {
  return (
    // The outer div provided by React Flow handles position, we just need styling
    <>
      <NodeResizer 
        minWidth={150}
        minHeight={100}
        isVisible={selected}
        lineClassName="border-blue-500"
        handleClassName="h-2 w-2 bg-white border border-blue-500"
      />
      
      {/* Main container for visual styling */}
      <div 
        className={clsx(
          // 'react-flow__node-group', // Let React Flow handle this class internally
          'bg-orange-100/50',
          'border-2',
          'w-full h-full', // Ensure it takes the size from React Flow
          selected ? 'border-orange-600' : 'border-orange-400',
          'rounded-md',
          'flex flex-col' // Use flex column for layout
        )}
      >
        {/* Group Label Header */}
        <div className="p-1 text-xs text-orange-800 bg-orange-200/70 rounded-t-md flex-shrink-0">
          {data.label || 'Group'}
        </div>

        {/* Child node area: This div is crucial for RF to render children */}
        {/* Added padding and temporary background for visibility */}
        <div className="flex-grow p-2 bg-orange-50/30 relative">
          {/* React Flow renders child nodes here */}
          {/* Optional: Placeholder when empty */}
          {/* <div className="absolute inset-0 flex items-center justify-center text-orange-300 text-xs pointer-events-none">Child Area</div> */}
        </div>

        {/* Handles: Positioned relative to the main container */}
        <Handle
          type="target"
          position={Position.Left}
          id="input"
          className="!w-2.5 !h-2.5 !bg-orange-500 !border-2 !border-white !rounded-full !-ml-[5px]"
          isConnectable={isConnectable}
          style={{ top: '50%' }} // Ensure vertical centering
        />
        <Handle
          type="source"
          position={Position.Right}
          id="output"
          className="!w-2.5 !h-2.5 !bg-orange-500 !border-2 !border-white !rounded-full !-mr-[5px]"
          isConnectable={isConnectable}
          style={{ top: '50%' }} // Ensure vertical centering
        />
        {/* Group Results Output Handle */}
        <Handle
          type="source"
          position={Position.Right}
          id="group-results" // Specific ID for the results array
          className="!w-3 !h-3 !bg-purple-500 !border-2 !border-white !rounded-full !-mr-[6px]"
          isConnectable={isConnectable}
          style={{ top: '75%' }} // Position lower than the standard output
        />
      </div>
    </>
  );
};

export default GroupNode; 