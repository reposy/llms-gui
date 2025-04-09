import React, { useCallback } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { WebCrawlerNodeData } from '../../types/nodes';
import NodeErrorBoundary from './NodeErrorBoundary';
import { NodeHeader } from './shared/NodeHeader';
import { NodeBody } from './shared/NodeBody';
import { NodeFooter } from './shared/NodeFooter';
import clsx from 'clsx';
import { executeFlow, useNodeState } from '../../store/flowExecutionStore';

const WebCrawlerNode: React.FC<NodeProps<WebCrawlerNodeData>> = ({ id, data, selected }) => {
  // Get node execution state
  const nodeState = useNodeState(id);
  const isRunning = nodeState.status === 'running';
  const hasError = nodeState.status === 'error';
  
  // Handle run button click
  const handleRunNode = useCallback(() => {
    executeFlow(id);
  }, [id]);
  
  // Format URL for display
  const displayUrl = data.url 
    ? (data.url.length > 30 ? data.url.substring(0, 27) + '...' : data.url)
    : 'No URL set';
  
  // Count extractors
  const extractorCount = data.extractSelectors ? Object.keys(data.extractSelectors).length : 0;
  
  return (
    <NodeErrorBoundary nodeId={id}>
      <div 
        className={clsx(
          "node-container rounded-lg border-2 shadow-sm w-72",
          selected ? "border-blue-500" : "border-blue-300",
          hasError ? "border-red-500" : ""
        )}
      >
        <NodeHeader 
          type="Web Crawler" 
          label={data.label || "Web Crawler"} 
          color="bg-blue-500"
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.083 9h1.946c.089-1.546.383-2.97.837-4.118A6.004 6.004 0 004.083 9zM10 2a8 8 0 100 16 8 8 0 000-16zm0 2c-.076 0-.232.032-.465.262-.238.234-.497.623-.737 1.182-.389.907-.673 2.142-.766 3.556h3.936c-.093-1.414-.377-2.649-.766-3.556-.24-.56-.5-.948-.737-1.182C10.232 4.032 10.076 4 10 4zm3.971 5c-.089-1.546-.383-2.97-.837-4.118A6.004 6.004 0 0115.917 9h-1.946zm-2.003 2H8.032c.093 1.414.377 2.649.766 3.556.24.56.5.948.737 1.182.233.23.389.262.465.262.076 0 .232-.032.465-.262.238-.234.498-.623.737-1.182.389-.907.673-2.142.766-3.556zm1.166 4.118c.454-1.147.748-2.572.837-4.118h1.946a6.004 6.004 0 01-2.783 4.118zm-6.268 0C6.412 13.97 6.118 12.546 6.03 11H4.083a6.004 6.004 0 002.783 4.118z" clipRule="evenodd" />
            </svg>
          }
        />
        
        <NodeBody>
          <div className="p-3 space-y-3">
            <div className="text-xs">
              <span className="font-semibold">URL:</span> 
              <span className="ml-1 font-mono text-blue-600 break-all">{displayUrl}</span>
            </div>
            
            {data.waitForSelector && (
              <div className="text-xs">
                <span className="font-semibold">Wait for:</span> 
                <span className="ml-1 font-mono">{data.waitForSelector}</span>
              </div>
            )}
            
            {extractorCount > 0 && (
              <div className="text-xs">
                <span className="font-semibold">Extractors:</span> 
                <span className="ml-1">{extractorCount} defined</span>
              </div>
            )}
            
            <div className="text-xs">
              <span className="font-semibold">Output:</span> 
              <span className="ml-1 capitalize">{data.outputFormat || 'full'}</span>
            </div>
          </div>
        </NodeBody>
        
        <NodeFooter
          onRunClick={handleRunNode}
          isRunning={isRunning}
          hasError={hasError}
          errorMessage={nodeState.error}
        />
        
        {/* Input handle */}
        <Handle
          type="target"
          position={Position.Left}
          id={`${id}-target`}
          style={{ background: '#4F46E5' }}
        />
        
        {/* Output handle */}
        <Handle
          type="source"
          position={Position.Right}
          id={`${id}-source`}
          style={{ background: '#4F46E5' }}
        />
      </div>
    </NodeErrorBoundary>
  );
};

export default WebCrawlerNode; 