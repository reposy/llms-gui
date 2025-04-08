import React, { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { OutputNodeData } from '../../types/nodes';
import { updateNodeData } from '../../store/flowSlice';
import { useNodeState } from '../../store/flowExecutionStore';
import { useOutputNodeData } from '../../hooks/useOutputNodeData';

interface OutputConfigProps {
  nodeId: string;
  data: OutputNodeData;
}

interface FormatButtonProps {
  format: 'json' | 'text';
  currentFormat: 'json' | 'text';
  onClick: () => void;
}

// Utility function to format execution result
const formatExecutionResult = (result: any, format: 'json' | 'text'): string => {
  if (!result) return '';

  try {
    const jsonResult = typeof result === 'string' ? JSON.parse(result) : result;

    if (format === 'json') {
      return JSON.stringify(jsonResult, null, 2);
    } else {
      if (typeof jsonResult === 'object' && jsonResult !== null) {
        return jsonResult.content || jsonResult.text || '';
      }
      return String(jsonResult);
    }
  } catch (error) {
    return String(result);
  }
};

// Format button component
const FormatButton: React.FC<FormatButtonProps> = ({ format, currentFormat, onClick }) => (
  <button
    className={`flex-1 p-2 rounded-lg text-sm font-medium ${
      currentFormat === format
        ? 'bg-purple-500 text-white'
        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
    }`}
    onClick={onClick}
    onKeyDown={(e) => e.stopPropagation()}
  >
    {format.toUpperCase()}
  </button>
);

// Label component
const ConfigLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label className="block text-sm font-medium text-gray-700 mb-1">
    {children}
  </label>
);

export const OutputConfig: React.FC<OutputConfigProps> = ({ nodeId, data }) => {
  const dispatch = useDispatch();
  const executionState = useNodeState(nodeId);
  
  const { 
    format, 
    handleFormatChange, 
    formatResultBasedOnFormat 
  } = useOutputNodeData({ nodeId });
  
  // Event handler to prevent backspace from deleting nodes
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
  }, []);
  
  const handleFormatToggle = useCallback((newFormat: 'json' | 'text') => {
    handleFormatChange(newFormat);
    
    dispatch(updateNodeData({
      nodeId,
      data: { ...data, format: newFormat }
    }));
  }, [dispatch, nodeId, data, handleFormatChange]);
  
  // Format the result for display
  let displayContent = 'Waiting for execution...';
  
  if (executionState?.status === 'running') {
    displayContent = 'Processing...';
  } else if (executionState?.status === 'error') {
    displayContent = `Error: ${executionState.error}`;
  } else if (executionState?.result) {
    displayContent = formatResultBasedOnFormat(executionState.result, data.format);
  }
  
  return (
    <div className="space-y-4">
      {/* Format Selection */}
      <div>
        <ConfigLabel>Format</ConfigLabel>
        <div className="flex gap-2">
          <FormatButton
            format="json"
            currentFormat={data.format}
            onClick={() => handleFormatToggle('json')}
          />
          <FormatButton
            format="text"
            currentFormat={data.format}
            onClick={() => handleFormatToggle('text')}
          />
        </div>
      </div>

      {/* Content Display */}
      <div>
        <ConfigLabel>Content</ConfigLabel>
        <textarea
          className="w-full h-[300px] p-2.5 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 font-mono text-sm"
          value={displayContent}
          readOnly
          onKeyDown={handleKeyDown}
        />
      </div>
    </div>
  );
}; 