import React, { useRef, useEffect, useCallback } from 'react';
import { Handle, Position } from 'reactflow';
import { OutputNodeData, LLMResult } from '../../types/nodes';
import { useNodeState } from '../../store/flowExecutionStore';
import { useDispatch } from 'react-redux';
import { updateNodeData } from '../../store/flowSlice';
import clsx from 'clsx';
import NodeErrorBoundary from './NodeErrorBoundary';
import { downloadFile } from '../../utils/downloadUtils';

interface Props {
  id: string;
  data: OutputNodeData;
  selected?: boolean;
  isConnectable?: boolean;
}

const OutputNode: React.FC<Props> = ({ id, data, selected, isConnectable = true }) => {
  const dispatch = useDispatch();
  const nodeState = useNodeState(id);
  const contentRef = useRef<HTMLPreElement>(null);
  
  // Function to handle the JSON/TEXT toggle effect on data.content
  const handleFormatChange = useCallback((format: 'json' | 'text') => {
    if (format === data.format) return;
    dispatch(updateNodeData({
      nodeId: id,
      data: { 
        ...data, 
        format,
        // Update data.content based on the *new* format toggle state
        content: nodeState?.result ? formatResultBasedOnFormat(nodeState.result, format) : data.content
      }
    }));
  }, [dispatch, id, data, nodeState?.result]);

  // Combined function: Formats result based on the provided format toggle state
  // This is used both for updating data.content and for rendering the display
  const formatResultBasedOnFormat = (result: any, format: 'json' | 'text'): string => {
    if (result === null || result === undefined) return '';

    if (format === 'json') {
      // JSON Mode: Stringify if object, otherwise convert to string
      if (typeof result === 'object') {
        try {
          return JSON.stringify(result, null, 2);
        } catch (e) {
          console.error("Error stringifying result for JSON display:", e);
          return String(result); // Fallback
        }
      }
      // For non-objects in JSON mode, just convert to string (might be number, boolean, etc.)
      return String(result); 
    } else {
      // TEXT Mode: Prioritize 'content' or 'text' properties, otherwise stringify basic object or convert primitive
      if (typeof result === 'object') {
        if ('content' in result && result.content !== null && result.content !== undefined) {
          // If content itself is an object, stringify it for text view
          return typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
        } 
        if ('text' in result && result.text !== null && result.text !== undefined) {
          return String(result.text);
        }
        // Fallback for objects in text mode if no specific field found (simple stringify)
        return JSON.stringify(result); 
      }
      // For primitives in text mode, just convert to string
      return String(result); 
    }
  };

  // Update data.content when node result or format changes
  useEffect(() => {
    let newContent: string | undefined;

    if (nodeState?.status === 'success' && nodeState.result !== null && nodeState.result !== undefined) {
      newContent = formatResultBasedOnFormat(nodeState.result, data.format);
    } else if (nodeState?.status === 'running') {
      newContent = '처리 중...';
    } else if (nodeState?.status === 'error') {
      newContent = `오류: ${nodeState.error}`;
    } else if (nodeState?.status === 'idle') {
      newContent = '실행 대기 중...';
    } else { // Handle case where status is success but result is null/undefined
       newContent = '결과 없음';
    }

    // Only dispatch if the content actually needs updating
    if (newContent !== undefined && newContent !== data.content) {
      dispatch(updateNodeData({
        nodeId: id,
        data: { ...data, content: newContent }
      }));
    }
    // Dependencies updated
  }, [nodeState?.status, nodeState?.result, nodeState?.error, data.format, data.content, dispatch, id]);

  // This function now determines the *displayed* content in the node using the formatter
  const renderContentForDisplay = () => {
    if (!nodeState || nodeState.status === 'idle') return '실행 대기 중...';
    if (nodeState.status === 'running') return '처리 중...';
    if (nodeState.status === 'error') return `오류: ${nodeState.error}`;
    if (nodeState.status === 'success' && nodeState.result !== null && nodeState.result !== undefined) {
      // Use the single formatter, respecting data.format for display
      return formatResultBasedOnFormat(nodeState.result, data.format);
    }
    return '결과 없음';
  };

  // Handler for the download button
  const handleDownload = useCallback(() => {
    if (nodeState?.status !== 'success' || nodeState.result === null || nodeState.result === undefined) {
      console.warn('No successful result to download.');
      return;
    }
    const contentToDownload = formatResultBasedOnFormat(nodeState.result, data.format);
    const fileExtension = data.format === 'json' ? 'json' : 'txt';
    const mimeType = data.format === 'json' ? 'application/json' : 'text/plain';
    const filename = `output-${id}.${fileExtension}`;

    downloadFile(contentToDownload, filename, mimeType);

  }, [nodeState?.status, nodeState?.result, data.format, id]);

  return (
    <NodeErrorBoundary nodeId={id}>
      <div className="relative w-[350px]">
        {/* Input Handle */}
        <Handle
          type="target"
          position={Position.Left}
          id={`${id}-target`}
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
          id={`${id}-source`}
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
          'px-4 py-2 shadow-md rounded-md bg-white',
          'border',
          selected
            ? 'border-purple-500 ring-2 ring-purple-300 ring-offset-1 shadow-lg'
            : 'border-purple-200 shadow-sm'
        )}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              <div className="font-bold text-purple-500">{data.label || 'Output'}</div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleFormatChange('json')}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  data.format === 'json' 
                    ? 'bg-purple-500 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                title="Show as formatted JSON"
              >
                JSON
              </button>
              <button
                onClick={() => handleFormatChange('text')}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  data.format === 'text' 
                    ? 'bg-purple-500 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                title="Show as plain text"
              >
                TEXT
              </button>
              <button
                onClick={handleDownload}
                disabled={nodeState?.status !== 'success' || nodeState.result === null || nodeState.result === undefined}
                className="p-1 text-gray-400 rounded transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Download result"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>
            </div>
          </div>
          <div className="mt-2 text-sm">
            <pre 
              ref={contentRef}
              className="whitespace-pre-wrap font-mono overflow-hidden text-ellipsis line-clamp-3"
              title={renderContentForDisplay()}
            >
              {renderContentForDisplay()}
            </pre>
          </div>
        </div>
      </div>
    </NodeErrorBoundary>
  );
};

export default OutputNode; 