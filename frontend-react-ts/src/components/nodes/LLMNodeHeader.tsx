import React, { useCallback } from 'react';
import { Node } from 'reactflow';
import { NodeViewMode } from '../../store/viewModeStore';
import { useIsRootNode } from '../../store/useNodeGraphUtils';
import { useNodeState } from '../../store/useNodeStateStore';
import { NodeHeader } from './shared/NodeHeader';
import { LLMNodeData, NodeData } from '../../types/nodes';
import { useFlowStructureStore, setNodes as setStructureNodes } from '../../store/useFlowStructureStore';
import { FlowExecutionContext } from '../../core/FlowExecutionContext';
import { NodeFactory } from '../../core/NodeFactory';
import { registerAllNodeTypes } from '../../core/NodeRegistry';
import { v4 as uuidv4 } from 'uuid';
import { buildExecutionGraphFromFlow, getExecutionGraph } from '../../store/useExecutionGraphStore';
import { getNodeContent, setNodeContent, LLMNodeContent } from '../../store/nodeContentStore';

interface LLMNodeHeaderProps {
  id: string;
  data: LLMNodeData;
  viewMode: NodeViewMode;
  onToggleView: () => void;
  isContentDirty?: boolean;
}

const LLMNodeHeader: React.FC<LLMNodeHeaderProps> = ({ 
  id, 
  data,
  viewMode, 
  onToggleView,
  isContentDirty
}) => {
  const { nodes, edges } = useFlowStructureStore();
  const isRootNode = useIsRootNode(id);
  const nodeState = useNodeState(id);
  
  const initialLabel = getNodeContent<LLMNodeContent>(id, 'llm')?.label || data.label || 'LLM';
  
  const handleLabelUpdate = useCallback((nodeId: string, newLabel: string) => {
    setNodeContent<LLMNodeContent>(nodeId, { label: newLabel });
    
    setStructureNodes(nodes.map((node: Node<NodeData>) => 
        node.id === nodeId ? { ...node, data: { ...node.data, label: newLabel } } : node
    ));
  }, [nodes]);

  const handleRun = useCallback(() => {
    const isGroupRootNode = isRootNode || !!document.querySelector(`[data-id="${id}"]`)?.closest('[data-type="group"]');
    if (isGroupRootNode) {
      const executionId = `exec-${uuidv4()}`;
      const executionContext = new FlowExecutionContext(executionId);
      
      executionContext.setTriggerNode(id);
      
      console.log(`[LlmNodeHeader] Starting execution for node ${id}`);
      
      buildExecutionGraphFromFlow(nodes, edges);
      const executionGraph = getExecutionGraph();
      
      const nodeFactory = new NodeFactory();
      registerAllNodeTypes();
      
      const nodeStructure = nodes.find(n => n.id === id);
      if (!nodeStructure) {
        console.error(`[LlmNodeHeader] Node structure ${id} not found.`);
        return;
      }
      
      const nodeContent = getNodeContent<LLMNodeContent>(id, 'llm');
      if (!nodeContent) {
          console.error(`[LlmNodeHeader] Node content for ${id} not found.`);
          return;
      }
      
      const combinedNodeData = {
          ...nodeStructure.data,
          ...nodeContent
      };

      console.log(`[LlmNodeHeader] Creating instance with combined data:`, combinedNodeData);
      
      const nodeInstance = nodeFactory.create(
        id,
        nodeStructure.type as string,
        combinedNodeData,
        executionContext
      );
      
      nodeInstance.property = {
        ...nodeInstance.property,
        nodes,
        edges,
        nodeFactory,
        executionGraph
      };
      
      nodeInstance.process({}).catch((error: Error) => {
        console.error(`[LlmNodeHeader] Error executing node ${id}:`, error);
      });
    }
  }, [id, isRootNode, nodes, edges]);

  return (
    <NodeHeader
      nodeId={id}
      label={initialLabel}
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

export default LLMNodeHeader; 