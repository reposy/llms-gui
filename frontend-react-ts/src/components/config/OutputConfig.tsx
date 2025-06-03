// src/components/config/OutputConfig.tsx
import React, { useCallback } from 'react';
import { OutputNodeProperty, OutputFormat } from '../../types/nodes';
import { useNodeState } from '../../store/useNodeStateStore';
import { useOutputNodeProperty } from '../../hooks/useOutputNodeData';

interface OutputConfigProps {
  nodeId: string;
}

interface FormatButtonProps {
  format: 'json' | 'text';
  currentFormat: 'json' | 'text';
  onClick: () => void;
}

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

export const OutputConfig: React.FC<OutputConfigProps> = ({ nodeId }) => {
  const executionState = useNodeState(nodeId);
  
  const { 
    format, 
    handleFormatChange, 
    formatResultBasedOnFormat,
    content
  } = useOutputNodeProperty(nodeId);
  
  // Event handler to prevent backspace from deleting nodes
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
  }, []);
  
  const handleFormatToggle = useCallback((newFormat: OutputFormat) => {
    handleFormatChange(newFormat);
  }, [handleFormatChange]);
  
  // 디버깅을 위한 로그 (개발 시에만)
  console.log('[OutputConfig] Debug:', {
    nodeId,
    status: executionState?.status,
    hasResult: executionState?.result !== null && executionState?.result !== undefined,
    resultType: typeof executionState?.result,
    result: executionState?.result
  });
  
  // Format the result for display
  let displayContent = 'Waiting for execution...';
  
  if (executionState?.status === 'running') {
    displayContent = 'Processing...';
  } else if (executionState?.status === 'error') {
    displayContent = `Error: ${executionState.error}`;
  } else if (executionState?.result !== null && executionState?.result !== undefined) {
    // 결과가 있으면 상태에 관계없이 표시
    displayContent = formatResultBasedOnFormat(executionState.result);
  } else if (executionState?.status === 'idle' || !executionState?.status) {
    displayContent = 'No execution result available. Run the workflow to see results.';
  }
  
  return (
    <div className="space-y-4">
      {/* Format Selection */}
      <div>
        <ConfigLabel>Format</ConfigLabel>
        <div className="flex gap-2">
          <FormatButton
            format="json"
            currentFormat={format}
            onClick={() => handleFormatToggle('json')}
          />
          <FormatButton
            format="text"
            currentFormat={format}
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