import React, { useCallback } from 'react';
import { useFlowExecutionStore } from '../store/flowExecutionStore';
import { useSelector } from 'react-redux';
import { store } from '../store/store';
import { RootState } from '../store/store';
import type { Node } from 'reactflow';
import { NodeData, GroupNodeData, InputNodeData } from '../types/nodes';
import { useNodeState, useExecutionState, GroupExecutionItemResult, executeFlowForGroup } from '../store/flowExecutionStore';

interface GroupDetailSidebarProps {
  selectedNodeId: string | null;
}

export const GroupDetailSidebar: React.FC<GroupDetailSidebarProps> = ({ selectedNodeId }) => {
  const allNodes = store.getState().flow.nodes;
  const nodeState = useNodeState(selectedNodeId || '');
  const executionState = useExecutionState();

  if (!selectedNodeId) {
    return (
      <div className="w-80 flex-none bg-white border-l border-gray-200 p-6 shadow-lg z-10">
        <p className="text-sm text-gray-500 italic">Select a group node to see details.</p>
      </div>
    ); 
  }

  const groupNodes = allNodes.filter((node: Node<NodeData>) => node.parentNode === selectedNodeId);
  const groupNode = allNodes.find((node: Node<NodeData>) => node.id === selectedNodeId) as Node<GroupNodeData> | undefined;
  const sourceNodeId = groupNode?.data.iterationConfig?.sourceNodeId;
  const sourceNode = allNodes.find((node: Node<NodeData>) => node.id === sourceNodeId) as Node<InputNodeData> | undefined;
  const inputItemsCount = sourceNode?.data.items?.length ?? 0;

  const handleRunGroup = useCallback(() => {
    if (!selectedNodeId) return;
    console.log("Triggering execution for group:", selectedNodeId);
    executeFlowForGroup(selectedNodeId);
  }, [selectedNodeId]);

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

  const groupResults = nodeState.result as GroupExecutionItemResult[] | undefined;
  const hasResults = nodeState.status === 'success' && Array.isArray(groupResults) && groupResults.length > 0;

  return (
    <div className="w-96 flex-none bg-white border-l border-gray-200 p-6 shadow-lg z-10 overflow-y-auto flex flex-col h-full">
      <h2 className="text-lg font-semibold text-gray-800 mb-1 flex-shrink-0">Group: {groupNode?.data?.label || selectedNodeId}</h2>
      <p className="text-xs text-gray-500 mb-3 flex-shrink-0">
        Source: {sourceNode?.data.label || sourceNodeId || 'Not configured'} ({inputItemsCount} items)
      </p>

      <div className="mb-4 flex-shrink-0">
        {nodeState.status === 'running' && (
          <div className="p-2 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700">
            Running... Item { (executionState.currentIterationIndex ?? -1) + 1 } / { executionState.currentGroupTotalItems || 'N/A' }
          </div>
        )}
         {nodeState.status === 'error' && (
          <div className="p-2 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
            Error: {nodeState.error}
          </div>
        )}
      </div>
      
      <div className="mb-4 border-t pt-4 flex-shrink-0">
        <h3 className="text-md font-medium text-gray-700 mb-2">Nodes in Group ({groupNodes.length})</h3>
        {groupNodes.length > 0 ? (
          <ul className="space-y-1 text-xs max-h-32 overflow-y-auto border rounded-md p-1 bg-gray-50">
            {groupNodes.map((node: Node<NodeData>) => (
              <li key={node.id} className="p-1 rounded-sm">
                {node.data.label || node.type || node.id} <span className="text-gray-500">({node.type})</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500 italic">No nodes defined in this group.</p>
        )}
      </div>

      <div className="flex-grow overflow-y-auto border-t pt-4">
         <h3 className="text-md font-medium text-gray-700 mb-2">Results</h3>
        {nodeState.status === 'success' && Array.isArray(groupResults) ? (
          groupResults.length > 0 ? (
            <div className="space-y-3">
              {groupResults.map((result, index) => (
                <details key={index} className="p-2 border rounded-md bg-gray-50 text-sm">
                   <summary className="cursor-pointer flex justify-between items-center">
                      <span className="font-mono truncate flex-1 mr-2" title={String(result.item)}>
                          Item {index + 1}: {String(result.item).substring(0, 50)}{String(result.item).length > 50 ? '...' : ''}
                      </span>
                     {result.status === 'success' ? (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700">Success</span>
                      ) : (
                         <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700">Error</span>
                      )}
                  </summary>
                  <div className="mt-2 pt-2 border-t text-xs space-y-1">
                    {result.status === 'error' && (
                       <p className="text-red-600">Error: {result.error}</p>
                    )}
                     <p>
                        <span className="font-medium">Branch:</span> {result.conditionalBranch || 'N/A'}
                     </p>
                     <p className="font-medium">Final Output:</p>
                     <pre className="p-1 bg-white border rounded text-xs font-mono max-h-24 overflow-auto">
                       {result.finalOutput === null ? 'null' : typeof result.finalOutput === 'object' ? JSON.stringify(result.finalOutput, null, 2) : String(result.finalOutput)}
                     </pre>
                  </div>
                </details>
              ))}
            </div>
          ) : (
             <p className="text-sm text-gray-500 italic">Group executed successfully, but produced no results (or source was empty).</p>
          )
        ) : nodeState.status === 'idle' ? (
           <p className="text-sm text-gray-500 italic">Group has not been executed yet.</p>
        ) : nodeState.status === 'running' ? (
           <p className="text-sm text-gray-500 italic">Execution in progress...</p>
        ) : nodeState.status === 'error' ? (
           <p className="text-sm text-red-500 italic">Execution failed. See error message above.</p>
        ) : (
          <p className="text-sm text-gray-500 italic">No results available.</p>
        )}
      </div>

      <div className="mt-auto pt-4 border-t flex-shrink-0 space-y-2">
        <button
          className="w-full px-4 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleRunGroup}
        disabled={nodeState.status === 'running'}
        >
           <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          {nodeState.status === 'running' ? 'Running Group...' : 'Run Group'}
        </button>

        <button
          className="w-full px-4 py-2 rounded-lg bg-gradient-to-r from-gray-500 to-gray-600 text-white shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleExportJson}
          disabled={!hasResults}
        >
           <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
             <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
           </svg>
           Export JSON
        </button>
      </div>
    </div>
  );
};

GroupDetailSidebar.displayName = 'GroupDetailSidebar'; 