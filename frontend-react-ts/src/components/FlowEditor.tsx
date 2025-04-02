import React, { useState, useCallback } from 'react';
import { ReactFlowProvider } from 'reactflow';
import { useDispatch, useSelector } from 'react-redux';
import { FlowCanvas } from './FlowCanvas';
import { NodeConfigSidebar } from './NodeConfigSidebar';
import { GroupDetailSidebar } from './GroupDetailSidebar';
import { FlowManager } from './FlowManager';
import { NodeData } from '../types/nodes';
import type { Node } from 'reactflow';
import { RootState } from '../store/store';
import { addNode } from '../store/flowSlice';
import { NodeType } from '../types/nodes';
import FlowToolbar from './FlowToolbar';

export const FlowEditor = () => {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const dispatch = useDispatch();
  const nodes = useSelector((state: RootState) => state.flow.nodes);
  const edges = useSelector((state: RootState) => state.flow.edges);

  const handleAddNode = (type: NodeType) => {
    // Calculate position based on existing nodes
    const nodes = document.querySelectorAll('.react-flow__node');
    const lastNode = nodes[nodes.length - 1];
    
    let position = { x: 100, y: 100 };
    if (lastNode) {
      const rect = lastNode.getBoundingClientRect();
      position = { x: rect.x + 250, y: rect.y };
    }

    dispatch(addNode({ type, position }));
  };

  const handleNodeSelect = useCallback((node: Node<NodeData> | null) => {
    setSelectedNodeId(node?.id || null);
  }, []);

  const executeFlow = useCallback(async () => {
    setIsExecuting(true);

    try {
      // Find start nodes (nodes with no incoming edges)
      const startNodes = nodes.filter(node => 
        !edges.some(edge => edge.target === node.id)
      );

      // Execute each start node
      for (const node of startNodes) {
        const executeButton = document.querySelector(`[data-node-id="${node.id}"] button`) as HTMLButtonElement;
        executeButton?.click();

        // Wait for the node to finish executing
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error('플로우 실행 중 오류:', error);
    } finally {
      setIsExecuting(false);
    }
  }, [nodes, edges]);

  // Find the selected node object from the nodes array
  const selectedNode = nodes.find(node => node.id === selectedNodeId);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-none h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between shadow-sm z-20">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-gray-900">Flow Editor</h1>
        </div>
        <div className="flex items-center gap-4">
          <button
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2 text-sm font-medium disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed"
            onClick={executeFlow}
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

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
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
            {/* Add Group Node Button */}
            <button
              className="w-full aspect-square rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-md hover:shadow-lg transition-all duration-200 flex flex-col items-center justify-center gap-2 text-sm font-medium"
              onClick={() => handleAddNode('group')}
            >
              {/* Simple Group Icon (SVG - Folder) */}
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              Group
            </button>
            {/* Add Conditional Node Button */}
            <button
              className="w-full aspect-square rounded-xl bg-gradient-to-br from-yellow-500 to-yellow-600 text-white shadow-md hover:shadow-lg transition-all duration-200 flex flex-col items-center justify-center gap-2 text-sm font-medium"
              onClick={() => handleAddNode('conditional')}
            >
              {/* Simple Conditional Icon (SVG - Branch/Decision) */}
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2zM5 10h14M5 14h14" /> {/* Placeholder decision icon */} 
              </svg>
              Conditional
            </button>
            {/* Add Merger Node Button */}
            <button
              className="w-full aspect-square rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-md hover:shadow-lg transition-all duration-200 flex flex-col items-center justify-center gap-2 text-sm font-medium"
              onClick={() => handleAddNode('merger')}
            >
              {/* Simple Merger Icon (SVG - converging arrows) */}
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                 <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                 <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4" /> {/* Simple arrow towards center */}
                 <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h4" /> {/* Another arrow towards center */}
              </svg>
              Merger
            </button>
          </div>
        </div>

        {/* Flow Canvas */}
        <div className="flex-1 relative" style={{ minWidth: 0, minHeight: 0 }}>
          <ReactFlowProvider>
            <FlowCanvas onNodeSelect={handleNodeSelect} />
            <FlowManager />
          </ReactFlowProvider>
        </div>

        {/* Right Sidebar - Conditional Rendering */}
        {
          selectedNode?.type === 'group' 
            ? <GroupDetailSidebar selectedNodeId={selectedNodeId} />
            : <NodeConfigSidebar selectedNodeId={selectedNodeId} />
        }
      </div>
      <FlowToolbar />
    </div>
  );
}; 