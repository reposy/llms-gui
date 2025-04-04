import React, { useCallback } from 'react';
import { useSelector } from 'react-redux';
import { store } from '../../store/store';
import type { Node } from 'reactflow';
import { NodeData, GroupNodeData, InputNodeData } from '../../types/nodes';
import { useNodeState, useExecutionState, executeFlowForGroup } from '../../store/flowExecutionStore';
import { GroupExecutionItemResult } from '../../types/execution';

// Import new component modules
import GroupInfoBox from '../group/GroupInfoBox';
import GroupNodesList from '../group/GroupNodesList';
import GroupResultList from '../group/GroupResultList';
import GroupExecutionToolbar from '../group/GroupExecutionToolbar';

interface GroupDetailSidebarProps {
  selectedNodeId: string | null;
}

export const GroupDetailSidebar: React.FC<GroupDetailSidebarProps> = ({ selectedNodeId }) => {
  const allNodes = store.getState().flow.nodes;
  const nodeState = useNodeState(selectedNodeId || '');
  const executionState = useExecutionState();

  // Handle the case when no node is selected
  if (!selectedNodeId) {
    return (
      <div className="w-80 flex-none bg-white border-l border-gray-200 p-6 shadow-lg z-10">
        <p className="text-sm text-gray-500 italic">Select a group node to see details.</p>
      </div>
    ); 
  }

  // Get data for the selected group and source nodes
  const groupNodes = allNodes.filter((node: Node<NodeData>) => node.parentNode === selectedNodeId);
  const groupNode = allNodes.find((node: Node<NodeData>) => node.id === selectedNodeId) as Node<GroupNodeData> | undefined;
  const sourceNodeId = groupNode?.data.iterationConfig?.sourceNodeId;
  const sourceNode = allNodes.find((node: Node<NodeData>) => node.id === sourceNodeId) as Node<InputNodeData> | undefined;

  // Get results from node state
  const groupResults = nodeState.result as GroupExecutionItemResult[] | undefined;

  // Handle group execution
  const handleRunGroup = useCallback(() => {
    if (!selectedNodeId) return;
    console.log("Triggering execution for group:", selectedNodeId);
    executeFlowForGroup(selectedNodeId);
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