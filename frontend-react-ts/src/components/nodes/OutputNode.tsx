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
  
  const handleFormatChange = useCallback((format: 'json' | 'text') => {
    if (format === data.format) return; // Don't dispatch if format hasn't changed
    
    dispatch(updateNodeData({
      nodeId: id,
      data: { 
        ...data, 
        format,
        // Reset content to ensure it's reformatted
        content: nodeState?.result ? formatContent(nodeState.result, format) : data.content
      }
    }));
  }, [dispatch, id, data, nodeState]);

  // Format content based on type and selected format
  const formatContent = (result: any, format: 'json' | 'text'): string => {
    if (!result) return '';

    // Handle LLM results
    if (typeof result === 'object' && ('content' in result)) {
      const llmResult = result as LLMResult;
      const content = llmResult.content;

      if (format === 'text') {
        return typeof content === 'string' ? content : JSON.stringify(content, null, 2);
      } else {
        // For JSON format, if content is already an object, stringify it
        // If it's a string that looks like JSON, try to parse and re-stringify it
        if (typeof content === 'object') {
          return JSON.stringify(content, null, 2);
        }
        try {
          if (typeof content === 'string' && 
             (content.trim().startsWith('{') || content.trim().startsWith('['))) {
            return JSON.stringify(JSON.parse(content), null, 2);
          }
        } catch (e) {
          // If parsing fails, return the original content
          console.warn('Failed to parse JSON content:', e);
        }
        return JSON.stringify(llmResult, null, 2);
      }
    }

    // Handle other types of results
    if (typeof result === 'object') {
      return format === 'json' ? JSON.stringify(result, null, 2) : JSON.stringify(result);
    }

    return String(result);
  };

  // Update content when node state changes
  useEffect(() => {
    if (nodeState?.result) {
      const formattedContent = formatContent(nodeState.result, data.format);
      if (formattedContent !== data.content) {
        dispatch(updateNodeData({
          nodeId: id,
          data: { ...data, content: formattedContent }
        }));
      }
    }
  }, [nodeState?.result, data.format]);

  // Check if content overflows one line
  const isContentOverflowing = (): boolean => {
    const element = contentRef.current;
    if (!element) return false;
    
    const lineHeight = parseInt(getComputedStyle(element).lineHeight);
    return element.scrollHeight > lineHeight;
  };

  const renderContent = () => {
    if (!nodeState || nodeState.status === 'idle') {
      return '실행 대기 중...';
    }

    if (nodeState.status === 'running') {
      return '처리 중...';
    }

    if (nodeState.status === 'error') {
      return `오류: ${nodeState.error}`;
    }

    if (!nodeState.result) {
      return '결과 없음';
    }

    return formatContent(nodeState.result, data.format);
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
              className="whitespace-pre-wrap font-mono overflow-hidden text-ellipsis"
            >
              {renderContent()}
            </pre>
          </div>
        </div>
      </div>
    </NodeErrorBoundary>
  );
};

export default OutputNode; 