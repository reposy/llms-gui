import { ReactFlowProvider } from 'reactflow';
import { FlowEditor } from './components/FlowEditor';
import { useEffect, useState, useRef } from 'react';
import { registerAllNodeTypes } from './core/NodeRegistry';
import { NodeFactory } from './core/NodeFactory';
import { useNodes, useEdges, useFlowStructureStore } from './store/useFlowStructureStore';
import { Node, Edge } from 'reactflow';

export default function App() {
  // zustand persist hydration 상태 확인
  const hydrated = useFlowStructureStore.persist?.hasHydrated?.() ?? false;

  // Initialize node types on application startup
  useEffect(() => {
    console.log('[App] Initializing node types at application startup');
    const nodeFactory = new NodeFactory();
    registerAllNodeTypes();
  }, []);

  // Use hydrated flag directly for loading state
  if (!hydrated) {
    return <div className="flex items-center justify-center h-screen w-screen text-lg text-gray-500">Loading Flow...</div>;
  }

  return (
    <div className="h-screen w-screen overflow-hidden">
      <ReactFlowProvider>
        <FlowEditor />
      </ReactFlowProvider>
    </div>
  );
} 