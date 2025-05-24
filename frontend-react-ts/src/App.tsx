import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { globalNodeFactory } from './core/NodeFactory';
import { useFlowStructureStore } from './store/useFlowStructureStore';
import FlowEditorPage from './pages/FlowEditorPage';
import FlowExecutorPage from './pages/FlowExecutorPage';
import { registerAllNodeTypes } from './core/NodeRegistry';
// import ExecutorPageRefactored from './pages/ExecutorPageRefactored';
// import FlowChainPage from './components/executor/FlowChainPage';

export default function App() {
  // Zustand persist hydration 상태 확인
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    registerAllNodeTypes(globalNodeFactory);
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
        <Route path="/executor" element={<FlowExecutorPage />} />
        <Route path="/executor-legacy" element={<FlowExecutorPage />} />
        {/* <Route path="/flow-chain" element={<FlowChainPage />} /> */}
      </Routes>
    </BrowserRouter>
  );
} 