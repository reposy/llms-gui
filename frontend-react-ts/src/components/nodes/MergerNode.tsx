import React, { useState, useCallback, useEffect } from 'react';
import { Handle, Position } from 'reactflow';
import { MergerNodeData } from '../../types/nodes';
import { useFlowStructureStore } from '../../store/useFlowStructureStore';
import clsx from 'clsx';

// Type for props
interface MergerNodeProps {
  id: string;
  data: MergerNodeData;
  isConnectable: boolean;
  selected?: boolean;
}

const MAX_HANDLES = 6; // Maximum number of input handles to display

const MergerNode: React.FC<MergerNodeProps> = ({ id, data, isConnectable, selected }) => {
  const { updateNode } = useFlowStructureStore(state => ({
    updateNode: state.updateNode
  }));
  
  // Local state for mode toggle
  const [mergeMode, setMergeMode] = useState<'concat' | 'join' | 'object'>(
    data.mergeMode || 'concat'
  );
  
  // Update state when props change
  useEffect(() => {
    if (data.mergeMode && data.mergeMode !== mergeMode) {
      setMergeMode(data.mergeMode);
    }
  }, [data.mergeMode]);
  
  // Toggle between merge modes
  const toggleMode = useCallback(() => {
    const modeOrder = ['concat', 'join', 'object'] as const;
    const currentIndex = modeOrder.indexOf(mergeMode);
    const nextIndex = (currentIndex + 1) % modeOrder.length;
    const newMode = modeOrder[nextIndex];
    
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
  
  // Toggle wait behavior
  const toggleWaitForAll = useCallback(() => {
    const newValue = !data.waitForAll;
    
    updateNode(id, (node) => ({
      ...node,
      data: {
        ...node.data,
        waitForAll: newValue
      }
    }));
  }, [id, data.waitForAll, updateNode]);

  return (
    <div className={clsx(
      "relative flex flex-col w-[200px] rounded-lg border-2 shadow-md p-3",
      selected 
        ? "bg-gradient-to-r from-indigo-50 to-indigo-100 border-indigo-500" 
        : "bg-gradient-to-r from-indigo-100 to-indigo-200 border-indigo-400"
    )}>
      {/* Input handles - dynamically create based on connections */}
      {Array.from({ length: MAX_HANDLES }).map((_, i) => (
        <Handle
          key={`input-${i}`}
          type="target"
          position={Position.Left}
          id={`${id}-target-${i+1}`}
          style={{ 
            top: `${((i + 1) / (MAX_HANDLES + 1)) * 100}%`, 
            background: '#6366F1', 
            borderColor: '#4F46E5' 
          }}
          isConnectable={isConnectable}
        />
      ))}
      
      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        id={`${id}-source`}
        style={{ top: '50%', background: '#6366F1', borderColor: '#4F46E5' }}
        isConnectable={isConnectable}
      />
      
      {/* Node content */}
      <div className="flex flex-col items-center w-full">
        <div className="text-sm font-semibold text-indigo-700 mb-2">{data.label || 'Merger'}</div>
        
        {/* Mode toggle button */}
        <button 
          className="w-full mb-2 px-3 py-1 text-xs rounded-md bg-indigo-500 text-white shadow hover:bg-indigo-600 transition-colors"
          onClick={toggleMode}
        >
          {mergeMode === 'concat' && 'Mode: Array Concat'}
          {mergeMode === 'join' && 'Mode: Text Join'}
          {mergeMode === 'object' && 'Mode: Create Object'}
        </button>
        
        {/* Wait toggle */}
        <button 
          className={clsx(
            "w-full px-3 py-1 text-xs rounded-md shadow transition-colors", 
            data.waitForAll 
              ? "bg-blue-500 text-white hover:bg-blue-600" 
              : "bg-gray-300 text-gray-700 hover:bg-gray-400"
          )}
          onClick={toggleWaitForAll}
        >
          {data.waitForAll ? "Wait for all inputs" : "Process as received"}
        </button>
        
        <div className="mt-2 text-xs text-indigo-700 italic">
          {mergeMode === 'concat' && 'Combines inputs into a single array'}
          {mergeMode === 'join' && 'Joins text with separator'}
          {mergeMode === 'object' && 'Creates object with named properties'}
        </div>
      </div>
    </div>
  );
};

export default MergerNode; 