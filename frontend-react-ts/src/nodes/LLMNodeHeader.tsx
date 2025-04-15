import React, { useCallback, useRef } from 'react';
import { NodeViewMode, VIEW_MODES } from '../../store/viewModeStore';
import { useIsRootNode } from '../../store/useNodeGraphUtils';
import { useNodeState } from '../../store/useNodeStateStore';
import { NodeHeader } from './shared/NodeHeader';
import { LLMNodeData } from '../../types/nodes';
import { useFlowStructureStore } from '../../store/useFlowStructureStore';
import { FlowExecutionContext } from '../../core/FlowExecutionContext';
import { NodeFactory } from '../../core/NodeFactory';
import { registerAllNodeTypes } from '../../core/NodeRegistry';
import { v4 as uuidv4 } from 'uuid';
import { buildExecutionGraphFromFlow, getExecutionGraph } from '../../store/useExecutionGraphStore';

interface LLMNodeHeaderProps {
  id: string;
  data: LLMNodeData;
  viewMode: NodeViewMode;
  onToggleView: () => void;
  isContentDirty?: boolean;
}

export const LLMNodeHeader: React.FC<LLMNodeHeaderProps> = ({ 
  id, 
  data, 
  viewMode, 
  onToggleView,
  isContentDirty
}) => {
  const { updateNode, nodes, edges } = useFlowStructureStore();
  const isRootNode = useIsRootNode(id);
  const nodeState = useNodeState(id);
  
  const handleLabelUpdate = useCallback((nodeId: string, newLabel: string) => {
    updateNode(nodeId, (node) => ({
      ...node,
      data: { ...data, label: newLabel }
    }));
  }, [updateNode, data]);

  const handleRun = useCallback(() => {
    const isGroupRootNode = isRootNode || !!document.querySelector(`[data-id="${id}"]`)?.closest('[data-type="group"]');
    if (isGroupRootNode) {
      // Create execution context
      const executionId = `exec-${uuidv4()}`;
      const executionContext = new FlowExecutionContext(executionId);
      
      // Set trigger node
      executionContext.setTriggerNode(id);
      
      console.log(`[LLMNode] Starting execution for node ${id}`);
      
      // Build execution graph
      buildExecutionGraphFromFlow(nodes, edges);
      const executionGraph = getExecutionGraph();
      
      // Create node factory
      const nodeFactory = new NodeFactory();
      registerAllNodeTypes(nodeFactory);
      
      // Find the node data
      const node = nodes.find(n => n.id === id);
      if (!node) {
        console.error(`[LLMNode] Node ${id} not found.`);
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
        nodeFactory,
        executionGraph
      };
      
      // Execute the node
      nodeInstance.process({}).catch((error: Error) => {
        console.error(`[LLMNode] Error executing node ${id}:`, error);
      });
    }
  }, [id, isRootNode, nodes, edges]);

  return (
    <NodeHeader
      nodeId={id}
      label={data.label || 'LLM'}
      placeholderLabel="LLM"
      isRootNode={isRootNode}
      isRunning={nodeState?.status === 'running'}
      viewMode={viewMode}
      themeColor="blue"
      isContentDirty={isContentDirty}
      onRun={handleRun}
      onLabelUpdate={handleLabelUpdate}
      onToggleView={onToggleView}
    />
  );
}; 