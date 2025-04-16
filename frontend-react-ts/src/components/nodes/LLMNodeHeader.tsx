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
import { getNodeContent } from '../../store/useNodeContentStore';
import { Node } from 'reactflow';
import { NodeData } from '../../types/nodes';

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
  const { nodes, edges } = useFlowStructureStore();
  const isRootNode = useIsRootNode(id);
  const nodeState = useNodeState(id);
  
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
      registerAllNodeTypes();
      
      // Find the node data
      const node = nodes.find(n => n.id === id);
      if (!node) {
        console.error(`[LLMNode] Node ${id} not found.`);
        return;
      }
      
      // nodeContent 가져오기
      const nodeContent = getNodeContent(id);
      
      // 노드 인스턴스에 필요한 속성 준비
      const nodeProps = {
        ...node.data,
        // NodeContentStore에서 가져온 필수 속성들을 추가
        prompt: nodeContent.prompt || node.data.prompt || '',
        model: nodeContent.model || node.data.model || 'llama3.1',
        provider: nodeContent.provider || node.data.provider || 'ollama',
        temperature: nodeContent.temperature ?? node.data.temperature ?? 0.7,
        mode: nodeContent.mode || node.data.mode || 'text'
      };
      
      // Create the node instance with properly merged props
      const nodeInstance = nodeFactory.create(
        id,
        node.type as string,
        nodeProps,
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
      
      // 노드 실행 전 필수 속성 확인
      if (!nodeInstance.property.prompt || !nodeInstance.property.model || !nodeInstance.property.provider) {
        console.error(`[LLMNode] Node ${id} is missing required properties:`, {
          prompt: nodeInstance.property.prompt,
          model: nodeInstance.property.model,
          provider: nodeInstance.property.provider
        });
        return;
      }
      
      // Execute the node
      nodeInstance.process({}).catch(error => {
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
      onToggleView={onToggleView}
      onLabelUpdate={() => {}}
    />
  );
}; 