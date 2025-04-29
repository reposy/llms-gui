// src/components/nodes/OutputNode.tsx
import React, { useRef, useEffect, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import { OutputNodeData } from '../../types/nodes';
import { useNodeState } from '../../store/useNodeStateStore';
import clsx from 'clsx';
import NodeErrorBoundary from './NodeErrorBoundary';
import { downloadFile } from '../../utils/data/downloadUtils';
import { useNodeContent } from '../../store/useNodeContentStore';
import { isEqual } from 'lodash';

interface Props {
  id: string;
  data: OutputNodeData;
  selected?: boolean;
  isConnectable?: boolean;
}

const OutputNode: React.FC<Props> = ({ id, data, selected, isConnectable = true }) => {
  const nodeState = useNodeState(id);
  const { content, updateContent } = useNodeContent(id);
  const format = content?.format || 'text';
  
  const handleFormatChange = useCallback((newFormat: 'json' | 'text') => {
    updateContent({ format: newFormat });
  }, [updateContent]);
  
  /**
   * Format a result based on the selected format
   * A local implementation since it was removed from the hook for simplification
   */
  const formatResultBasedOnFormat = (result: any, format: 'json' | 'text'): string => {
    try {
      if (format === 'json') {
        // If it's already a string but looks like JSON, try to parse and re-stringify for formatting
        if (typeof result === 'string') {
          try {
            const parsed = JSON.parse(result);
            return JSON.stringify(parsed, null, 2);
          } catch {
            // If it's not valid JSON, try to return as is
            return result;
          }
        }
        
        // If it's an object, stringify it
        if (result && typeof result === 'object') {
          return JSON.stringify(result, null, 2);
        }
        
        // Fall back to string representation
        return String(result);
      } else {
        // For text format
        if (typeof result === 'string') {
          return result;
        }
        
        // If it's an object, convert to string with some formatting
        if (result && typeof result === 'object') {
          // Simple formatting to make it readable, but not JSON-specific
          return JSON.stringify(result, null, 2);
        }
        
        // Fall back to string representation
        return String(result);
      }
    } catch (error) {
      console.error("Error formatting result:", error);
      return String(result);
    }
  };

  // Simplified function to determine the displayed content directly from nodeState and format
  const renderContentForDisplay = () => {
    if (nodeState?.status === 'success') {
      if (nodeState.result !== null && nodeState.result !== undefined) {
        return formatResultBasedOnFormat(nodeState.result, format);
      }
      return '결과 없음'; // Success but result is null/undefined
    }
    if (nodeState?.status === 'running') return '처리 중...';
    if (nodeState?.status === 'error') return `오류: ${nodeState.error}`;
    // Default to idle or unrun state
    return '실행 대기 중...';
  };

  // Handler for the download button
  const handleDownload = useCallback(() => {
    if (nodeState?.status !== 'success' || nodeState.result === null || nodeState.result === undefined) {
      console.warn('No successful result to download.');
      return;
    }
    const contentToDownload = formatResultBasedOnFormat(nodeState.result, format);
    const fileExtension = format === 'json' ? 'json' : 'txt';
    const mimeType = format === 'json' ? 'application/json' : 'text/plain';
    const filename = `output-${id}.${fileExtension}`;

    downloadFile(contentToDownload, filename, mimeType);

  }, [nodeState?.status, nodeState?.result, format, id, formatResultBasedOnFormat]);

  // Log state just before rendering
  const displayContent = renderContentForDisplay();
  console.log(`[OutputNode ${id}] Rendering:`, {
    status: nodeState?.status,
    result: nodeState?.result,
    format: format,
    displayContent: displayContent
  });

  return (
    <NodeErrorBoundary nodeId={id}>
      <div className="relative w-[350px]">
        {/* Input Handle */}
        <Handle
          type="target"
          position={Position.Left}
          id="target"
          isConnectable={isConnectable}
          style={{
            background: '#a855f7',
            border: '1px solid white',
            width: '8px',
            height: '8px',
            top: '50%',
            transform: 'translateY(-50%)',
            left: '-4px',
            zIndex: 50
          }}
        />

        {/* Output Handle */}
        <Handle
          type="source"
          position={Position.Right}
          id="source"
          isConnectable={isConnectable}
          style={{
            background: '#a855f7',
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
        <div className={clsx(
          'w-full border rounded-md shadow-sm',
          {
            'border-purple-500 ring-2 ring-purple-300': selected,
            'border-gray-300': !selected
          },
          nodeState?.status === 'error' ? 'bg-red-50 border-red-300' : 'bg-white'
        )}>
          {/* Header with format toggle and download button */}
          <div className="flex justify-between items-center px-3 py-1.5 bg-gray-50 border-b rounded-t-md">
            <div className="flex items-center space-x-1">
              <button 
                onClick={() => handleFormatChange('json')} 
                className={clsx(
                  'px-2 py-0.5 rounded text-xs font-medium',
                  format === 'json' ? 'bg-purple-200 text-purple-800' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                )}
              >
                JSON
              </button>
              <button 
                onClick={() => handleFormatChange('text')} 
                className={clsx(
                  'px-2 py-0.5 rounded text-xs font-medium',
                  format === 'text' ? 'bg-purple-200 text-purple-800' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                )}
              >
                TEXT
              </button>
            </div>
            <button 
              onClick={handleDownload}
              title="Download Result"
              className="text-gray-400 hover:text-purple-600 disabled:text-gray-300 disabled:cursor-not-allowed p-0.5 rounded hover:bg-gray-200"
              disabled={nodeState?.status !== 'success' || nodeState.result === null || nodeState.result === undefined}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
          </div>

          {/* Content Area */}
          <pre 
            className="text-xs font-mono p-3 overflow-auto max-h-[200px] bg-white rounded-b-md break-words whitespace-pre-wrap"
            style={{ minHeight: '50px' }}
          >
            {displayContent}
          </pre>
        </div>
      </div>
    </NodeErrorBoundary>
  );
};

export default OutputNode; 