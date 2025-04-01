import React, { useRef, useEffect, useCallback } from 'react';
import { Handle, Position } from 'reactflow';
import { OutputNodeData, LLMResult } from '../../types/nodes';
import { useNodeState } from '../../store/flowExecutionStore';
import { useDispatch } from 'react-redux';
import { updateNodeData } from '../../store/flowSlice';
import clsx from 'clsx';
import NodeErrorBoundary from './NodeErrorBoundary';

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
      // JSON Mode: Always stringify the entire result object prettily
      if (typeof result === 'object') {
        try {
          return JSON.stringify(result, null, 2);
        } catch (e) {
          console.error("Error stringifying result for JSON display:", e);
          return String(result); // Fallback
        }
      }
      return String(result); // Non-objects as string
    } else {
      // TEXT Mode: Prioritize 'content' or 'text' properties, otherwise stringify
      if (typeof result === 'object') {
        if ('content' in result && result.content !== null && result.content !== undefined) {
          return typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
        } 
        if ('text' in result && result.text !== null && result.text !== undefined) {
          return String(result.text);
        }
        // Fallback for objects in text mode if no specific field found
        return JSON.stringify(result); 
      }
      return String(result); // Primitives as string
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
            <div className="flex gap-1">
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