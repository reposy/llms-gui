import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { FlowCanvas, FlowCanvasApi } from './FlowCanvas';
import { NodeConfigSidebar } from './sidebars/NodeConfigSidebar';
import { GroupDetailSidebar } from './sidebars/GroupDetailSidebar';
import { FlowManager } from './FlowManager'; // Re-added import
import { NodeData, NodeType } from '../types/nodes';
import type { Node } from '@xyflow/react';
import { createNewNode, calculateNodePosition } from '../utils/flow/flowUtils';
// Import specific node content types and the generic setter
import { setNodeContent, NodeContent } from '../store/nodeContentStore'; 
// Import Zustand store hooks and actions
import { useNodes, useEdges, setNodes as setStructureNodes, useSelectedNodeIds, useFlowStructureStore } from '../store/useFlowStructureStore';
import { useDirtyTracker } from '../store/useDirtyTracker';
import { pushCurrentSnapshot } from '../utils/ui/historyUtils';
import { StatusBar } from './StatusBar';
import { runFlow } from '../core/FlowRunner';

export const FlowEditor = () => {
  const nodes = useNodes();
  const edges = useEdges();
  const selectedNodeIds = useSelectedNodeIds(); // Use the hook
  const { isDirty } = useDirtyTracker();
  const reactFlowApiRef = useRef<FlowCanvasApi | null>(null);
  const initialSnapshotCreatedRef = useRef(false);
  const hydrated = useFlowStructureStore.persist.hasHydrated(); // Use the store directly for hydration check

  useEffect(() => {
    if (hydrated && !initialSnapshotCreatedRef.current) {
      if (nodes.length > 0 || edges.length > 0) {
          console.log('[FlowEditor] Creating initial history snapshot after hydration.');
          pushCurrentSnapshot();
      }
      initialSnapshotCreatedRef.current = true;
    }
  }, [hydrated, nodes.length, edges.length]);

  const handleRegisterApi = useCallback((api: FlowCanvasApi) => {
    reactFlowApiRef.current = api;
    console.log("[FlowEditor] React Flow API registered:", api);
  }, []);

  const handleAddNode = useCallback((type: NodeType) => {
    if (!reactFlowApiRef.current) {
      console.error("React Flow API not available yet.");
      return;
    }
    const position = calculateNodePosition(nodes, null);
    const newNode = createNewNode(type, position);
    console.log(`[FlowEditor] Adding new node:`, newNode);
    
    // Update structure store
    const updatedNodes = [...nodes, newNode];
    setStructureNodes(updatedNodes); 
    
    // Add node data to content store
    const initialContent = { ...newNode.data, isDirty: false };
    setNodeContent(newNode.id, initialContent as Partial<NodeContent>); 
    console.log(`[FlowEditor] Synced new node data to nodeContentStore:`, initialContent);
    
    pushCurrentSnapshot();
  }, [nodes]);

  const handleRunFlow = useCallback(async () => {
    setIsExecuting(true);
    try {
      console.log('[FlowEditor] Running flow directly through FlowRunner...');
      await runFlow(nodes, edges); 
    } catch (error) {
      console.error('Flow execution error:', error);
    } finally {
      setIsExecuting(false);
    }
  }, [nodes, edges]);

  const [isExecuting, setIsExecuting] = useState(false);

  const selectedNode = useMemo(() => {
    if (selectedNodeIds.length === 1) {
      return nodes.find(n => n.id === selectedNodeIds[0]);
    }
    return null;
  }, [nodes, selectedNodeIds]);

  const isGroupSelected = selectedNode?.type === 'group';

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      {/* Top bar */}
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

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden relative"> {/* Added relative positioning */}
        {/* Node Palette Sidebar */}
        <div className="flex-none w-20 bg-white border-r border-gray-200 p-4 shadow-lg z-10 flex flex-col items-center space-y-4 overflow-y-auto">
            {/* ... Node buttons ... */}
            <button onClick={() => handleAddNode('llm')} title="Add LLM Node" className="w-full aspect-square rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md hover:shadow-lg transition-all duration-200 flex flex-col items-center justify-center gap-1 text-xs font-medium p-1"><svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>LLM</button>
            <button onClick={() => handleAddNode('api')} title="Add API Node" className="w-full aspect-square rounded-xl bg-gradient-to-br from-green-500 to-green-600 text-white shadow-md hover:shadow-lg transition-all duration-200 flex flex-col items-center justify-center gap-1 text-xs font-medium p-1"><svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>API</button>
             <button onClick={() => handleAddNode('output')} title="Add Output Node" className="w-full aspect-square rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-md hover:shadow-lg transition-all duration-200 flex flex-col items-center justify-center gap-1 text-xs font-medium p-1"><svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>Output</button>
            <button onClick={() => handleAddNode('input')} title="Add Input Node" className="w-full aspect-square rounded-xl bg-gradient-to-br from-gray-500 to-gray-600 text-white shadow-md hover:shadow-lg transition-all duration-200 flex flex-col items-center justify-center gap-1 text-xs font-medium p-1"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>Input</button>
            <button onClick={() => handleAddNode('group')} title="Add Group Node" className="w-full aspect-square rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-md hover:shadow-lg transition-all duration-200 flex flex-col items-center justify-center gap-1 text-xs font-medium p-1"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>Group</button>
            <button onClick={() => handleAddNode('conditional')} title="Add Conditional Node" className="w-full aspect-square rounded-xl bg-gradient-to-br from-yellow-500 to-yellow-600 text-white shadow-md hover:shadow-lg transition-all duration-200 flex flex-col items-center justify-center gap-1 text-xs font-medium p-1"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2zM5 10h14M5 14h14" /></svg>If/Else</button>
            <button onClick={() => handleAddNode('merger')} title="Add Merger Node" className="w-full aspect-square rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 text-white shadow-md hover:shadow-lg transition-all duration-200 flex flex-col items-center justify-center gap-1 text-xs font-medium p-1"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" /><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4" /><path strokeLinecap="round" strokeLinejoin="round" d="M3 12h4" /></svg>Merger</button>
            <button onClick={() => handleAddNode('json-extractor')} title="Add JSON Extractor Node" className="w-full aspect-square rounded-xl bg-gradient-to-br from-pink-500 to-pink-600 text-white shadow-md hover:shadow-lg transition-all duration-200 flex flex-col items-center justify-center gap-1 text-xs font-medium p-1"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>JSON</button>
            <button onClick={() => handleAddNode('web-crawler' as NodeType)} title="Add Web Crawler Node" className="w-full aspect-square rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-600 text-white shadow-md hover:shadow-lg transition-all duration-200 flex flex-col items-center justify-center gap-1 text-xs font-medium p-1"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" /><path strokeLinecap="round" strokeLinejoin="round" d="M10.172 13.828a4 4 0 015.656 0l4 4a4 4 0 01-5.656 5.656l-1.102-1.101" /></svg>Crawler</button>
        </div>

        {/* Main Flow Canvas Area */}
        <div className="flex-1 relative bg-gray-100">
          <ReactFlowProvider>
            {/* Add FlowManager here, above the canvas or where appropriate */}
            <FlowManager flowApi={reactFlowApiRef} />
            <FlowCanvas onNodeSelect={() => {}} registerReactFlowApi={handleRegisterApi} />
          </ReactFlowProvider>
        </div>

        {/* Right Sidebar Area */}
        <div className="flex-none w-80 border-l border-gray-200 bg-white shadow-lg z-10 overflow-y-auto">
          {isGroupSelected ? (
            <GroupDetailSidebar selectedNodeIds={selectedNodeIds} /> // Pass selectedNodeIds
          ) : (
            <NodeConfigSidebar selectedNodeIds={selectedNodeIds} />
          )}
        </div>
      </div>
      <StatusBar />
    </div>
  );
}; 