import React, { useCallback } from 'react';
import type { Node } from '@xyflow/react';
import { NodeData, GroupNodeData, InputNodeData } from '../../types/nodes';
import { useNodeState } from '../../store/useNodeStateStore';
import { useExecutionController, useExecutionState } from '../../store/useExecutionController';
import { useFlowStructureStore } from '../../store/useFlowStructureStore';
import { GroupExecutionItemResult } from '../../types/execution';

// Import new component modules
import GroupInfoBox from '../group/GroupInfoBox';
import GroupNodesList from '../group/GroupNodesList';
import GroupResultList from '../group/GroupResultList';
import GroupExecutionToolbar from '../group/GroupExecutionToolbar';
// Import useGroupNodeData hook
import { useGroupNodeData } from '../../hooks/useGroupNodeData';

interface GroupDetailSidebarProps {
  selectedNodeIds: string[];
}

export const GroupDetailSidebar: React.FC<GroupDetailSidebarProps> = ({ selectedNodeIds }) => {
  const { nodes: allNodes } = useFlowStructureStore();
  // 단일 그룹 노드만 허용
  const selectedNodeId = selectedNodeIds.length === 1 ? selectedNodeIds[0] : null;
  const nodeState = useNodeState(selectedNodeId || '');
  const executionState = useExecutionState();

  // 무선택 또는 다중 선택 시 안내
  if (!selectedNodeId) {
    return (
      <div className="w-80 flex-none bg-white border-l border-gray-200 p-6 shadow-lg z-10">
        <p className="text-sm text-gray-500 italic">그룹 노드를 하나만 선택하세요.</p>
      </div>
    ); 
  }

  // Get data for the selected group and source nodes
  const groupNodes = allNodes.filter((node: Node<NodeData>) => node.parentId === selectedNodeId);
  const groupNode = allNodes.find((node: Node<NodeData>) => node.id === selectedNodeId) as Node<GroupNodeData> | undefined;
  const sourceNodeId = groupNode?.data.iterationConfig?.sourceNodeId;
  const sourceNode = allNodes.find((node: Node<NodeData>) => node.id === sourceNodeId) as Node<InputNodeData> | undefined;

  // Get the latest label using the hook
  const { label } = useGroupNodeData({ nodeId: selectedNodeId || '' });

  // Get results from node state
  const groupResults = nodeState.result as GroupExecutionItemResult[] | undefined;

  // Handle group execution
  const handleRunGroup = useCallback(() => {
    if (!selectedNodeId) return;
    console.log("Triggering execution for group:", selectedNodeId);
    useExecutionController.getState().executeFlowForGroup(selectedNodeId);
  }, [selectedNodeId]);

  // Handle JSON export
  const handleExportJson = useCallback(() => {
    if (!groupNode || nodeState.status !== 'success' || !Array.isArray(nodeState.result)) return;

    const resultsToExport = nodeState.result as GroupExecutionItemResult[];
    const jsonString = JSON.stringify(resultsToExport, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${groupNode.data.label || groupNode.id}-results.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [groupNode, nodeState.status, nodeState.result]);

  return (
    <div className="w-96 flex-none bg-white border-l border-gray-200 p-6 shadow-lg z-10 overflow-y-auto flex flex-col h-full">
      {/* Group info and execution status */}
      <GroupInfoBox 
        groupNode={groupNode}
        label={label}
        type={groupNode?.type}
        sourceNode={sourceNode}
        sourceNodeId={sourceNodeId}
        status={nodeState.status}
        error={nodeState.error}
        currentIterationIndex={executionState.currentIterationIndex}
        totalItems={executionState.currentGroupTotalItems}
      />
      
      {/* List of nodes in the group */}
      <GroupNodesList groupNodes={groupNodes} />
      
      {/* Results list */}
      <GroupResultList 
        status={nodeState.status} 
        results={groupResults} 
      />
      
      {/* Execution controls */}
      <GroupExecutionToolbar
        status={nodeState.status}
        results={groupResults}
        onRunGroup={handleRunGroup}
        onExportJson={handleExportJson}
      />
    </div>
  );
};

GroupDetailSidebar.displayName = 'GroupDetailSidebar'; 