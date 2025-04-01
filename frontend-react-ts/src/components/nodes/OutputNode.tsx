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

// Helper to format result specifically for node display (prioritizes JSON for objects)
const formatResultForNodeDisplay = (result: any): string => {
  if (result === null || result === undefined) return '';
  if (typeof result === 'string') return result;
  if (typeof result === 'object') {
    try {
      return JSON.stringify(result, null, 2); // Always format objects nicely for display
    } catch (e) {
      console.error("Error stringifying result for display:", e);
      return String(result); // Fallback
    }
  }
  return String(result); // Handle primitives
};

const OutputNode: React.FC<Props> = ({ id, data, selected, isConnectable = true }) => {
  const dispatch = useDispatch();
  const nodeState = useNodeState(id);
  const contentRef = useRef<HTMLPreElement>(null);
  
  // This function remains for handling the JSON/TEXT toggle effect on data.content
  const handleFormatChange = useCallback((format: 'json' | 'text') => {
    if (format === data.format) return;
    dispatch(updateNodeData({
      nodeId: id,
      data: { 
        ...data, 
        format,
        // Trigger reformat based on toggle
        content: nodeState?.result ? formatContentBasedOnToggle(nodeState.result, format) : data.content
      }
    }));
  }, [dispatch, id, data, nodeState?.result]); // Added nodeState.result dependency

  // This formats content based on the selected toggle (used for data.content update)
  const formatContentBasedOnToggle = (result: any, format: 'json' | 'text'): string => {
    if (!result) return '';
    if (typeof result === 'object' && ('content' in result)) {
      const llmResult = result as LLMResult;
      const content = llmResult.content;
      if (format === 'text') {
        return typeof content === 'string' ? content : JSON.stringify(content);
      } else { // JSON format requested
        if (typeof content === 'object') return JSON.stringify(content, null, 2);
        try {
          if (typeof content === 'string' && (content.trim().startsWith('{') || content.trim().startsWith('['))) {
            return JSON.stringify(JSON.parse(content), null, 2);
          }
        } catch (e) { /* Ignore parse error, treat as string */ }
        // If it's not parseable JSON or not an object, stringify the whole LLMResult for JSON view
        return JSON.stringify(llmResult, null, 2); 
      }
    }
    if (typeof result === 'object') {
      return format === 'json' ? JSON.stringify(result, null, 2) : JSON.stringify(result);
    }
    return String(result);
  };

  // Update data.content when node result or format changes
  useEffect(() => {
    if (nodeState?.status === 'success' && nodeState.result) {
      const formattedContent = formatContentBasedOnToggle(nodeState.result, data.format);
      // Only dispatch if the formatted content actually changes
      if (formattedContent !== data.content) {
         dispatch(updateNodeData({
           nodeId: id,
           data: { ...data, content: formattedContent }
         }));
      }
    } else if (nodeState?.status === 'running' && data.content !== '처리 중...') {
        dispatch(updateNodeData({ nodeId: id, data: { ...data, content: '처리 중...' } }));
    } else if (nodeState?.status === 'error' && data.content !== `오류: ${nodeState.error}`) {
        dispatch(updateNodeData({ nodeId: id, data: { ...data, content: `오류: ${nodeState.error}` } }));
    } else if (nodeState?.status === 'idle' && data.content !== '실행 대기 중...') {
        dispatch(updateNodeData({ nodeId: id, data: { ...data, content: '실행 대기 중...' } }));
    }
    // Add all relevant dependencies
  }, [nodeState?.status, nodeState?.result, nodeState?.error, data.format, data.content, dispatch, id]);

  // This function now determines the *displayed* content in the node
  const renderContentForDisplay = () => {
    if (!nodeState || nodeState.status === 'idle') {
      return '실행 대기 중...';
    }
    if (nodeState.status === 'running') {
      return '처리 중...';
    }
    if (nodeState.status === 'error') {
      return `오류: ${nodeState.error}`;
    }
    if (nodeState.status === 'success' && nodeState.result !== null && nodeState.result !== undefined) {
      // Use the new display-specific formatter
      return formatResultForNodeDisplay(nodeState.result);
    }
    return '결과 없음'; // Fallback if success but result is null/undefined
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