import React, { useCallback, useState } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { WebCrawlerNodeData } from '../../types/nodes';
import NodeErrorBoundary from './NodeErrorBoundary';
import { NodeHeader } from './shared/NodeHeader';
import { NodeBody } from './shared/NodeBody';
import { NodeFooter } from './shared/NodeFooter';
import clsx from 'clsx';
import { useNodeState } from '../../store/useNodeStateStore';
import { VIEW_MODES } from '../../store/viewModeStore';
import { FlowExecutionContext } from '../../core/FlowExecutionContext';
import { NodeFactory } from '../../core/NodeFactory';
import { registerAllNodeTypes } from '../../core/NodeRegistry';
import { useFlowStructureStore } from '../../store/useFlowStructureStore';
import { v4 as uuidv4 } from 'uuid';
import { buildExecutionGraphFromFlow, getExecutionGraph } from '../../store/useExecutionGraphStore';

const WebCrawlerNode: React.FC<NodeProps<WebCrawlerNodeData>> = ({ id, data, selected, isConnectable = true }) => {
  // Get node execution state
  const nodeState = useNodeState(id);
  const isRunning = nodeState.status === 'running';
  const hasError = nodeState.status === 'error';
  
  // Add view mode state
  const [viewMode, setViewMode] = useState<typeof VIEW_MODES.COMPACT | typeof VIEW_MODES.EXPANDED>(VIEW_MODES.EXPANDED);
  
  // Get flow structure
  const { nodes, edges } = useFlowStructureStore();
  
  // Handle run button click
  const handleRun = useCallback(() => {
    // Create execution context
    const executionId = `exec-${uuidv4()}`;
    const executionContext = new FlowExecutionContext(executionId);
    
    // Set trigger node
    executionContext.setTriggerNode(id);
    
    console.log(`[WebCrawlerNode] Starting execution for node ${id}`);
    
    // Build execution graph
    buildExecutionGraphFromFlow(nodes, edges);
    const executionGraph = getExecutionGraph();
    
    // Create node factory
    const nodeFactory = new NodeFactory();
    registerAllNodeTypes();
    
    // Find the node data
    const node = nodes.find(n => n.id === id);
    if (!node) {
      console.error(`[WebCrawlerNode] Node ${id} not found.`);
      return;
    }
    
    // Create the node instance
    const nodeInstance = nodeFactory.create(
      id,
      node.type as string,
      node.data,
      executionContext
    );
    
    // Attach graph structure reference to the node property
    nodeInstance.property = {
      ...nodeInstance.property,
      nodes,
      edges,
      executionGraph
    };
    
    // Execute the node
    nodeInstance.process({}).catch(error => {
      console.error(`[WebCrawlerNode] Error executing node ${id}:`, error);
    });
  }, [id, nodes, edges]);
  
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
          onRun={handleRun}
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