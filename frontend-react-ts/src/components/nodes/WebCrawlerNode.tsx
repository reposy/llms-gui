import React, { useCallback, useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { WebCrawlerNodeData } from '../../types/nodes';
import NodeErrorBoundary from './NodeErrorBoundary';
import { NodeHeader } from './shared/NodeHeader';
import { NodeBody } from './shared/NodeBody';
import { NodeFooter } from './shared/NodeFooter';
import clsx from 'clsx';
import { useNodeState } from '../../store/useNodeStateStore';
import { executeFlow } from '../../store/useExecutionController';
import { VIEW_MODES } from '../../store/viewModeStore';

const WebCrawlerNode: React.FC<NodeProps<WebCrawlerNodeData>> = ({ id, data, selected }) => {
  // Get node execution state
  const nodeState = useNodeState(id);
  const isRunning = nodeState.status === 'running';
  const hasError = nodeState.status === 'error';
  
  // Add view mode state
  const [viewMode, setViewMode] = useState<typeof VIEW_MODES.COMPACT | typeof VIEW_MODES.EXPANDED>(VIEW_MODES.EXPANDED);
  
  // Handle run button click
  const handleRunNode = useCallback(() => {
    executeFlow(id);
  }, [id]);
  
  // Handle label update
  const handleLabelUpdate = useCallback((nodeId: string, newLabel: string) => {
    // This should update the node label in your store
    console.log(`Update label for node ${nodeId} to ${newLabel}`);
  }, []);
  
  // Handle toggle view
  const handleToggleView = useCallback(() => {
    setViewMode(current => 
      current === VIEW_MODES.COMPACT ? VIEW_MODES.EXPANDED : VIEW_MODES.COMPACT
    );
  }, []);
  
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
          nodeId={id}
          label={data.label || "Web Crawler"}
          placeholderLabel="Web Crawler"
          isRootNode={true}
          isRunning={isRunning}
          viewMode={viewMode}
          themeColor="blue"
          onRun={handleRunNode}
          onLabelUpdate={handleLabelUpdate}
          onToggleView={handleToggleView}
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
            
            {/* Error message display */}
            {hasError && nodeState.error && (
              <div className="text-xs text-red-500 mt-2">
                {nodeState.error}
              </div>
            )}
          </div>
        </NodeBody>
        
        <NodeFooter>
          {/* Actions or status indicators */}
          {isRunning && (
            <div className="text-xs text-blue-500">Processing...</div>
          )}
        </NodeFooter>
        
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