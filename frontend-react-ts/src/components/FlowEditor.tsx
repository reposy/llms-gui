import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { FlowCanvas, FlowCanvasApi } from './FlowCanvas';
import { NodeConfigSidebar } from './sidebars/NodeConfigSidebar';
import { GroupDetailSidebar } from './sidebars/GroupDetailSidebar';
import { FlowManager } from './FlowManager';
import { NodeData, NodeType } from '../types/nodes';
import type { Node } from '@xyflow/react';
import { createNewNode, calculateNodePosition, getRootNodeIds, getRootNodeIdsWithTypeConversion } from '../utils/flow/flowUtils';
import { setNodeContent, NodeContent, useNodeContentStore } from '../store/useNodeContentStore';
import { 
  useNodes, 
  useEdges, 
  setNodes as setStructureNodes,
  useSelectedNodeIds, 
  useFlowStructureStore,
  setSelectedNodeIds
} from '../store/useFlowStructureStore';
import { useDirtyTracker } from '../store/useDirtyTracker';
import { pushCurrentSnapshot } from '../utils/ui/historyUtils';
import { StatusBar } from './StatusBar';
import { runFlow } from '../core/FlowRunner';
import { addNodeToGroup } from '../utils/flow/nodeUtils';

export const FlowEditor = () => {
  const nodes = useNodes();
  const edges = useEdges();
  const selectedNodeIds = useSelectedNodeIds();
  const { isDirty } = useDirtyTracker();
  const reactFlowApiRef = useRef<FlowCanvasApi | null>(null);
  const initialSnapshotCreatedRef = useRef(false);
  const hydrated = useFlowStructureStore.persist.hasHydrated();

  const [copiedNodeId, setCopiedNodeId] = useState<string | null>(null);
  const { getNodeContent, setNodeContent: setContent } = useNodeContentStore(
    (state) => ({ getNodeContent: state.getNodeContent, setNodeContent: state.setNodeContent })
  );

  const [selectedNodeIdForSidebar, setSelectedNodeIdForSidebar] = useState<string[] | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<Node | null>(null);
  const [selectedNodesToAdd, setSelectedNodesToAdd] = useState<Node[]>([]);

  useEffect(() => {
    if (hydrated && !initialSnapshotCreatedRef.current) {
      if (nodes.length > 0 || edges.length > 0) {
          // console.log('[FlowEditor] Creating initial history snapshot after hydration.');
          pushCurrentSnapshot();
      }
      initialSnapshotCreatedRef.current = true;
    }
  }, [hydrated, nodes.length, edges.length]);

  useEffect(() => {
    if (selectedNodeIds.length > 0) {
      const selectedNodes = nodes.filter(node => selectedNodeIds.includes(node.id));
      
      const groups = selectedNodes.filter(node => node.type === 'group');
      const regularNodes = selectedNodes.filter(node => node.type !== 'group');
      
      if (groups.length === 1 && regularNodes.length > 0) {
        setSelectedGroup(groups[0]);
        setSelectedNodesToAdd(regularNodes);
      } else {
        setSelectedGroup(null);
        setSelectedNodesToAdd([]);
      }
    } else {
      setSelectedGroup(null);
      setSelectedNodesToAdd([]);
    }
  }, [selectedNodeIds, nodes]);

  const handleRegisterApi = useCallback((api: FlowCanvasApi) => {
    reactFlowApiRef.current = api;
    // console.log("[FlowEditor] React Flow API registered:", api);
  }, []);

  const handleAddNode = useCallback((type: NodeType) => {
    if (!reactFlowApiRef.current) {
      // console.error("React Flow API not available yet.");
      return;
    }
    const position = calculateNodePosition(nodes, null);
    const newNode = createNewNode(type, position);
    // console.log(`[FlowEditor] Adding new node:`, newNode);
    
    const updatedNodes = [...nodes, newNode];
    setStructureNodes(updatedNodes); 
    
    const initialContent = { ...newNode.data, isDirty: false };
    setContent(newNode.id, initialContent as Partial<NodeContent>); 
    // console.log(`[FlowEditor] Synced new node data to nodeContentStore:`, initialContent);
    
    pushCurrentSnapshot();
  }, [nodes, setStructureNodes, setContent]);

  const handleRunFlow = useCallback(async () => {
    setIsExecuting(true);
    console.log('[FlowEditor] Run Flow button clicked.');
    
    // 1. Identify all root nodes in the current flow
    const rootNodeIds = getRootNodeIdsWithTypeConversion(nodes, edges);
    console.log(`[FlowEditor] Identified ${rootNodeIds.length} root nodes:`, rootNodeIds);

    if (rootNodeIds.length === 0) {
      console.warn('[FlowEditor] No root nodes found to execute.');
      setIsExecuting(false);
      return; // No need to proceed if there are no roots
    }

    // 2. Trigger execution for each root node asynchronously
    const executionPromises = rootNodeIds.map((rootId: string) => {
      console.log(`[FlowEditor] Initiating execution for root node: ${rootId}`);
      // 수정된 부분: nodes, edges 인자 제거하고 노드 ID만 전달
      return runFlow(rootId); 
    });

    // 3. Wait for all triggered executions to settle (complete or fail)
    try {
      const results = await Promise.allSettled(executionPromises);
      console.log('[FlowEditor] All root node executions settled.', results);
      // Log detailed results if needed (check results[i].status === 'fulfilled' or 'rejected')
      results.forEach((result: PromiseSettledResult<void>, index: number) => {
        if (result.status === 'rejected') {
          console.error(`[FlowEditor] Execution starting from root node ${rootNodeIds[index]} failed:`, result.reason);
        }
      });
    } catch (error) {
      // This catch block might not be strictly necessary if runFlow handles all errors,
      // but kept for safety with Promise.allSettled (though allSettled itself doesn't reject)
      console.error('[FlowEditor] Unexpected error during Promise.allSettled:', error);
    } finally {
      setIsExecuting(false);
      console.log('[FlowEditor] Finished handling all root node executions.');
    }
  }, [nodes, edges]);

  const [isExecuting, setIsExecuting] = useState(false);

  const handleNodeSelect = useCallback((nodeIds: string[] | null) => {
    // console.log(`[FlowEditor] Node selection changed:`, nodeIds);
    if (!nodeIds && !selectedNodeIdForSidebar) {
      // console.log(`[FlowEditor] Selection unchanged (null), not updating state`);
      return;
    }
    
    if (nodeIds && selectedNodeIdForSidebar && 
        nodeIds.length === selectedNodeIdForSidebar.length && 
        nodeIds.every((id, idx) => id === selectedNodeIdForSidebar[idx])) {
      // console.log(`[FlowEditor] Selection unchanged, not updating state`);
      return;
    }
    
    // console.log(`[FlowEditor] Updating selectedNodeIdForSidebar to:`, nodeIds);
    setSelectedNodeIdForSidebar(nodeIds);
  }, [selectedNodeIdForSidebar]);

  // Determine if exactly one node is selected
  const singleNodeSelectedId = useMemo(() => {
    if (selectedNodeIdForSidebar && selectedNodeIdForSidebar.length === 1) {
      return selectedNodeIdForSidebar[0];
    }
    return null;
  }, [selectedNodeIdForSidebar]);

  // Find the single selected node (if any)
  const singleSelectedNode = useMemo(() => {
    if (singleNodeSelectedId) {
      return nodes.find(n => n.id === singleNodeSelectedId);
    }
    return null;
  }, [nodes, singleNodeSelectedId]);

  const handleAddNodesToGroup = useCallback(() => {
    if (!selectedGroup || selectedNodesToAdd.length === 0) return;
    
    // console.log(`[FlowEditor] Adding ${selectedNodesToAdd.length} nodes to group ${selectedGroup.id}`);
    
    let updatedNodes = [...nodes];
    
    for (const node of selectedNodesToAdd) {
      updatedNodes = addNodeToGroup(
        node as unknown as Node<NodeData>, 
        selectedGroup as unknown as Node<NodeData>, 
        updatedNodes as Node<NodeData>[]
      );
    }
    
    setStructureNodes(updatedNodes);
    
    setSelectedNodeIds([selectedGroup.id]);
  }, [selectedGroup, selectedNodesToAdd, nodes, setStructureNodes, setSelectedNodeIds]);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
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
          {selectedGroup && selectedNodesToAdd.length > 0 && (
            <button
              onClick={handleAddNodesToGroup}
              className="px-3 py-1 bg-orange-500 text-white rounded-md hover:bg-orange-600 flex items-center"
              title="선택한 노드를 그룹에 추가"
            >
              <span className="mr-1">+ 그룹에 추가</span>
              <span className="bg-white text-orange-600 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                {selectedNodesToAdd.length}
              </span>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-none w-20 bg-white border-r border-gray-200 p-4 shadow-lg z-10 flex flex-col items-center space-y-4 overflow-y-auto">
            <button onClick={() => handleAddNode('llm')} title="Add LLM Node" className="w-full aspect-square rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md hover:shadow-lg transition-all duration-200 flex flex-col items-center justify-center gap-1 text-xs font-medium p-1"><svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>LLM</button>
            <button onClick={() => handleAddNode('api')} title="Add API Node" className="w-full aspect-square rounded-xl bg-gradient-to-br from-green-500 to-green-600 text-white shadow-md hover:shadow-lg transition-all duration-200 flex flex-col items-center justify-center gap-1 text-xs font-medium p-1"><svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>API</button>
             <button onClick={() => handleAddNode('output')} title="Add Output Node" className="w-full aspect-square rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-md hover:shadow-lg transition-all duration-200 flex flex-col items-center justify-center gap-1 text-xs font-medium p-1"><svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>Output</button>
            <button onClick={() => handleAddNode('input')} title="Add Input Node" className="w-full aspect-square rounded-xl bg-gradient-to-br from-gray-500 to-gray-600 text-white shadow-md hover:shadow-lg transition-all duration-200 flex flex-col items-center justify-center gap-1 text-xs font-medium p-1"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>Input</button>
            <button onClick={() => handleAddNode('group')} title="Add Group Node" className="w-full aspect-square rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-md hover:shadow-lg transition-all duration-200 flex flex-col items-center justify-center gap-1 text-xs font-medium p-1"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>Group</button>
            <button onClick={() => handleAddNode('conditional')} title="Add Conditional Node" className="w-full aspect-square rounded-xl bg-gradient-to-br from-yellow-500 to-yellow-600 text-white shadow-md hover:shadow-lg transition-all duration-200 flex flex-col items-center justify-center gap-1 text-xs font-medium p-1"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2zM5 10h14M5 14h14" /></svg>If/Else</button>
            <button onClick={() => handleAddNode('merger')} title="Add Merger Node" className="w-full aspect-square rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 text-white shadow-md hover:shadow-lg transition-all duration-200 flex flex-col items-center justify-center gap-1 text-xs font-medium p-1"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" /><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4" /><path strokeLinecap="round" strokeLinejoin="round" d="M3 12h4" /></svg>Merger</button>
            <button onClick={() => handleAddNode('json-extractor')} title="Add JSON Extractor Node" className="w-full aspect-square rounded-xl bg-gradient-to-br from-pink-500 to-pink-600 text-white shadow-md hover:shadow-lg transition-all duration-200 flex flex-col items-center justify-center gap-1 text-xs font-medium p-1"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>JSON</button>
            <button onClick={() => handleAddNode('web-crawler' as NodeType)} title="Add Web Crawler Node" className="w-full aspect-square rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-600 text-white shadow-md hover:shadow-lg transition-all duration-200 flex flex-col items-center justify-center gap-1 text-xs font-medium p-1"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" /><path strokeLinecap="round" strokeLinejoin="round" d="M10.172 13.828a4 4 0 015.656 0l4 4a4 4 0 01-5.656 5.656l-1.102-1.101" /></svg>Crawler</button>
            <button onClick={() => handleAddNode('html-parser')} title="Add HTML Parser Node" className="w-full aspect-square rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-md hover:shadow-lg transition-all duration-200 flex flex-col items-center justify-center gap-1 text-xs font-medium p-1">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              HTML Parser
            </button>
        </div>

        <div className="flex-1 relative bg-gray-100">
          <ReactFlowProvider>
            <FlowManager flowApi={reactFlowApiRef} />
            <FlowCanvas 
              onNodeSelect={handleNodeSelect} 
              registerReactFlowApi={handleRegisterApi} 
            />
          </ReactFlowProvider>
        </div>

        <div className="flex-none w-80 border-l border-gray-200 bg-white shadow-lg z-10 overflow-y-auto">
          {/* Render sidebar only if exactly one node is selected */}
          {singleSelectedNode ? (
            // Decide which sidebar based on the single selected node's type
            singleSelectedNode.type === 'group' ? (
              <GroupDetailSidebar selectedNodeIds={selectedNodeIdForSidebar as string[]} /> // Assert as string[] since singleSelectedNode ensures it's not null
            ) : (
              <NodeConfigSidebar selectedNodeIds={selectedNodeIdForSidebar} /> // Pass the array
            )
          ) : (
            // Render a placeholder or nothing when no node or multiple nodes are selected
            <div className="p-4 text-center text-gray-500">
              Select a single node to configure.
            </div>
          )}
        </div>
      </div>
      <StatusBar />
    </div>
  );
}; 