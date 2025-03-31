import React, { useRef, useEffect } from 'react';
import { Handle, Position } from 'reactflow';
import { OutputNodeData, LLMResult, NodeExecutionStateData } from '../../types/nodes';
import { useFlowExecution } from '../../store/flowExecutionStore';
import { useDispatch } from 'react-redux';
import { updateNodeData } from '../../store/flowSlice';

interface Props {
  id: string;
  data: OutputNodeData;
}

const OutputNode: React.FC<Props> = ({ id, data }) => {
  const dispatch = useDispatch();
  const flowExecution = useFlowExecution();
  const executionState = flowExecution.getNodeState(id) as NodeExecutionStateData;
  const contentRef = useRef<HTMLPreElement>(null);
  
  const handleFormatChange = (format: 'json' | 'text') => {
    dispatch(updateNodeData({
      nodeId: id,
      data: { ...data, format }
    }));
  };

  // Update data.content when execution state changes
  useEffect(() => {
    if (executionState?.result) {
      const content = formatContent(executionState.result, data.format);
      if (content !== data.content) {
        dispatch(updateNodeData({
          nodeId: id,
          data: { ...data, content }
        }));
      }
    }
  }, [executionState?.result, data.format, id]);

  const formatContent = (result: any, format: 'json' | 'text'): string => {
    if (!result) return '';

    if (format === 'json') {
      try {
        const jsonResult = typeof result === 'string' ? JSON.parse(result) : result;
        return JSON.stringify(jsonResult, null, 2);
      } catch {
        return String(result);
      }
    } else {
      if (typeof result === 'string') {
        return result;
      }
      if ('content' in result || 'text' in result) {
        const llmResult = result as LLMResult;
        return llmResult.content || llmResult.text || JSON.stringify(result);
      }
      return JSON.stringify(result);
    }
  };

  const renderContent = () => {
    if (!executionState || executionState.status === 'idle') {
      return '실행 대기 중...';
    }

    if (executionState.status === 'running') {
      return '처리 중...';
    }

    if (executionState.status === 'error') {
      return `오류: ${executionState.error}`;
    }

    if (!executionState.result) {
      return '결과 없음';
    }

    return formatContent(executionState.result, data.format);
  };

  // Check if content overflows one line
  const isContentOverflowing = (): boolean => {
    const element = contentRef.current;
    if (!element) return false;
    
    const lineHeight = parseInt(getComputedStyle(element).lineHeight);
    return element.scrollHeight > lineHeight;
  };

  // Get truncated content for preview
  const getTruncatedContent = (content: string): string => {
    const lines = content.split('\n');
    if (lines.length > 1) {
      return lines[0] + '...';
    }
    return content;
  };

  return (
    <div className="px-4 py-2 shadow-md rounded-md bg-white border-2 border-purple-500 min-w-[200px]">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center">
          <div className="w-3 h-3 bg-purple-500 rounded-full mr-2" />
          <div className="font-bold text-purple-500">{data.label || 'Output'}</div>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => handleFormatChange('json')}
            className={`px-2 py-1 text-xs rounded ${
              data.format === 'json' 
                ? 'bg-purple-500 text-white' 
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            JSON
          </button>
          <button
            onClick={() => handleFormatChange('text')}
            className={`px-2 py-1 text-xs rounded ${
              data.format === 'text' 
                ? 'bg-purple-500 text-white' 
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            TEXT
          </button>
        </div>
      </div>
      <div className="mt-2 text-sm">
        <pre 
          ref={contentRef}
          className="whitespace-pre-wrap font-mono overflow-hidden text-ellipsis"
          style={{
            maxHeight: '1.5em',
            lineHeight: '1.5em'
          }}
        >
          {renderContent()}
        </pre>
      </div>

      <Handle
        type="target"
        position={Position.Left}
        style={{
          width: '8px',
          height: '8px',
          backgroundColor: 'rgb(168 85 247)',
          left: '-4px',
          top: '50%',
          transform: 'translateY(-50%)',
        }}
      />
    </div>
  );
};

export default OutputNode; 