import React, { useRef, useEffect, useCallback } from 'react';
import { Handle, Position } from 'reactflow';
import { OutputNodeData, LLMResult } from '../../types/nodes';
import { useNodeState } from '../../store/useNodeStateStore';
import clsx from 'clsx';
import NodeErrorBoundary from './NodeErrorBoundary';
import { downloadFile } from '../../utils/downloadUtils';
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
  const contentRef = useRef<HTMLPreElement>(null);
  const previousContentRef = useRef<string | undefined>(data.content);
  
  const { updateContent, content } = useNodeContent(id);
  const format = content?.format || 'text';
  
  const handleContentChange = useCallback((text: string) => {
    updateContent({ result: text });
  }, [updateContent]);
  
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

  // Function to handle the JSON/TEXT toggle effect on data.content
  const handleFormatToggle = useCallback((newFormat: 'json' | 'text') => {
    if (newFormat === format) return;
    
    handleFormatChange(newFormat);
    
    if (nodeState?.result) {
      const newContent = formatResultBasedOnFormat(nodeState.result, newFormat);
      // Only update content if it's different using deep equality
      if (!isEqual(newContent, data.content) && !isEqual(newContent, previousContentRef.current)) {
        previousContentRef.current = newContent;
        handleContentChange(newContent);
      }
    }
  }, [format, nodeState?.result, data.content, handleFormatChange, handleContentChange, formatResultBasedOnFormat]);

  // Update data.content when node result or format changes
  useEffect(() => {
    // Skip effect if node state hasn't changed or if we're not in a valid state
    if (!nodeState) return;

    console.log(`[OutputNode ${id}] Node state changed: ${nodeState.status}, result:`, nodeState.result);

    let newContent: string | undefined;

    if (nodeState.status === 'success' && nodeState.result !== null && nodeState.result !== undefined) {
      newContent = formatResultBasedOnFormat(nodeState.result, format);
      
      // Only update if content has actually changed - prevents infinite updates
      if (!isEqual(newContent, data.content)) {
        console.log(`[OutputNode ${id}] Setting success content: "${newContent}"`);
        handleContentChange(newContent);
      } else {
        console.log(`[OutputNode ${id}] Skipping success content update - content unchanged: "${newContent}"`);
      }
      
      // Don't continue with the normal deep equality check as we've already handled it
      return;
    } else if (nodeState.status === 'running') {
      newContent = '처리 중...';
    } else if (nodeState.status === 'error') {
      newContent = `오류: ${nodeState.error}`;
    } else if (nodeState.status === 'idle') {
      newContent = '실행 대기 중...';
    } else {
      newContent = '결과 없음';
    }

    // Only update if content has actually changed using deep equality
    if (newContent !== undefined && 
        !isEqual(newContent, data.content) && 
        !isEqual(newContent, previousContentRef.current)) {
      console.log(`[OutputNode ${id}] Updating content from "${data.content}" to "${newContent}" (prev: "${previousContentRef.current}")`);
      previousContentRef.current = newContent;
      handleContentChange(newContent);
    }
  }, [nodeState?.status, nodeState?.result, nodeState?.error, format, data.content, handleContentChange, formatResultBasedOnFormat, id]);

  // Update previousContentRef when data.content changes externally
  useEffect(() => {
    if (!isEqual(data.content, previousContentRef.current)) {
      previousContentRef.current = data.content;
    }
  }, [data.content]);

  // This function now determines the *displayed* content in the node using the formatter
  const renderContentForDisplay = () => {
    if (nodeState?.status === 'success' && nodeState.result !== null && nodeState.result !== undefined) {
      return formatResultBasedOnFormat(nodeState.result, format);
    }
    // 실행이 끝났거나 idle일 때, store에 저장된 content가 있으면 그걸 표시
    if (content?.content) {
      return content.content;
    }
    if (nodeState?.status === 'running') return '처리 중...';
    if (nodeState?.status === 'error') return `오류: ${nodeState.error}`;
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
                onClick={() => handleFormatToggle('json')}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  format === 'json' 
                    ? 'bg-purple-500 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                title="Show as formatted JSON"
              >
                JSON
              </button>
              <button
                onClick={() => handleFormatToggle('text')}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  format === 'text' 
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