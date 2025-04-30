// src/components/nodes/JSONExtractorNode.tsx
import React, { useCallback, useEffect, useState } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { JSONExtractorNodeData } from '../../types/nodes';
import { useIsRootNode } from '../../store/useNodeGraphUtils';
import { useNodeState } from '../../store/useNodeStateStore';
import { VIEW_MODES } from '../../store/viewModeStore';
import { NodeStatus } from '../../types/execution';
import clsx from 'clsx';
import NodeErrorBoundary from './NodeErrorBoundary';
import { NodeHeader } from './shared/NodeHeader';
import { NodeStatusIndicator } from './shared/NodeStatusIndicator';
import { useStore as useViewModeStore, useNodeViewMode } from '../../store/viewModeStore';
import { useFlowStructureStore } from '../../store/useFlowStructureStore';
import { v4 as uuidv4 } from 'uuid';
import { FlowExecutionContext } from '../../core/FlowExecutionContext';
import { NodeFactory } from '../../core/NodeFactory';
import { registerAllNodeTypes } from '../../core/NodeRegistry';
import { buildExecutionGraphFromFlow, getExecutionGraph } from '../../store/useExecutionGraphStore';
import { useNodeContentStore } from '../../store/useNodeContentStore';
import { setNodeContent } from '../../store/useNodeContentStore';
import { setNodes } from '../../store/useFlowStructureStore';

interface Props {
  id: string;
  data: JSONExtractorNodeData;
  isConnectable: boolean;
  selected?: boolean;
}

const JSONExtractorNode: React.FC<Props> = ({ id, data, isConnectable, selected }) => {
  // Use updateNode from Zustand store
  const { nodes, edges } = useFlowStructureStore();
  
  const isRootNode = useIsRootNode(id);
  const nodeState = useNodeState(id);
  const { getZoom } = useReactFlow();
  const setNodeContentLocal = useNodeContentStore(state => state.setNodeContent);
  const setNodesLocal = useFlowStructureStore(state => state.setNodes);
  
  // Get from Zustand store instead of Redux
  const viewMode = useNodeViewMode(id);
  const globalViewMode = useViewModeStore(state => state.globalViewMode);
  const setNodeViewMode = useViewModeStore(state => state.setNodeViewMode);
  
  const [pathDraft, setPathDraft] = useState(data.path || '');
  const [isComposing, setIsComposing] = useState(false);

  // Update drafts when data changes externally
  useEffect(() => {
    if (!isComposing) {
      setPathDraft(data.path || '');
    }
  }, [data.path, isComposing]);

  const handlePathChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newPath = e.target.value;
    setPathDraft(newPath);
    
    // If you need to update path, use your content hook or setContent here
  }, []);

  // Encapsulate label update logic
  const handleLabelUpdate = useCallback((nodeId: string, newLabel: string) => {
    // 1. Update NodeContentStore (config state)
    setNodeContentLocal(nodeId, { label: newLabel });

    // 2. Update FlowStructureStore (React Flow rendering state)
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
    setNodesLocal(updatedNodes);
    console.log(`[JSONExtractorNode] Updated label for node ${nodeId} in both stores.`);
  }, [nodes, setNodesLocal, setNodeContentLocal]);

  const handleRun = useCallback(() => {
    // Create execution context
    const executionId = `exec-${uuidv4()}`;
    const executionContext = new FlowExecutionContext(executionId);
    
    // Set trigger node
    executionContext.setTriggerNode(id);
    
    console.log(`[JSONExtractorNode] Starting execution for node ${id}`);
    
    // Build execution graph
    buildExecutionGraphFromFlow(nodes, edges);
    const executionGraph = getExecutionGraph();
    
    // Create node factory
    const nodeFactory = new NodeFactory();
    registerAllNodeTypes();
    
    // Find the node data
    const node = nodes.find(n => n.id === id);
    if (!node) {
      console.error(`[JSONExtractorNode] Node ${id} not found.`);
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
      console.error(`[JSONExtractorNode] Error executing node ${id}:`, error);
    });
  }, [id, nodes, edges]);

  const toggleNodeView = () => {
    setNodeViewMode({ 
      nodeId: id,
      mode: viewMode === VIEW_MODES.COMPACT ? VIEW_MODES.EXPANDED : VIEW_MODES.COMPACT
    });
  };

  // Auto-collapse based on zoom level if in auto mode
  useEffect(() => {
    if (globalViewMode === VIEW_MODES.AUTO) {
      const zoom = getZoom();
      const shouldBeCompact = zoom < 0.7;
      setNodeViewMode({ 
        nodeId: id, 
        mode: shouldBeCompact ? VIEW_MODES.COMPACT : VIEW_MODES.EXPANDED 
      });
    }
  }, [globalViewMode, getZoom, id, setNodeViewMode]);

  // Safe access to node state status - converting to a type that NodeStatusIndicator accepts
  const nodeStatus: NodeStatus = (nodeState?.status && ['idle', 'running', 'success', 'error'].includes(nodeState.status)) 
    ? nodeState.status as NodeStatus
    : 'idle';

  return (
    <NodeErrorBoundary nodeId={id}>
      <div className="relative w-[350px]">
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

        <div
          className={clsx(
            'px-4 py-2 shadow-md rounded-md bg-white',
            'border',
            selected
              ? 'border-gray-500 ring-2 ring-gray-300 ring-offset-1 shadow-lg'
              : 'border-gray-200 shadow-sm'
          )}
        >
          <NodeHeader
            nodeId={id}
            label={data.label || 'JSON Extractor'}
            placeholderLabel="JSON Extractor"
            isRootNode={isRootNode}
            isRunning={nodeStatus === 'running'}
            viewMode={viewMode}
            themeColor="purple"
            onRun={handleRun}
            onLabelUpdate={handleLabelUpdate}
            onToggleView={toggleNodeView}
          />

          <div className={`space-y-2 transition-all duration-300 ${
            viewMode === VIEW_MODES.COMPACT ? 'max-h-[100px]' : 'max-h-[500px]'
          } overflow-hidden`}>
            {viewMode === VIEW_MODES.COMPACT ? (
              <>
                <div className="text-sm text-gray-600">
                  Extract: {data.path || 'No path set'}
                </div>
                <NodeStatusIndicator status={nodeStatus} error={nodeState?.error} />
              </>
            ) : (
              <div className="space-y-2">
                <div className="space-y-1">
                  <div className="text-xs font-medium text-gray-600">JSON Path</div>
                  <input
                    type="text"
                    value={pathDraft}
                    onChange={handlePathChange}
                    onCompositionStart={() => setIsComposing(true)}
                    onCompositionEnd={() => setIsComposing(false)}
                    placeholder="Enter path (e.g., data.items[0].name)"
                    className="w-full px-2 py-1 text-sm bg-white border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <div className="text-xs text-gray-500">
                    Use dot notation to access nested fields (e.g., response.data.token)
                  </div>
                </div>

                <NodeStatusIndicator status={nodeStatus} error={nodeState?.error} />

                {nodeState?.result && (
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-gray-600">Extracted Value</div>
                    <div className="p-2 text-xs font-mono bg-gray-50 rounded border border-gray-200 max-h-[100px] overflow-auto">
                      {typeof nodeState.result === 'string' 
                        ? nodeState.result 
                        : JSON.stringify(nodeState.result, null, 2)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </NodeErrorBoundary>
  );
};

export default JSONExtractorNode; 