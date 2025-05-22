// src/components/nodes/LLMNodeHeader.tsx
import React, { memo, useCallback, useState } from 'react';
import { Node } from '@xyflow/react';
import { NodeViewMode } from '../../store/viewModeStore';
import { useIsRootNode } from '../../store/useNodeGraphUtils';
import { useNodeState } from '../../store/useNodeStateStore';
import { NodeHeader } from './shared/NodeHeader';
import { LLMNodeData, NodeData } from '../../types/nodes';
import { LLMNodeContent } from '../../types/nodes';
import { useFlowStructureStore, setNodes as setStructureNodes } from '../../store/useFlowStructureStore';
import { FlowExecutionContext } from '../../core/FlowExecutionContext';
import { NodeFactory } from '../../core/NodeFactory';
import { registerAllNodeTypes } from '../../core/NodeRegistry';
import { v4 as uuidv4 } from 'uuid';
import { getNodeContent, setNodeContent } from '../../store/useNodeContentStore';
import { runSingleNodeExecution } from '../../core/executionUtils';

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
  
  const initialLabel = (getNodeContent(id, 'llm') as LLMNodeContent)?.label || data.label || 'LLM';
  
  const handleLabelUpdate = useCallback((nodeId: string, newLabel: string) => {
    setNodeContent<LLMNodeContent>(nodeId, { label: newLabel });
    
    setStructureNodes(nodes.map((node: Node<NodeData>) => 
        node.id === nodeId ? { ...node, data: { ...node.data, label: newLabel } } : node
    ));
  }, [nodes]);

  const handleRun = useCallback(() => {
    const isGroupRootNode = isRootNode || !!document.querySelector(`[data-id="${id}"]`)?.closest('[data-type="group"]');
    if (isGroupRootNode) {
      console.log(`[LlmNodeHeader] Triggering single execution for node ${id}`);
      runSingleNodeExecution(id).catch((error: Error) => {
        console.error(`[LlmNodeHeader] Error during single execution for node ${id}:`, error);
      });
    } else {
       console.log(`[LlmNodeHeader] Skipping run for non-root node ${id}`);
    }
  }, [id, isRootNode]);

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