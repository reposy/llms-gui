import React, { useCallback, useState } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import NodeErrorBoundary from './NodeErrorBoundary';
import { NodeHeader } from './shared/NodeHeader';
import { NodeBody } from './shared/NodeBody';
import clsx from 'clsx';
import { useNodeState } from '../../store/useNodeStateStore';
import { VIEW_MODES } from '../../store/viewModeStore';
import { useFlowStructureStore, setNodes as setNodesGlobal } from '../../store/useFlowStructureStore';
import { WebCrawlerNodeData, WebCrawlerNodeContent } from '../../types/nodes';
import { useNodeContent, setNodeContent as setNodeContentGlobal } from '../../store/useNodeContentStore';
import { NodeStatusIndicator } from './shared/NodeStatusIndicator';
import { NodeStatus } from '../../types/execution';
import { runFlow } from '../../core/FlowRunner';

const WebCrawlerNode: React.FC<NodeProps> = ({ id, data, selected, isConnectable = true }) => {
  // Use useNodeContent hook correctly
  const { content: crawlerData, updateContent } = useNodeContent<WebCrawlerNodeContent>(id, 'web-crawler');

  // Get node execution state
  const nodeState = useNodeState(id);
  const isRunning = nodeState.status === 'running';
  const hasError = nodeState.status === 'error';
  
  // Add view mode state
  const [viewMode, setViewMode] = useState<typeof VIEW_MODES.COMPACT | typeof VIEW_MODES.EXPANDED>(VIEW_MODES.EXPANDED);
  
  // Get flow structure
  const { nodes, edges } = useFlowStructureStore();
  // Get the setNodes function from the store
  const setNodes = useFlowStructureStore(state => state.setNodes);
  
  // Handle run button click - Use runFlow helper
  const handleRun = useCallback(() => {
    console.log(`[WebCrawlerNode] Triggering execution for node ${id} via runFlow`);
    // 수정된 부분: nodes, edges 인자 제거하고 노드 ID만 전달
    runFlow(id).catch((error: Error) => {
        console.error(`Error running flow triggered by WebCrawlerNode ${id}:`, error);
        // Optionally, mark the node as error in UI state here if needed
    });
  }, [id]); // 의존성 배열에서 nodes, edges 제거
  
  // Handle label update
  const handleLabelUpdate = useCallback((nodeId: string, newLabel: string) => {
    // 1. Update NodeContentStore using the updateContent function from the hook
    updateContent({ label: newLabel }); 

    // 2. Update FlowStructureStore (React Flow rendering state)
    const { nodes, setNodes } = useFlowStructureStore.getState(); // Get latest nodes/setNodes
    const updatedNodes = nodes.map(node =>
      node.id === nodeId
        ? {
            ...node,
            data: {
              ...node.data,
              label: newLabel
            }
          }
        : node
    );
    setNodes(updatedNodes);
    console.log(`[WebCrawlerNode] Updated label for node ${nodeId} in both stores.`);
  }, [id, updateContent]);
  
  // Handle toggle view
  const handleToggleView = useCallback(() => {
    setViewMode(current => 
      current === VIEW_MODES.COMPACT ? VIEW_MODES.EXPANDED : VIEW_MODES.COMPACT
    );
  }, []);
  
  // Map node state status to the expected type for NodeStatusIndicator
  const nodeStatus: NodeStatus = 
    (nodeState?.status && ['running', 'success', 'error'].includes(nodeState.status))
    ? nodeState.status as NodeStatus
    : 'idle';
  
  // Format URL for display
  const displayUrl = crawlerData?.url
    ? (crawlerData.url.length > 30 ? crawlerData.url.substring(0, 27) + '...' : crawlerData.url)
    : 'No URL set';
  
  // Count extractors
  const extractorCount = crawlerData?.extractSelectors ? Object.keys(crawlerData.extractSelectors).length : 0;
  
  return (
    <NodeErrorBoundary nodeId={id}>
      <div 
        className={clsx(
          "relative",
          "node-container rounded-lg border-2 shadow-sm w-72",
          selected ? "border-blue-500" : "border-blue-300",
          hasError ? "border-red-500" : ""
        )}
      >
        {/* Status Indicator - Positioned top-right */}
        <div className="absolute top-2 right-2 z-10">
          <NodeStatusIndicator status={nodeStatus} error={nodeState?.error} />
        </div>

        <NodeHeader 
          nodeId={id}
          label={crawlerData?.label || "Web Crawler"}
          placeholderLabel="Web Crawler"
          isRootNode={true}
          isRunning={isRunning}
          viewMode={viewMode}
          themeColor="blue"
          onRun={handleRun}
          onLabelUpdate={handleLabelUpdate}
          onToggleView={handleToggleView}
        />
        
        <NodeBody>
          <div className="p-3 space-y-3">
            <div className="text-xs">
              <span className="font-semibold">URL:</span> 
              <span className="ml-1 font-mono text-blue-600">{displayUrl}</span>
            </div>
            
            {crawlerData?.waitForSelector && (
              <div className="text-xs">
                <span className="font-semibold">Wait for:</span> 
                <span className="ml-1 font-mono">{crawlerData.waitForSelector}</span>
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
              <span className="ml-1 capitalize">{crawlerData?.outputFormat || 'full'}</span>
            </div>
            
            {/* Error message display */}
            {hasError && nodeState.error && (
              <div className="text-xs text-red-500 mt-2">
                {nodeState.error}
              </div>
            )}
          </div>
        </NodeBody>
        
        {/* Input handle */}
        <Handle
          type="target"
          position={Position.Left}
          id="target"
          isConnectable={isConnectable}
          style={{
            background: "#22c55e",
            border: "1px solid white",
            width: "8px",
            height: "8px",
            top: "50%",
            transform: "translateY(-50%)",
            left: "-4px",
            zIndex: 50,
          }}
        />
        
        {/* Output handle */}
        <Handle
          type="source"
          position={Position.Right}
          id="source"
          isConnectable={isConnectable}
          style={{
            background: "#22c55e",
            border: "1px solid white",
            width: "8px",
            height: "8px",
            top: "50%",
            transform: "translateY(-50%)",
            right: "-4px",
            zIndex: 50,
          }}
        />
      </div>
    </NodeErrorBoundary>
  );
};

export default WebCrawlerNode; 