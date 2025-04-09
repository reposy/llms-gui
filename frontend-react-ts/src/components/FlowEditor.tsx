import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ReactFlowProvider } from 'reactflow';
import { FlowCanvas, FlowCanvasApi } from './FlowCanvas';
import { NodeConfigSidebar } from './sidebars/NodeConfigSidebar';
import { GroupDetailSidebar } from './sidebars/GroupDetailSidebar';
import { FlowManager } from './FlowManager';
import { NodeData, NodeType } from '../types/nodes';
import type { Node } from 'reactflow';
import { createNewNode } from '../utils/flowUtils';
import { setNodeContent, getAllNodeContents } from '../store/useNodeContentStore';
// Import from Zustand store
import { useNodes, useEdges, useSelectedNodeId, useSelectedNodeIds, setNodes, setEdges, setSelectedNodeId } from '../store/useFlowStructureStore';
// Import StoreInitializer
import StoreInitializer from './StoreInitializer';
// Import history and dirty tracking
import { pushSnapshot } from '../store/useHistoryStore';
import { useDirtyTracker } from '../store/useDirtyTracker';
import { pushCurrentSnapshot } from '../utils/historyUtils';
import { StatusBar } from './StatusBar';

export const FlowEditor = () => {
  // Use Zustand hooks
  const nodes = useNodes();
  const edges = useEdges();
  const selectedNodeId = useSelectedNodeId();
  const selectedNodeIds = useSelectedNodeIds();
  const [isExecuting, setIsExecuting] = useState(false);

  // Use dirty tracker
  const { isDirty } = useDirtyTracker();

  const reactFlowApiRef = useRef<FlowCanvasApi | null>(null);
  
  // Create initial snapshot when component mounts
  useEffect(() => {
    if (nodes.length > 0 || edges.length > 0) {
      // Create a snapshot for the history on initial load
      pushCurrentSnapshot();
      
      if (isDirty) {
        console.log('[FlowEditor] Flow has been modified since last save');
      }
    }
  }, []); // Empty dependency array ensures this runs only once on mount

  const handleRegisterApi = useCallback((api: FlowCanvasApi) => {
    reactFlowApiRef.current = api;
    console.log("[FlowEditor] React Flow API registered:", api);
  }, []);

  const handleAddNode = useCallback((type: NodeType) => {
    if (!reactFlowApiRef.current?.addNodes) {
      console.error("React Flow addNodes API not available yet.");
      return;
    }

    // Generate a random position for the new node
    const position = { x: Math.random() * 400, y: Math.random() * 400 };
    
    // Create a new node using the helper function
    const newNode = createNewNode(type, position);
    
    // Check if a group node is currently selected
    const selectedGroup = selectedNodeId ? nodes.find(n => n.id === selectedNodeId && n.type === 'group') : null;
    
    // If a group is selected, make the new node a child of the group
    if (selectedGroup) {
      newNode.parentNode = selectedGroup.id;
      // Use relative positioning within the group
      newNode.position = {
        x: 100 + Math.random() * 200,
        y: 100 + Math.random() * 100
      };
      console.log(`[FlowEditor] Adding node to group ${selectedGroup.id}`);
    }

    console.log(`[FlowEditor] Calling reactFlowApi.addNodes with:`, newNode);
    reactFlowApiRef.current.addNodes([newNode]);
    
    // Update Zustand state with the exact same node that was added to React Flow
    const updatedNodes = [...nodes, newNode];
    setNodes(updatedNodes);
    
    // Add node data to Zustand nodeContentStore without triggering a snapshot
    setNodeContent(newNode.id, { ...newNode.data, isDirty: false });
    console.log(`[FlowEditor] Synced new node data to nodeContentStore:`, newNode.data);
    
    // Create a single snapshot after all state updates
    pushCurrentSnapshot();
  }, [nodes, edges, selectedNodeId]);

  const handleNodeSelect = useCallback((node: Node<NodeData> | null) => {
    setSelectedNodeId(node?.id || null);
  }, []);

  const handleRunFlow = useCallback(async () => {
    // Ensure the latest structure is committed before running
    if (reactFlowApiRef.current?.commitStructure) {
      console.log('[FlowEditor] Committing structure before running flow...');
      reactFlowApiRef.current.commitStructure();
    } else {
      console.warn('[FlowEditor] ReactFlow API not available for committing structure.');
    }
    
    setIsExecuting(true);

    try {
      const startNodes = nodes.filter(node => 
        !edges.some(edge => edge.target === node.id)
      );

      for (const node of startNodes) {
        const executeButton = document.querySelector(`[data-node-id="${node.id}"] button`) as HTMLButtonElement;
        executeButton?.click();

        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error('플로우 실행 중 오류:', error);
    } finally {
      setIsExecuting(false);
    }
  }, [nodes, edges, reactFlowApiRef]);

  // Use the selected node from Zustand nodes state
  const selectedNode = nodes.find(node => node.id === selectedNodeId);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      <StoreInitializer />
      
      <div className="flex-none h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between shadow-sm z-20">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-gray-900">Flow Editor</h1>
          {isDirty && <span className="text-sm text-yellow-600">*unsaved changes</span>}
        </div>
        <div className="flex items-center gap-4">
          <button
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2 text-sm font-medium disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed"
            onClick={handleRunFlow}
            disabled={isExecuting || nodes.length === 0}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {isExecuting ? '실행 중...' : '플로우 실행'}
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-none w-20 bg-white border-r border-gray-200 p-4 shadow-lg z-10">
          <div className="space-y-4">
            <button
              className="w-full aspect-square rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md hover:shadow-lg transition-all duration-200 flex flex-col items-center justify-center gap-2 text-sm font-medium"
              onClick={() => handleAddNode('llm')}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              LLM
            </button>
            <button
              className="w-full aspect-square rounded-xl bg-gradient-to-br from-green-500 to-green-600 text-white shadow-md hover:shadow-lg transition-all duration-200 flex flex-col items-center justify-center gap-2 text-sm font-medium"
              onClick={() => handleAddNode('api')}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              API
            </button>
            <button
              className="w-full aspect-square rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-md hover:shadow-lg transition-all duration-200 flex flex-col items-center justify-center gap-2 text-sm font-medium"
              onClick={() => handleAddNode('output')}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              출력
            </button>
            <button
              className="w-full aspect-square rounded-xl bg-gradient-to-br from-gray-500 to-gray-600 text-white shadow-md hover:shadow-lg transition-all duration-200 flex flex-col items-center justify-center gap-2 text-sm font-medium"
              onClick={() => handleAddNode('input')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              입력
            </button>
            <button
              className="w-full aspect-square rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-md hover:shadow-lg transition-all duration-200 flex flex-col items-center justify-center gap-2 text-sm font-medium"
              onClick={() => handleAddNode('group')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              Group
            </button>
            <button
              className="w-full aspect-square rounded-xl bg-gradient-to-br from-yellow-500 to-yellow-600 text-white shadow-md hover:shadow-lg transition-all duration-200 flex flex-col items-center justify-center gap-2 text-sm font-medium"
              onClick={() => handleAddNode('conditional')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2zM5 10h14M5 14h14" />
              </svg>
              Conditional
            </button>
            <button
              className="w-full aspect-square rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-md hover:shadow-lg transition-all duration-200 flex flex-col items-center justify-center gap-2 text-sm font-medium"
              onClick={() => handleAddNode('merger')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h4" />
              </svg>
              Merger
            </button>
          </div>
        </div>

        <div className="flex-1 relative">
          <FlowManager flowApi={reactFlowApiRef} />
          <ReactFlowProvider>
            <FlowCanvas 
              registerReactFlowApi={handleRegisterApi}
              onNodeSelect={handleNodeSelect}
            />
          </ReactFlowProvider>
        </div>

        {selectedNodeIds.length === 1 && (
          selectedNode?.type === 'group' ? (
            <GroupDetailSidebar 
              selectedNodeId={selectedNode.id} 
            />
          ) : (
            <NodeConfigSidebar 
              selectedNodeId={selectedNode?.id}
            />
          )
        )}
        {selectedNodeIds.length > 1 && (
          <div className="w-96 bg-white border-l border-gray-200 overflow-y-auto p-4">
            <h3 className="text-lg font-semibold mb-4">Multiple Nodes Selected</h3>
            <p className="text-sm text-gray-600">
              {selectedNodeIds.length} nodes selected
            </p>
            <div className="mt-4">
              <ul className="space-y-2">
                {selectedNodeIds.map(id => {
                  const node = nodes.find(n => n.id === id);
                  return (
                    <li key={id} className="p-2 bg-gray-50 rounded">
                      <span className="font-medium">{node?.data?.label || node?.type}</span>
                      <span className="text-xs text-gray-500 ml-2">({node?.type})</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}
      </div>
      
      {/* Status bar for debug info */}
      <StatusBar />
    </div>
  );
}; 