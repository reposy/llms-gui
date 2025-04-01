import React, { useCallback, useEffect, useState } from 'react';
import { Handle, Position } from 'reactflow';
import { useDispatch, useSelector } from 'react-redux';
import { updateNodeData } from '../../store/flowSlice';
import { InputNodeData } from '../../types/nodes';
import { RootState } from '../../store/store';
import clsx from 'clsx';
import NodeErrorBoundary from './NodeErrorBoundary';
// Shared components might be useful later, but start simple
// import { NodeHeader } from './shared/NodeHeader'; 

interface Props {
  id: string;
  data: InputNodeData;
  isConnectable: boolean;
  selected?: boolean;
}

const InputNode: React.FC<Props> = ({ id, data, isConnectable, selected }) => {
  const dispatch = useDispatch();
  const [textDraft, setTextDraft] = useState(data.text || '');
  const [isComposing, setIsComposing] = useState(false); // For handling IME composition

  // Update draft if data changes externally
  useEffect(() => {
    if (!isComposing) {
      setTextDraft(data.text || '');
    }
  }, [data.text, isComposing]);

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setTextDraft(newText);
    
    // Update immediately if not composing
    if (!isComposing) {
      dispatch(updateNodeData({ nodeId: id, data: { ...data, text: newText } }));
    }
  }, [dispatch, id, data, isComposing]);

  // Handle IME composition end
  const handleCompositionEnd = useCallback((e: React.CompositionEvent<HTMLTextAreaElement>) => {
    setIsComposing(false);
    const newText = e.currentTarget.value;
    // Dispatch final value after composition
    dispatch(updateNodeData({ nodeId: id, data: { ...data, text: newText } }));
  }, [dispatch, id, data]);

  return (
    <NodeErrorBoundary nodeId={id}>
      <div className="relative w-[350px]">
        {/* No Input Handle for Input Node */}

        {/* Output Handle */}
        <Handle
          type="source"
          position={Position.Right}
          id={`${id}-source`}
          isConnectable={isConnectable}
          style={{
            background: '#6b7280', // Gray theme
            border: '1px solid white',
            width: '8px',
            height: '8px',
            top: '50%',
            transform: 'translateY(-50%)',
            right: '-4px',
            zIndex: 50
          }}
        />

        {/* Node content box */}
        <div
          className={clsx(
            'px-4 py-2 shadow-md rounded-md bg-white',
            'border', 
            selected
              ? 'border-gray-500 ring-2 ring-gray-300 ring-offset-1 shadow-lg' // Gray theme selection
              : 'border-gray-200 shadow-sm' // Gray theme default
          )}
        >
          {/* Simple Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="font-bold text-gray-700">{data.label || 'Input'}</div>
            {/* Maybe add editable label later using shared component */}
          </div>
          
          {/* Text Area Input */}
          <textarea
            value={textDraft}
            onChange={handleTextChange}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={handleCompositionEnd}
            rows={5} // Default height, adjust as needed
            placeholder="Enter text or JSON here..."
            className="w-full p-2 text-sm font-mono bg-white border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 resize-none"
          />
        </div>
      </div>
    </NodeErrorBoundary>
  );
};

export default InputNode; 