import React, { useState, useCallback } from 'react';
import { Handle, Position } from 'reactflow';
import { MergerNodeData } from '../../types/nodes';
import { useFlowStructureStore } from '../../store/useFlowStructureStore';

// Type for props
interface MergerNodeProps {
  id: string;
  data: MergerNodeData;
  isConnectable: boolean;
  selected?: boolean;
}

const MergerNode: React.FC<MergerNodeProps> = ({ id, data, isConnectable }) => {
  const { updateNode } = useFlowStructureStore(state => ({
    updateNode: state.updateNode
  }));
  
  // Local state for mode toggle
  const [mergeMode, setMergeMode] = useState<'concat' | 'join'>(
    data.mergeMode || 'concat'
  );
  
  // Toggle between 'concat' and 'join' modes
  const toggleMode = useCallback(() => {
    const newMode = mergeMode === 'concat' ? 'join' : 'concat';
    setMergeMode(newMode);
    
    // Update the node data in Zustand store
    updateNode(id, (node) => ({
      ...node,
      data: {
        ...node.data,
        mergeMode: newMode
      }
    }));
  }, [mergeMode, id, updateNode]);

  return (
    <div className="relative flex items-center justify-center w-[200px] h-[100px] rounded-lg bg-gradient-to-r from-indigo-100 to-indigo-200 border-2 border-indigo-400 shadow-md">
      {/* Input handles */}
      <Handle
        type="target"
        position={Position.Left}
        id={`${id}-target-1`}
        style={{ top: '30%', background: '#6366F1', borderColor: '#4F46E5' }}
        isConnectable={isConnectable}
      />
      <Handle
        type="target"
        position={Position.Left}
        id={`${id}-target-2`}
        style={{ top: '70%', background: '#6366F1', borderColor: '#4F46E5' }}
        isConnectable={isConnectable}
      />
      
      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        id={`${id}-source`}
        style={{ background: '#6366F1', borderColor: '#4F46E5' }}
        isConnectable={isConnectable}
      />
      
      {/* Node content */}
      <div className="flex flex-col items-center p-2 w-full">
        <div className="text-sm font-semibold text-indigo-700">{data.label || 'Merger'}</div>
        
        {/* Mode toggle button */}
        <button 
          className="mt-2 px-3 py-1 text-xs rounded-full bg-indigo-500 text-white shadow hover:bg-indigo-600 transition-colors"
          onClick={toggleMode}
        >
          Mode: {mergeMode === 'concat' ? 'Concatenate' : 'Join'}
        </button>
        
        <div className="mt-1 text-xs text-indigo-700 italic">
          {mergeMode === 'concat' ? 'Merge as array' : 'Join as text'}
        </div>
      </div>
    </div>
  );
};

export default MergerNode; 