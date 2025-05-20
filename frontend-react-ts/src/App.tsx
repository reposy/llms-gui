import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { registerAllNodeTypes } from './core/NodeRegistry';
import { NodeFactory } from './core/NodeFactory';
import { useFlowStructureStore } from './store/useFlowStructureStore';
import FlowEditorPage from './pages/FlowEditorPage';
import ExecutorPage from './pages/ExecutorPage';
// import ExecutorPageRefactored from './pages/ExecutorPageRefactored';
// import FlowChainPage from './components/executor/FlowChainPage';

export default function App() {
  // Zustand persist hydration 상태 확인
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
  }, []);

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

  // Render the routes once hydrated
  console.log('[App] Hydration complete, rendering routes.');
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<FlowEditorPage />} />
        <Route path="/editor" element={<FlowEditorPage />} />
        <Route path="/executor" element={<ExecutorPage />} />
        {/* <Route path="/executor-legacy" element={<ExecutorPage />} /> */}
        {/* <Route path="/flow-chain" element={<FlowChainPage />} /> */}
      </Routes>
    </BrowserRouter>
  );
} 