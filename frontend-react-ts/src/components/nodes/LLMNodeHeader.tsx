// src/components/nodes/LLMNodeHeader.tsx
import React, { useCallback } from 'react';
import { Node } from '@xyflow/react';
import { NodeViewMode } from '../../store/viewModeStore';
import { useIsRootNode } from '../../store/useNodeGraphUtils';
import { useNodeState } from '../../store/useNodeStateStore';
import { NodeHeader } from './shared/NodeHeader';
import { LlmNodeProperty } from '../../types/nodes';
import { useFlowStructureStore, setNodes as setStructureNodes } from '../../store/useFlowStructureStore';
import { getNodeProperty, setNodeProperty } from '../../store/useNodePropertyStore';
import { runSingleNodeExecution } from '../../core/executionUtils';

interface LLMNodeHeaderProps {
  id: string;
  data: LlmNodeProperty;
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
  const { nodes } = useFlowStructureStore();
  const isRootNode = useIsRootNode(id);
  const nodeState = useNodeState(id);
  
  const initialLabel = (getNodeProperty(id, 'llm') as LlmNodeProperty)?.label || data.label || 'LLM';
  
  const handleLabelUpdate = useCallback((nodeId: string, newLabel: string) => {
    setNodeProperty(nodeId, { label: newLabel });
    
    setStructureNodes(nodes.map((node: Node<any>) => 
        node.id === nodeId ? { ...node, data: { ...node.data, label: newLabel } } : node
    ));
  }, [nodes]);

  const handleRun = useCallback(() => {
    const isGroupRootNode = isRootNode || !!document.querySelector(`[data-id="${id}"]`)?.closest('[data-type="group"]');
    if (isGroupRootNode) {
      // console.log(`[LlmNodeHeader] Triggering single execution for node ${id}`);
      runSingleNodeExecution(id).catch((error: Error) => {
        // console.error(`[LlmNodeHeader] Error during single execution for node ${id}:`, error);
      });
    } else {
       // console.log(`[LlmNodeHeader] Skipping run for non-root node ${id}`);
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