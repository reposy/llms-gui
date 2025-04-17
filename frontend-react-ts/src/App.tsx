import { ReactFlowProvider } from 'reactflow';
import { FlowEditor } from './components/FlowEditor';
import { useEffect, useState, useRef } from 'react';
import { registerAllNodeTypes } from './core/NodeRegistry';
import { NodeFactory } from './core/NodeFactory';
import { useNodes, useEdges, useFlowStructureStore } from './store/useFlowStructureStore';
import { Node, Edge } from 'reactflow';

export default function App() {
  // Zustand persist hydration 상태 확인 (기존 정적 방식 제거)
  // const hydrated = useFlowStructureStore.persist?.hasHydrated?.() ?? false;

  // Dynamic hydration state tracking
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    console.log('[App] Checking hydration status...');
    if (useFlowStructureStore.persist.hasHydrated()) {
      console.log('[App] Zustand already hydrated.');
      setHydrated(true);
    } else {
      console.log('[App] Zustand not hydrated yet, subscribing to onFinishHydration.');
      const unsub = useFlowStructureStore.persist.onFinishHydration(() => {
        console.log('[App] Zustand hydration finished (via callback).');
        setHydrated(true);
      });
      // Cleanup subscription on unmount
      return () => {
        console.log('[App] Cleaning up hydration subscription.');
        unsub();
      };
    }
  }, []); // Empty dependency array ensures this runs only once on mount

  // Initialize node types on application startup
  useEffect(() => {
    console.log('[App] Initializing node types at application startup');
    const nodeFactory = new NodeFactory();
    registerAllNodeTypes();
  }, []);

  // Show loading screen while not hydrated
  if (!hydrated) {
    return <div className="flex items-center justify-center h-screen w-screen text-lg text-gray-500">Loading Flow...</div>;
  }

  // Render the main editor once hydrated
  console.log('[App] Hydration complete, rendering FlowEditor.');
  return (
    <div className="h-screen w-screen overflow-hidden">
      <ReactFlowProvider>
        <FlowEditor />
      </ReactFlowProvider>
    </div>
  );
} 